---
name: CPL用户数据处理
version: 1.1.0
description: 清洗 CPL leads。只整理本行里已经有的信息，分成「可用」和「不可用」。可用结果才允许生成入库 SQL。
---

# CPL用户数据处理 1.1

和 1.0 的差别见 `修复说明.md`。权威口径仍然是 14 列，但不再把猜出来的州写进通过表。

```bash
npm install
node scripts/self_check.js
node scripts/pre_normalize.js <原始.xlsx> --out=<规范化.xlsx>
node scripts/clean_leads.js <原始.xlsx> --outdir=<目录> --base=<文件名>
node scripts/load_warehouse.js --in=<目录>/<文件名>_可用.xlsx \
  --db=<库> --table=<表> --engine=mysql|postgres|clickhouse|generic --batch=<批次>
```

没给 `--db` 和 `--table` 时，只产 CSV，SQL 里不会出现可执行的 DELETE/INSERT。

列名大小写不敏感，`FirstName` / `ZIP` 可以直接读。`--out=文件` 和 `--out 文件` 都可以。
