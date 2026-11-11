import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import type { Pool } from "pg"

const migrationsDir = path.join(process.cwd(), "db", "migrations")

export async function migrate(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort()
  for (const filename of files) {
    const seen = await pool.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename])
    if (seen.rowCount) continue
    const sql = await readFile(path.join(migrationsDir, filename), "utf8")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(sql)
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename])
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }
}

