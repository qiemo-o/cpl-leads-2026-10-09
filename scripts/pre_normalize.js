#!/usr/bin/env node
// 只做列名对齐和本行内的整理，不删行。
// 用法: node pre_normalize.js <输入.xlsx|csv> [--out 输出.xlsx | --out=输出.xlsx]
'use strict';
const path = require('path');
const { loadRows, writeXlsx } = require('./io');
const { structuralFields } = require('./rules');

const argv = process.argv.slice(2);
const pos = argv.filter((a) => !a.startsWith('--'));
const IN = pos[0];
if (!IN) {
  console.error('用法: node pre_normalize.js <输入.xlsx|csv> [--out 输出.xlsx]');
  process.exit(1);
}
let OUT = '';
const eq = argv.find((a) => a.startsWith('--out='));
const idx = argv.indexOf('--out');
if (eq) OUT = eq.slice('--out='.length);
else if (idx >= 0) OUT = argv[idx + 1];
else OUT = IN.replace(/\.(xlsx|xls|csv)$/i, '') + '_normalized.xlsx';

const items = loadRows(IN);
const rows = items.map((item) => {
  const s = structuralFields(item.fields);
  return {
    'First name': s.first,
    'Last name': s.last,
    Gender: s.gender,
    Phone: s.phone,
    States: s.state,
    City: s.city,
    ZIP: s.zip,
    Address: s.address,
    Email: s.email,
    整理说明: s.repairs.join('；'),
  };
});
writeXlsx(OUT, rows, Object.keys(rows[0] || { 'First name': '' }));
const noted = rows.filter((r) => r.整理说明).length;
console.log(JSON.stringify({ input: path.basename(IN), rows: rows.length, repaired: noted, output: path.resolve(OUT) }, null, 2));
