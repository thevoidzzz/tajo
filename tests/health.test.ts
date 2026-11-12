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

test("a configured page origin can call the api", async () => {
  const previous = process.env.WEB_ORIGIN
  process.env.WEB_ORIGIN = "http://localhost:8080"
  try {
    const app = createApp(pool)
    const health = await request(app).get("/health")
    const preflight = await request(app)
      .options("/equipment")
      .set("Origin", "http://localhost:8080")
      .set("Access-Control-Request-Method", "POST")

    expect(health.headers["access-control-allow-origin"]).toBe("http://localhost:8080")
    expect(preflight.status).toBe(204)
  } finally {
    if (previous === undefined) delete process.env.WEB_ORIGIN
    else process.env.WEB_ORIGIN = previous
  }
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
