import { createApp } from "./app.js"
import { poolFromEnv } from "./db.js"
import { migrate } from "./migrate.js"

const port = Number(process.env.PORT ?? 3001)
const pool = poolFromEnv()
await migrate(pool)
const app = createApp(pool)
app.listen(port)
