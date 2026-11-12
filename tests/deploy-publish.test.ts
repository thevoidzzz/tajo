import { execFile } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
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

const root = path.resolve(import.meta.dirname, "..")

const completeEnv = {
  DATABASE_URL: "postgresql://tajo@example/tajo",
  FLY_APP: "tajo",
  FLY_API_TOKEN: "fly-token",
  VERCEL_ORG_ID: "team_example",
  VERCEL_PROJECT_ID: "prj_example",
  VERCEL_TOKEN: "vercel-token",
}

async function sandboxPath(vercelStdout = '{"url":"patio.example"}'): Promise<{ bin: string; log: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), "tajo-deploy-"))
  const bin = path.join(dir, "bin")
  const log = path.join(dir, "called")
  await mkdir(bin)
  const record = `#!/bin/sh\nprintf '%s\\n' "$0 $*" >> ${JSON.stringify(log)}\n`
  const vercelStdoutPath = path.join(bin, "vercel-stdout")
  await writeFile(vercelStdoutPath, vercelStdout)
  await writeFile(
    path.join(bin, "vercel"),
    `${record}cat ${JSON.stringify(vercelStdoutPath)}\n`,
  )
  await writeFile(path.join(bin, "fly"), record)
  await writeFile(path.join(bin, "npm"), record)
  await writeFile(path.join(bin, "curl"), record)
  await writeFile(
    path.join(bin, "node"),
    `${record}if [ "$1" = "dist/migrate-cli.js" ]; then exit 0; fi\nexec ${JSON.stringify(process.execPath)} "$@"\n`,
  )
  for (const name of ["vercel", "fly", "npm", "curl", "node"]) {
    await chmod(path.join(bin, name), 0o755)
  }
  return { bin, log }
}

function run(bin: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(
      "./deploy.sh",
      {
        cwd: root,
        env: { PATH: `${bin}:/usr/bin:/bin`, TAJO_DOTENV: "0", ...completeEnv },
      },
      (error, stdout, stderr) => {
        const code = typeof error?.code === "number" ? error.code : error ? 1 : 0
        resolve({ code, stdout, stderr })
      },
    )
  })
}

function inOrder(text: string, parts: string[]) {
  let from = 0
  for (const part of parts) {
    const at = text.indexOf(part, from)
    expect(at, part).toBeGreaterThanOrEqual(0)
    from = at + part.length
  }
}

test("deploy publishes the page and the API and then applies pending SQL", async () => {
  const { bin, log } = await sandboxPath()

  const result = await run(bin)

  expect(result.code).toBe(0)
  inOrder(result.stdout, [
    "paso: preflight",
    "paso: pagina",
    "paso: api",
    "paso: migrar",
    "paso: pagina-ok",
    "paso: health",
  ])
  inOrder(await readFile(log, "utf8"), [
    "vercel deploy web --prod --yes --non-interactive --build-env VITE_API_URL=https://tajo.fly.dev",
    "fly secrets set DATABASE_URL=postgresql://tajo@example/tajo WEB_ORIGIN=https://patio.example --app tajo --stage",
    "fly deploy --remote-only --ha=false --now --app tajo",
    "npm run build",
    "node dist/migrate-cli.js",
    "curl --fail --silent --show-error --max-time 30 https://patio.example",
    "curl --fail --silent --show-error --max-time 30 https://tajo.fly.dev/health",
  ])
  expect(await readFile(log, "utf8")).toContain("fly.deploy.toml")
})

test("deploy drops the quote and comma the CLI leaves on the page URL", async () => {
  const { bin, log } = await sandboxPath(
    'note {not json}\n\u001b[32mAliased\u001b[0m https://patio.example",\n',
  )

  const result = await run(bin)

  expect(result.code).toBe(0)
  expect(await readFile(log, "utf8")).toContain(
    "fly secrets set DATABASE_URL=postgresql://tajo@example/tajo WEB_ORIGIN=https://patio.example --app tajo --stage",
  )
  expect(await readFile(log, "utf8")).toContain(
    "curl --fail --silent --show-error --max-time 30 https://patio.example",
  )
})

test("deploy reads the production page URL from the CLI text", async () => {
  const { bin, log } = await sandboxPath(
    "Production https://tajo-preview.vercel.app\nAliased https://patio.example",
  )

  const result = await run(bin)

  expect(result.code).toBe(0)
  expect(await readFile(log, "utf8")).toContain(
    "fly secrets set DATABASE_URL=postgresql://tajo@example/tajo WEB_ORIGIN=https://patio.example --app tajo --stage",
  )
})

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

test("a second migrate leaves the yard in place", async () => {
  const created = await request(createApp(pool)).post("/equipment").send({
    code: "CM-014",
    type: "camion",
    horometerHours: 1200,
  })
  expect(created.status).toBe(201)

  await migrate(pool)

  const listed = await request(createApp(pool)).get("/equipment")
  expect(listed.status).toBe(200)
  expect(listed.body).toEqual([
    expect.objectContaining({
      code: "CM-014",
      horometerHours: 1200,
      cycleStartHours: 1200,
      intervalHours: 250,
      status: "Al día",
    }),
  ])
})
