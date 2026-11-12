import { execFile } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { expect, test } from "vitest"

const root = path.resolve(import.meta.dirname, "..")

const completeEnv = {
  DATABASE_URL: "postgresql://tajo@example/tajo",
  FLY_APP: "tajo",
  FLY_API_TOKEN: "fly-token",
  VERCEL_ORG_ID: "team_example",
  VERCEL_PROJECT_ID: "prj_example",
  VERCEL_TOKEN: "vercel-token",
}

async function sandboxPath(): Promise<{ bin: string; log: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), "tajo-deploy-"))
  const bin = path.join(dir, "bin")
  const log = path.join(dir, "called")
  await mkdir(bin)
  const record = `#!/bin/sh\nprintf '%s\\n' "$0 $*" >> ${JSON.stringify(log)}\n`
  await writeFile(path.join(bin, "vercel"), `${record}printf '%s\\n' '{"url":"patio.example"}'\n`)
  await writeFile(
    path.join(bin, "fly"),
    `${record}case "$*" in\n  *releases\\ --json*) printf '%s\\n' '[{"ImageRef":"registry.fly.io/tajo:deployment-new"},{"ImageRef":"registry.fly.io/tajo:deployment-old"}]' ;;\nesac\n`,
  )
  await writeFile(path.join(bin, "npm"), record)
  await writeFile(path.join(bin, "curl"), `${record}case "$*" in\n  */health*) exit 1 ;;\nesac\n`)
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

test("a failed health check restores the previous API image and leaves the schema", async () => {
  const { bin, log } = await sandboxPath()

  const result = await run(bin)
  const called = await readFile(log, "utf8")

  expect(result.code).not.toBe(0)
  inOrder(result.stdout, ["paso: health", "paso: rollback"])
  inOrder(called, [
    "node dist/migrate-cli.js",
    "curl --fail --silent --show-error --max-time 30 https://tajo.fly.dev/health",
    "releases --json",
    "fly deploy --image registry.fly.io/tajo:deployment-old",
  ])
  expect(called.split("dist/migrate-cli.js").length - 1).toBe(1)
  expect(called).not.toContain("deploy --image registry.fly.io/tajo:deployment-new")
})
