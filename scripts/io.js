'use strict';
const fs = require('fs');
const path = require('path');

function loadXLSX() {
  const roots = [path.join(__dirname, '..', 'node_modules'), path.join(process.cwd(), 'node_modules')];
  for (const r of roots) {
    try { return require(path.join(r, 'xlsx')); } catch (e) { /* next */ }
  }
  return require('xlsx');
}
const XLSX = loadXLSX();

function loadRows(file) {
  const abs = path.resolve(file);
  if (/\.csv$/i.test(abs)) {
    const txt = fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '');
    const lines = txt.split(/\r?\n/).filter((l) => l.length);
    const parse = (line) => {
      const r = [];
      let c = '', q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
          if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; }
          else c += ch;
        } else if (ch === '"') q = true;
        else if (ch === ',') { r.push(c); c = ''; }
        else c += ch;
      }
      r.push(c);
      return r;
    };
    const head = parse(lines[0]).map((h) => h.trim());
    return lines.slice(1).map((line, i) => ({
      row: i + 2,
      fields: Object.fromEntries(head.map((h, idx) => [h, parse(line)[idx] == null ? '' : parse(line)[idx]])),
    }));
  }
  const wb = XLSX.readFile(abs, { cellDates: false });
  const sheet = wb.SheetNames.find((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }).length > 1) || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '', raw: false }).map((fields, i) => ({ row: i + 2, fields }));
}

function writeXlsx(file, records, columns) {
  const X = loadXLSX();
  const ws = X.utils.json_to_sheet(records.length ? records : [{}], { header: columns });
  const textCols = new Set(['邮政编码', '电话号码', '处理后电话号码', 'ZIP', 'Phone', '还原邮编', '还原电话']);
  const range = X.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const ref = X.utils.encode_cell({ r: R, c: C });
      const hdr = columns[C - range.s.c];
      const cell = ws[ref];
      if (cell && textCols.has(hdr)) { cell.t = 's'; cell.v = String(cell.v == null ? '' : cell.v); delete cell.w; }
    }
  }
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Sheet1');
  X.writeFile(wb, file);
}

module.exports = { loadRows, writeXlsx, loadXLSX };
