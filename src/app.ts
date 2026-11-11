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

const patchBody = z
  .object({
    code: code.optional(),
    type: typeCode.optional(),
    horometerHours: horometerHours.optional(),
  })
  .refine((body) => body.code !== undefined || body.type !== undefined || body.horometerHours !== undefined)

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

  app.delete("/equipment/:id", route(async (req: Request, res: Response) => {
    try {
      const removed = await pool.query("DELETE FROM equipment WHERE equipment_id = $1", [req.params.id])
      if (!removed.rowCount) {
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
    res.status(204).end()
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
        SET code = COALESCE($2, code),
            type_code = COALESCE($3, type_code),
            horometer_hours = COALESCE($4, horometer_hours)
        WHERE equipment_id = $1
        RETURNING equipment_id
        `,
        [req.params.id, parsed.data.code ?? null, parsed.data.type ?? null, parsed.data.horometerHours ?? null],
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
      if (isBelowCycle(error)) {
        fail(res, 422, "horometer_below_cycle")
        return
      }
      if (isUniqueViolation(error)) {
        fail(res, 409, "duplicate_code")
        return
      }
      throw error
    }
    const row = await pool.query(`${equipmentSelect} WHERE e.equipment_id = $1`, [req.params.id])
    res.json(row.rows[0])
  }))

  app.post("/equipment/:id/maintenance", route(async (req: Request, res: Response) => {
    if (req.body !== undefined && req.body !== null && Object.keys(req.body as object).length > 0) {
      fail(res, 400, "invalid_body")
      return
    }
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const locked = await client.query<{ horometer_hours: number }>(
        "SELECT horometer_hours FROM equipment WHERE equipment_id = $1 FOR UPDATE",
        [req.params.id],
      )
      if (!locked.rowCount) {
        await client.query("ROLLBACK")
        fail(res, 404, "not_found")
        return
      }
      const recorded = await client.query(
        `
        INSERT INTO maintenance (equipment_id, horometer_hours)
        VALUES ($1, $2)
        RETURNING maintenance_id AS id,
                  equipment_id AS "equipmentId",
                  horometer_hours AS "horometerHours",
                  recorded_at AS "recordedAt"
        `,
        [req.params.id, locked.rows[0].horometer_hours],
      )
      await client.query("UPDATE equipment SET cycle_start_hours = horometer_hours WHERE equipment_id = $1", [
        req.params.id,
      ])
      await client.query("COMMIT")
      res.status(201).json(recorded.rows[0])
    } catch (error) {
      await client.query("ROLLBACK")
      if (isInvalidUuid(error)) {
        fail(res, 404, "not_found")
        return
      }
      throw error
    } finally {
      client.release()
    }
  }))

  app.get("/equipment/:id/maintenance", route(async (req: Request, res: Response) => {
    try {
      const equipment = await pool.query("SELECT 1 FROM equipment WHERE equipment_id = $1", [req.params.id])
      if (!equipment.rowCount) {
        fail(res, 404, "not_found")
        return
      }
      const history = await pool.query(
        `
        SELECT maintenance_id AS id,
               equipment_id AS "equipmentId",
               horometer_hours AS "horometerHours",
               recorded_at AS "recordedAt"
        FROM maintenance
        WHERE equipment_id = $1
        ORDER BY recorded_at, maintenance_id
        `,
        [req.params.id],
      )
      res.json(history.rows)
    } catch (error) {
      if (isInvalidUuid(error)) {
        fail(res, 404, "not_found")
        return
      }
      throw error
    }
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

function isBelowCycle(error: unknown): boolean {
  return postgresCode(error) === "23514" && postgresConstraint(error) === "equipment_horometer_covers_cycle"
}

function postgresCode(error: unknown): string | undefined {
  return postgresField(error, "code")
}

function postgresConstraint(error: unknown): string | undefined {
  return postgresField(error, "constraint")
}

function postgresField(error: unknown, field: string): string | undefined {
  if (typeof error === "object" && error !== null && field in error) {
    const value = (error as Record<string, unknown>)[field]
    if (typeof value === "string") return value
  }
  return undefined
}
