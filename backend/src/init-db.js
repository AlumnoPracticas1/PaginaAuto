import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { DEPLOYERS, CATALOG } from './seed-catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

await conn.query(sql);

const DB = process.env.DB_NAME || 'paginaauto';

// Migraciones idempotentes (añade columnas si previews ya existía).
async function addColIfMissing(table, ddl) {
  try {
    await conn.query(`ALTER TABLE \`${DB}\`.${table} ADD COLUMN ${ddl}`);
    console.log(`Migración: ${table} → ${ddl}`);
  } catch (e) {
    if (e?.code !== 'ER_DUP_FIELDNAME') throw e;
  }
}
await addColIfMissing('previews', 'extra JSON NULL');
await addColIfMissing('previews', 'deployer VARCHAR(32) NULL');
await addColIfMissing('previews', 'catalog_code VARCHAR(64) NULL');
await addColIfMissing('previews', 'pr_url VARCHAR(512) NULL');
await addColIfMissing('previews', 'pr_branch VARCHAR(255) NULL');
await addColIfMissing('previews', 'pr_critical TINYINT(1) NULL');

await conn.query(`USE \`${DB}\``);

// Seed deployers (idempotente)
for (const d of DEPLOYERS) {
  await conn.execute(
    `INSERT INTO deployers (name, display_name, url_patterns, header_hints, color, docs_url)
     VALUES (?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       url_patterns = VALUES(url_patterns),
       header_hints = VALUES(header_hints),
       color        = VALUES(color),
       docs_url     = VALUES(docs_url)`,
    [d.name, d.display_name, JSON.stringify(d.url_patterns || []), JSON.stringify(d.header_hints || []), d.color || null, d.docs_url || null]
  );
}
console.log(`Seed: ${DEPLOYERS.length} desplegadores ✓`);

// Seed catálogo (idempotente — UPDATE si ya existe el code+platform)
for (const c of CATALOG) {
  await conn.execute(
    `INSERT INTO error_catalog (code, platform, pattern_regex, category, severity, cause, solution, docs_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       pattern_regex = VALUES(pattern_regex),
       category      = VALUES(category),
       severity      = VALUES(severity),
       cause         = VALUES(cause),
       solution      = VALUES(solution),
       docs_url      = VALUES(docs_url)`,
    [c.code, c.platform, c.pattern_regex || null, c.category || null, c.severity || 'medium', c.cause || null, c.solution || null, c.docs_url || null]
  );
}
console.log(`Seed: ${CATALOG.length} entradas de catálogo ✓`);

console.log('DB inicializada ✓');
await conn.end();
