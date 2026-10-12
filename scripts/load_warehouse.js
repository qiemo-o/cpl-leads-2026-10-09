#!/usr/bin/env node
// 只加载「可用」文件。未给库表时不生成可执行 SQL。
// node load_warehouse.js --in=<可用.xlsx> [--db=] [--table=] [--key=phone+email|处理后电话号码]
//   [--part=dt] [--part-value=YYYY-MM-DD] [--mode=upsert|insert|overwrite]
//   [--engine=mysql|postgres|clickhouse|generic] [--batch=] [--outdir=] [--exec-cmd=]
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loadXLSX } = require('./io');
const XLSX = loadXLSX();

const arg = (n) => {
  const a = process.argv.find((s) => s.startsWith('--' + n + '='));
  return a ? a.split('=').slice(1).join('=') : '';
};
const IN = arg('in');
if (!IN) { console.error('缺 --in'); process.exit(1); }
const DB = arg('db');
const TABLE = arg('table');
const named = !!(DB && TABLE);
const KEY_CN = arg('key') || 'phone+email';
const composite = KEY_CN === 'phone+email';
const PART = arg('part') || 'dt';
const MODE = (arg('mode') || 'upsert').toLowerCase();
const ENGINE = (arg('engine') || 'generic').toLowerCase();
const BATCH = arg('batch') || 'batch';
const OUTDIR = path.resolve(arg('outdir') || path.dirname(path.resolve(IN)));
fs.mkdirSync(OUTDIR, { recursive: true });
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const PARTVAL = arg('part-value') || today;

const COLMAP = {
  名: 'first_name', 姓: 'last_name', 街道地址: 'address', 城市: 'city', 州缩写: 'state_code',
  电子邮件地址: 'email', 邮政编码: 'zip', 电话号码: 'phone_raw', 性别: 'gender', 州全称: 'state_name',
  处理后电话号码: 'phone', 国家: 'country', 数据来源: 'source_file', 备注: 'remark',
};
const keyCol = composite ? 'phone+email' : (COLMAP[KEY_CN] || KEY_CN);
const srcCols = Object.keys(COLMAP);
const targetCols = srcCols.map((c) => COLMAP[c]);
const wb = XLSX.readFile(IN);
const arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
const rows = arr.map((o) => {
  const r = {};
  srcCols.forEach((c) => { r[COLMAP[c]] = String(o[c] == null ? '' : o[c]); });
  r[PART] = PARTVAL;
  return r;
});
const phoneDup = {};
rows.forEach((r) => { phoneDup[r.phone] = (phoneDup[r.phone] || 0) + 1; });
const dupPhones = Object.values(phoneDup).filter((n) => n > 1).length;

const q = ENGINE === 'mysql' || ENGINE === 'clickhouse' ? (x) => '`' + x + '`' : (x) => '"' + x + '"';
const fullTable = () => q(DB) + '.' + q(TABLE);
const esc = (v) => {
  if (v === '' || v == null) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const CH = 500;
const loadCols = targetCols.concat([PART]);
function valuesBlock(r) {
  return '(' + loadCols.map((c) => (r[c] === '' || r[c] == null ? 'NULL' : esc(r[c]))).join(',') + ')';
}
function deleteStmt(rs) {
  if (composite) {
    const pairs = rs.map((r) => '(' + esc(r.phone) + ',' + esc(r.email) + ')').join(',');
    return 'DELETE FROM ' + fullTable() + ' WHERE ' + q(PART) + '=' + esc(PARTVAL) + ' AND (' + q('phone') + ',' + q('email') + ') IN (' + pairs + ');';
  }
  return 'DELETE FROM ' + fullTable() + ' WHERE ' + q(PART) + '=' + esc(PARTVAL) + ' AND ' + q(keyCol) + ' IN (' + rs.map((r) => esc(r[keyCol])).join(',') + ');';
}
function insertStmt(rs) {
  const cols = loadCols.map(q).join(',');
  return 'INSERT INTO ' + fullTable() + ' (' + cols + ') VALUES\n' + rs.map(valuesBlock).join(',\n') + ';';
}

const sql = [];
sql.push('-- CPL用户数据处理 · 批次 ' + BATCH + ' · ' + new Date().toISOString());
sql.push('-- 模式 ' + MODE + '  引擎 ' + ENGINE + '  行数 ' + rows.length + '  分区 ' + PART + '=' + PARTVAL);
sql.push('-- 同一电话、不同邮箱会同时保留。默认冲突键是 (phone, email)，不会用后一条盖住前一条。');
sql.push('-- 若表上仍有 phone 单独唯一索引，第二条不同邮箱会插入失败，请改成 (phone, email, ' + PART + ')。');
if (!composite) sql.push('-- 已指定 --key=' + KEY_CN + '，冲突键只有这一列，同电话不同邮箱会互相覆盖。');
if (dupPhones) sql.push('-- 注意：本批有 ' + dupPhones + ' 个电话对应多条记录。');
if (!named) {
  sql.push('-- 未指定 --db / --table，下面不生成可执行语句。CSV 已另存，指定库表后重新运行。');
} else if (ENGINE === 'clickhouse') {
  sql.push('-- ClickHouse 只 INSERT。表需为 ReplacingMergeTree，按 ' + keyCol + ' 去重，不要用 DELETE。');
  if (MODE === 'overwrite') sql.push('-- overwrite 在 ClickHouse 上不会 DELETE；请按分区重跑或使用替换表。');
  for (let i = 0; i < rows.length; i += CH) sql.push(insertStmt(rows.slice(i, i + CH)));
} else if (MODE === 'overwrite') {
  sql.push('DELETE FROM ' + fullTable() + ' WHERE ' + q(PART) + '=' + esc(PARTVAL) + ';');
  for (let i = 0; i < rows.length; i += CH) sql.push(insertStmt(rows.slice(i, i + CH)));
} else if (MODE === 'insert') {
  for (let i = 0; i < rows.length; i += CH) sql.push(insertStmt(rows.slice(i, i + CH)));
} else if (!composite && ENGINE === 'mysql') {
  const upd = targetCols.filter((c) => c !== keyCol).concat([PART]).map((c) => q(c) + '=new.' + q(c)).join(', ');
  for (let i = 0; i < rows.length; i += CH) {
    sql.push(insertStmt(rows.slice(i, i + CH)).replace(/;$/, ' AS new ON DUPLICATE KEY UPDATE ' + upd + ';'));
  }
} else if (!composite && ENGINE === 'postgres') {
  const upd = targetCols.filter((c) => c !== keyCol).concat([PART]).map((c) => q(c) + '=EXCLUDED.' + q(c)).join(', ');
  for (let i = 0; i < rows.length; i += CH) {
    const cols = loadCols.map(q).join(',');
    sql.push('INSERT INTO ' + fullTable() + ' (' + cols + ') VALUES\n' + rows.slice(i, i + CH).map(valuesBlock).join(',\n') + '\nON CONFLICT (' + q(keyCol) + ') DO UPDATE SET ' + upd + ';');
  }
} else {
  sql.push('-- 只删除本分区里的同一 phone+email，不删除同电话的另一条邮箱。');
  for (let i = 0; i < rows.length; i += CH) {
    const rs = rows.slice(i, i + CH);
    sql.push('BEGIN;');
    sql.push(deleteStmt(rs));
    sql.push(insertStmt(rs));
    sql.push('COMMIT;');
  }
}
const sqlText = sql.join('\n') + '\n';
const headRow = loadCols;
const csvEsc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csv = '\uFEFF' + [headRow.join(',')].concat(rows.map((r) => headRow.map((c) => csvEsc(r[c])).join(','))).join('\n') + '\n';
const SQLF = path.join(OUTDIR, BATCH + '.sql');
const CSVF = path.join(OUTDIR, BATCH + '_load.csv');
fs.writeFileSync(SQLF, sqlText);
fs.writeFileSync(CSVF, csv);

let executed = false;
let execMsg = named ? '未提供 --exec-cmd，已生成可加载 SQL/CSV（待执行）' : '未指定库表，只生成了 CSV，SQL 不可执行';
if (named && arg('exec-cmd')) {
  try {
    cp.execSync(arg('exec-cmd'), { input: sqlText, stdio: ['pipe', 'inherit', 'inherit'], shell: true });
    executed = true;
    execMsg = '已通过 exec-cmd 执行';
  } catch (e) { execMsg = '执行失败: ' + e.message; }
}
const result = {
  batch: BATCH,
  generatedAt: new Date().toISOString(),
  source: path.basename(IN),
  target: { db: DB || '(未指定库)', table: TABLE || '(未指定表)', key: keyCol, partitionField: PART, partitionValue: PARTVAL, mode: MODE, engine: ENGINE },
  rows: { clean: rows.length, writtenToWarehouse: executed ? rows.length : 0, staged: executed ? 0 : rows.length, duplicatePhones: dupPhones },
  fieldsWritten: headRow,
  execution: { executed, message: execMsg },
  artifacts: { sql: SQLF, csv: CSVF },
};
const md = [
  '# 批次执行结果 · ' + BATCH,
  '- 时间：' + result.generatedAt,
  '- 源文件：' + result.source,
  '- 目标：`' + (DB || '未指定') + '.' + (TABLE || '未指定') + '`　主键：`' + keyCol + '`　分区：`' + PART + "='" + PARTVAL + "'`　模式：" + MODE + '　引擎：' + ENGINE,
  '- 行数：**' + rows.length + '**',
  '- 同电话多条：' + dupPhones,
  '- 执行状态：' + (executed ? '已执行 — ' : '待执行 — ') + execMsg,
  '- 产物：`' + path.basename(SQLF) + '`、`' + path.basename(CSVF) + '`',
  '',
].join('\n');
fs.writeFileSync(path.join(OUTDIR, BATCH + '_result.md'), md);
fs.writeFileSync(path.join(OUTDIR, BATCH + '_result.json'), JSON.stringify(result, null, 2));
console.log(md);
