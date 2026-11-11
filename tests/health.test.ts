import pg from "pg"
import request from "supertest"
import { afterAll, beforeAll, expect, test } from "vitest"

import { createApp } from "../src/app.js"
import { poolFromEnv } from "../src/db.js"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required")
}

let pool: pg.Pool

beforeAll(() => {
  pool = poolFromEnv()
})

afterAll(async () => {
  await pool.end()
})

test("health is ok when the database answers", async () => {
  const response = await request(createApp(pool)).get("/health")

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ status: "ok" })
})

test("health is unavailable when the database does not answer", async () => {
  const closed = new pg.Pool({
    connectionString: "postgresql://tajo@127.0.0.1:1/tajo",
    connectionTimeoutMillis: 400,
    max: 1,
  })
  try {
    const response = await request(createApp(closed)).get("/health")

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ error: "database_unavailable" })
  } finally {
    await closed.end()
  }
})
