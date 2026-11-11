import { poolFromEnv } from "./db.js"
import { migrate } from "./migrate.js"

const pool = poolFromEnv()
try {
  await migrate(pool)
} finally {
  await pool.end()
}
