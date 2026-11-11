import type { Pool } from "pg"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest"

import { createApp } from "../src/app.js"
import { poolFromEnv } from "../src/db.js"
import { migrate } from "../src/migrate.js"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

let pool: Pool

beforeAll(async () => {
  pool = poolFromEnv()
  await migrate(pool)
})

beforeEach(async () => {
  await pool.query("TRUNCATE equipment")
})

afterAll(async () => {
  await pool.end()
})

test("a truck that arrives with 1200 hours is current and the cycle starts there", async () => {
  const response = await request(createApp(pool)).post("/equipment").send({
    code: "CM-014",
    type: "camion",
    horometerHours: 1200,
  })

  expect(response.status).toBe(201)
  expect(response.body).toMatchObject({
    code: "CM-014",
    type: "camion",
    horometerHours: 1200,
    cycleStartHours: 1200,
    intervalHours: 250,
    status: "Al día",
  })
})

test("each type keeps the interval of this version", async () => {
  const app = createApp(pool)
  const created = []
  for (const [type, hours] of [
    ["camion", 250],
    ["excavadora", 500],
    ["perforadora", 200],
  ] as const) {
    const response = await request(app).post("/equipment").send({
      code: type,
      type,
      horometerHours: 0,
    })
    created.push([response.body.intervalHours, hours])
  }

  expect(created).toEqual([
    [250, 250],
    [500, 500],
    [200, 200],
  ])
})

test("a truck stays current at 249 hours and requires maintenance at 250", async () => {
  const app = createApp(pool)
  const created = await request(app).post("/equipment").send({
    code: "CM-020",
    type: "camion",
    horometerHours: 0,
  })

  const before = await request(app).patch(`/equipment/${created.body.id}`).send({ horometerHours: 249 })
  const after = await request(app).patch(`/equipment/${created.body.id}`).send({ horometerHours: 250 })

  expect(before.body.status).toBe("Al día")
  expect(after.body.status).toBe("Requiere mantenimiento")
})

test("the yard lists equipment that requires maintenance first", async () => {
  const app = createApp(pool)
  const current = await request(app).post("/equipment").send({
    code: "EX-001",
    type: "excavadora",
    horometerHours: 0,
  })
  const due = await request(app).post("/equipment").send({
    code: "CM-099",
    type: "camion",
    horometerHours: 0,
  })
  await request(app).patch(`/equipment/${due.body.id}`).send({ horometerHours: 250 })

  const listed = await request(app).get("/equipment")

  expect(listed.body.map((item: { code: string }) => item.code)).toEqual(["CM-099", "EX-001"])
  expect(current.body.status).toBe("Al día")
})

test("a repeated code is rejected", async () => {
  const app = createApp(pool)
  await request(app).post("/equipment").send({ code: "CM-014", type: "camion", horometerHours: 0 })
  const again = await request(app).post("/equipment").send({
    code: "CM-014",
    type: "perforadora",
    horometerHours: 10,
  })

  expect(again.status).toBe(409)
  expect(again.body.error).toBe("duplicate_code")
})

test("hours have to be a whole number that is not negative", async () => {
  const app = createApp(pool)
  const negative = await request(app).post("/equipment").send({
    code: "CM-014",
    type: "camion",
    horometerHours: -1,
  })
  const fraction = await request(app).post("/equipment").send({
    code: "CM-014",
    type: "camion",
    horometerHours: 1.5,
  })

  expect(negative.status).toBe(400)
  expect(negative.body.error).toBe("invalid_body")
  expect(fraction.status).toBe(400)
  expect(fraction.body.error).toBe("invalid_body")
})

test("an unknown type is rejected", async () => {
  const response = await request(createApp(pool))
    .post("/equipment")
    .send({ code: "CM-014", type: "grua", horometerHours: 0 })

  expect(response.status).toBe(400)
  expect(response.body.error).toBe("invalid_body")
})
