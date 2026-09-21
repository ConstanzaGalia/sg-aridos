import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile() {
  const envPath = join(__dirname, '../.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile()

const migrationsDir = join(__dirname, '../lib/db/migrations')
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL no está definida')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString })
try {
  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    await pool.query(sql)
    console.log(`Migración aplicada: ${file}`)
  }
} finally {
  await pool.end()
}
