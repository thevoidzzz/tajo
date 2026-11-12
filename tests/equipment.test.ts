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
  await pool.query("TRUNCATE equipment CASCADE")
})

afterAll(async () => {
  await pool.end()
})

test("a body that does not fit is rejected before it reaches the yard", async () => {
  const app = createApp(pool)
  const broken = await request(app).post("/equipment").set("Content-Type", "application/json").send("{")
  const oversized = await request(app)
    .post("/equipment")
    .send({ code: "A".repeat(9000), type: "camion", horometerHours: 0 })

  expect(broken.status).toBe(400)
  expect(broken.body).toEqual({ error: "invalid_body" })
  expect(oversized.status).toBe(413)
  expect(oversized.body).toEqual({ error: "invalid_body" })
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

test("a horometer edited below the cycle start is rejected and the reading stays", async () => {
  const app = createApp(pool)
  const created = await request(app).post("/equipment").send({
    code: "CM-014",
    type: "camion",
    horometerHours: 1200,
  })

  const rejected = await request(app).patch(`/equipment/${created.body.id}`).send({ horometerHours: 1199 })
  const listed = await request(app).get("/equipment")

  expect(rejected.status).toBe(422)
  expect(rejected.body.error).toBe("horometer_below_cycle")
  expect(listed.body[0].horometerHours).toBe(1200)
})

test("a shorter interval marks the same reading as due", async () => {
  const app = createApp(pool)
  const created = await request(app).post("/equipment").send({
    code: "PF-003",
    type: "camion",
    horometerHours: 0,
  })
  await request(app).patch(`/equipment/${created.body.id}`).send({ horometerHours: 220 })

  const changed = await request(app).patch(`/equipment/${created.body.id}`).send({ type: "perforadora" })

  expect(changed.status).toBe(200)
  expect(changed.body).toMatchObject({
    type: "perforadora",
    horometerHours: 220,
    cycleStartHours: 0,
    intervalHours: 200,
    status: "Requiere mantenimiento",
  })
})

test("a code can change and a code already in the yard is rejected", async () => {
  const app = createApp(pool)
  const first = await request(app).post("/equipment").send({
    code: "CM-014",
    type: "camion",
    horometerHours: 10,
  })
  await request(app).post("/equipment").send({
    code: "EX-002",
    type: "excavadora",
    horometerHours: 0,
  })

  const renamed = await request(app).patch(`/equipment/${first.body.id}`).send({ code: "CM-015" })
  const taken = await request(app).patch(`/equipment/${first.body.id}`).send({ code: "EX-002" })
  const listed = await request(app).get("/equipment")

  expect(renamed.status).toBe(200)
  expect(renamed.body.code).toBe("CM-015")
  expect(taken.status).toBe(409)
  expect(taken.body.error).toBe("duplicate_code")
  expect(listed.body.map((item: { code: string }) => item.code)).toContain("CM-015")
})

test("deleting a machine removes it from the yard", async () => {
  const app = createApp(pool)
  const created = await request(app).post("/equipment").send({
    code: "CM-014",
    type: "camion",
    horometerHours: 40,
  })

  const removed = await request(app).delete(`/equipment/${created.body.id}`)
  const listed = await request(app).get("/equipment")
  const again = await request(app).delete(`/equipment/${created.body.id}`)

  expect(removed.status).toBe(204)
  expect(listed.body).toEqual([])
  expect(again.status).toBe(404)
  expect(again.body.error).toBe("not_found")
})

test("recording a maintenance restarts the cycle and keeps the horometer", async () => {
  const app = createApp(pool)
  const created = await request(app).post("/equipment").send({
    code: "CM-014",
    type: "camion",
    horometerHours: 0,
  })
  await request(app).patch(`/equipment/${created.body.id}`).send({ horometerHours: 250 })

  const recorded = await request(app).post(`/equipment/${created.body.id}/maintenance`).send({})
  const listed = await request(app).get("/equipment")
  const history = await request(app).get(`/equipment/${created.body.id}/maintenance`)

  expect(recorded.status).toBe(201)
  expect(recorded.body.horometerHours).toBe(250)
  expect(listed.body[0]).toMatchObject({
    horometerHours: 250,
    cycleStartHours: 250,
    status: "Al día",
  })
  expect(history.body).toEqual([expect.objectContaining({ horometerHours: 250 })])
})

test("another 250 hours after maintenance requires maintenance again", async () => {
  const app = createApp(pool)
  const created = await request(app).post("/equipment").send({
    code: "CM-020",
    type: "camion",
    horometerHours: 0,
  })
  await request(app).patch(`/equipment/${created.body.id}`).send({ horometerHours: 250 })
  await request(app).post(`/equipment/${created.body.id}/maintenance`).send({})

  const before = await request(app).patch(`/equipment/${created.body.id}`).send({ horometerHours: 499 })
  const after = await request(app).patch(`/equipment/${created.body.id}`).send({ horometerHours: 500 })

  expect(before.body).toMatchObject({ horometerHours: 499, cycleStartHours: 250, status: "Al día" })
  expect(after.body).toMatchObject({
    horometerHours: 500,
    cycleStartHours: 250,
    status: "Requiere mantenimiento",
  })
})

test("a second maintenance stays in the history even when the machine is current", async () => {
  const app = createApp(pool)
  const created = await request(app).post("/equipment").send({
    code: "CM-021",
    type: "camion",
    horometerHours: 80,
  })

  await request(app).post(`/equipment/${created.body.id}/maintenance`).send({})
  await request(app).post(`/equipment/${created.body.id}/maintenance`).send({})
  const history = await request(app).get(`/equipment/${created.body.id}/maintenance`)

  expect(history.body).toHaveLength(2)
  expect(history.body[0].horometerHours).toBe(80)
  expect(history.body[1].horometerHours).toBe(80)
  expect(history.body[0].recordedAt <= history.body[1].recordedAt).toBe(true)
})

test("a maintenance cannot be recorded at a chosen reading", async () => {
  const app = createApp(pool)
  const created = await request(app).post("/equipment").send({
    code: "CM-022",
    type: "camion",
    horometerHours: 40,
  })

  const rejected = await request(app)
    .post(`/equipment/${created.body.id}/maintenance`)
    .send({ horometerHours: 10 })
  const listed = await request(app).get("/equipment")

  expect(rejected.status).toBe(400)
  expect(rejected.body.error).toBe("invalid_body")
  expect(listed.body[0].cycleStartHours).toBe(40)
})

test("a machine with history can leave the yard", async () => {
  const app = createApp(pool)
  const created = await request(app).post("/equipment").send({
    code: "CM-023",
    type: "camion",
    horometerHours: 10,
  })
  await request(app).post(`/equipment/${created.body.id}/maintenance`).send({})

  const removed = await request(app).delete(`/equipment/${created.body.id}`)
  const listed = await request(app).get("/equipment")

  expect(removed.status).toBe(204)
  expect(listed.body).toEqual([])
})

test("an unknown type is rejected", async () => {
  const response = await request(createApp(pool))
    .post("/equipment")
    .send({ code: "CM-014", type: "grua", horometerHours: 0 })

  expect(response.status).toBe(400)
  expect(response.body.error).toBe("invalid_body")
})
