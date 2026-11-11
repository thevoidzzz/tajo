import express, { type Express, type Request, type Response } from "express"
import type { Pool } from "pg"
import { z } from "zod"

const typeCode = z.enum(["camion", "excavadora", "perforadora"])
const code = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/)
const horometerHours = z.number().int().nonnegative()

const createBody = z.object({
  code,
  type: typeCode,
  horometerHours,
})

const patchBody = z.object({
  horometerHours,
})

const equipmentSelect = `
  SELECT e.equipment_id AS id,
         e.code,
         e.type_code AS type,
         e.horometer_hours AS "horometerHours",
         e.cycle_start_hours AS "cycleStartHours",
         t.interval_hours AS "intervalHours",
         CASE
           WHEN e.horometer_hours >= e.cycle_start_hours + t.interval_hours
           THEN 'Requiere mantenimiento'
           ELSE 'Al día'
         END AS status
  FROM equipment e
  JOIN equipment_type t ON t.type_code = e.type_code
`

function fail(res: Response, status: number, error: string): void {
  res.status(status).json({ error })
}

function route(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: (error: unknown) => void) => void {
  return (req, res, next) => {
    handler(req, res).catch(next)
  }
}

export function createApp(pool: Pool): Express {
  const app = express()
  app.use(express.json())

  app.post("/equipment", route(async (req: Request, res: Response) => {
    const parsed = createBody.safeParse(req.body)
    if (!parsed.success) {
      fail(res, 400, "invalid_body")
      return
    }
    const { code: equipmentCode, type, horometerHours: hours } = parsed.data
    try {
      const inserted = await pool.query<{ id: string }>(
        `
        INSERT INTO equipment (code, type_code, horometer_hours, cycle_start_hours)
        VALUES ($1, $2, $3, $3)
        RETURNING equipment_id AS id
        `,
        [equipmentCode, type, hours],
      )
      const row = await pool.query(`${equipmentSelect} WHERE e.equipment_id = $1`, [inserted.rows[0].id])
      res.status(201).json(row.rows[0])
    } catch (error) {
      if (isUniqueViolation(error)) {
        fail(res, 409, "duplicate_code")
        return
      }
      throw error
    }
  }))

  app.get("/equipment", route(async (_req: Request, res: Response) => {
    const rows = await pool.query(
      `${equipmentSelect}
       ORDER BY (e.horometer_hours >= e.cycle_start_hours + t.interval_hours) DESC, e.code`,
    )
    res.json(rows.rows)
  }))

  app.patch("/equipment/:id", route(async (req: Request, res: Response) => {
    const parsed = patchBody.safeParse(req.body)
    if (!parsed.success) {
      fail(res, 400, "invalid_body")
      return
    }
    try {
      const updated = await pool.query(
        `
        UPDATE equipment
        SET horometer_hours = $2
        WHERE equipment_id = $1
        RETURNING equipment_id
        `,
        [req.params.id, parsed.data.horometerHours],
      )
      if (!updated.rowCount) {
        fail(res, 404, "not_found")
        return
      }
    } catch (error) {
      if (isInvalidUuid(error)) {
        fail(res, 404, "not_found")
        return
      }
      throw error
    }
    const row = await pool.query(`${equipmentSelect} WHERE e.equipment_id = $1`, [req.params.id])
    res.json(row.rows[0])
  }))

  app.use((error: unknown, _req: Request, res: Response, _next: (error: unknown) => void) => {
    console.error(error)
    if (!res.headersSent) fail(res, 500, "internal")
  })

  return app
}

function isUniqueViolation(error: unknown): boolean {
  return postgresCode(error) === "23505"
}

function isInvalidUuid(error: unknown): boolean {
  return postgresCode(error) === "22P02"
}

function postgresCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code
  }
  return undefined
}
