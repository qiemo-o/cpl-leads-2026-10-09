#!/usr/bin/env node
// 用法: node clean_leads.js <输入.xlsx|csv> [--outdir=DIR] [--base=名]
// 产出:
//   <base>_可用.xlsx        本来就能用，没有改字段
//   <base>_整理后可用.xlsx  整理以后能用
//   <base>_不可用.xlsx      缺字段，或电话、邮箱、地址、州和邮编对不上
'use strict';
const fs = require('fs');
const path = require('path');
const { loadRows, writeXlsx } = require('./io');
const { classifyAll, toCleanRecord, TARGET } = require('./rules');

const argv = process.argv.slice(2);
const flag = (name) => {
  const a = argv.find((s) => s.startsWith('--' + name + '='));
  return a ? a.split('=').slice(1).join('=') : '';
};
const pos = argv.filter((a) => !a.startsWith('--'));
const IN = pos[0];
if (!IN) {
  console.error('用法: node clean_leads.js <文件> [--outdir=DIR] [--base=名]');
  process.exit(1);
}
const abs = path.resolve(IN);
const BASE = flag('base') || path.basename(abs).replace(/\.(xlsx|xls|csv)$/i, '');
const outDir = path.resolve(flag('outdir') || path.dirname(abs));
fs.mkdirSync(outDir, { recursive: true });

const items = loadRows(abs);
const classified = classifyAll(items);
const buckets = { 信息齐全: [], 真的不全: [], 无法可靠整理: [] };
for (const a of classified) buckets[a.bucket].push(a);

const usable = buckets.信息齐全;
const unusable = buckets.真的不全.concat(buckets.无法可靠整理);

const SRC = ['FirstName', 'LastName', 'Gender', 'Phone', 'States', 'City', 'ZIP', 'Address', 'Email'];
const byRow = new Map(items.map((item) => [item.row, item.fields]));
function aRow(n) {
  const f = byRow.get(n) || {};
  const pick = (...keys) => {
    for (const k of keys) {
      if (f[k] != null && String(f[k]).trim() !== '') return String(f[k]).trim();
    }
    for (const key of Object.keys(f)) {
      if (keys.some((w) => key.toLowerCase().replace(/[\s_]/g, '') === w.toLowerCase().replace(/[\s_]/g, ''))) {
        return String(f[key] == null ? '' : f[key]).trim();
      }
    }
    return '';
  };
  return {
    FirstName: pick('FirstName', 'First name', '名'),
    LastName: pick('LastName', 'Last name', '姓'),
    Gender: pick('Gender', '性别'),
    Phone: pick('Phone', '电话号码'),
    States: pick('States', 'State', '州缩写'),
    City: pick('City', '城市'),
    ZIP: pick('ZIP', 'zipCode', '邮政编码'),
    Address: pick('Address', '街道地址'),
    Email: pick('Email', '电子邮件地址'),
  };
}
function problemRow(a) {
  const src = aRow(a.row);
  const reasons = a.incomplete.concat(a.unreliable);
  return {
    原始行号: a.row,
    分类: '不可用',
    FirstName: src.FirstName, LastName: src.LastName, Gender: src.Gender, Phone: src.Phone,
    States: src.States, City: src.City, ZIP: src.ZIP, Address: src.Address, Email: src.Email,
    错误原因: reasons.join('；'),
    整理说明: a.repairs.join('；'),
    还原名: a.first, 还原姓: a.last, 还原州: a.abbr, 还原城市: a.city,
    还原邮编: a.zip, 还原电话: a.phone, 还原邮箱: a.email,
  };
}
const problemCols = ['原始行号', '分类', ...SRC, '错误原因', '整理说明', '还原名', '还原姓', '还原州', '还原城市', '还原邮编', '还原电话', '还原邮箱'];
const noteOnly = (n) => n.startsWith('城市不是邮编主城市');
const tidied = (a) => a.repairs.some((n) => !noteOnly(n));
const ready = usable.filter((a) => !tidied(a));
const repaired = usable.filter(tidied);
const cols = TARGET.concat(['整理说明']);
writeXlsx(path.join(outDir, BASE + '_可用.xlsx'), ready.map((a) => toCleanRecord(a, BASE)), cols);
writeXlsx(path.join(outDir, BASE + '_整理后可用.xlsx'), repaired.map((a) => toCleanRecord(a, BASE)), cols);
writeXlsx(path.join(outDir, BASE + '_不可用.xlsx'), unusable.map(problemRow), problemCols);

function tally(list) {
  const m = {};
  for (const a of list) {
    for (const r of a.incomplete.concat(a.unreliable)) {
      const k = r.split(':')[0].split('（')[0];
      m[k] = (m[k] || 0) + 1;
    }
  }
  return m;
}
const summary = {
  input: path.basename(abs),
  rows: items.length,
  可用: ready.length,
  整理后可用: repaired.length,
  不可用: unusable.length,
  不可用原因: tally(unusable),
  outputs: {
    可用: path.join(outDir, BASE + '_可用.xlsx'),
    整理后可用: path.join(outDir, BASE + '_整理后可用.xlsx'),
    不可用: path.join(outDir, BASE + '_不可用.xlsx'),
  },
};
fs.writeFileSync(path.join(outDir, BASE + '_分类统计.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
