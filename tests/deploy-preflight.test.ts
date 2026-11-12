import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises"
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
  const stub = `#!/bin/sh\nprintf '%s\\n' "$0 $*" >> ${JSON.stringify(log)}\n`
  for (const name of ["fly", "vercel"]) {
    const file = path.join(bin, name)
    await writeFile(file, stub)
    await chmod(file, 0o755)
  }
  await symlink(process.execPath, path.join(bin, "node"))
  const curl = (process.env.PATH ?? "")
    .split(":")
    .map((dir) => path.join(dir, "curl"))
    .find((candidate) => existsSync(candidate))
  if (!curl) throw new Error("curl is required to build the deploy sandbox")
  await symlink(curl, path.join(bin, "curl"))
  return { bin, log }
}

function run(bin: string, env: Record<string, string>) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(
      "./deploy.sh",
      {
        cwd: root,
        env: { PATH: `${bin}:/usr/bin:/bin`, TAJO_DOTENV: "0", ...env },
      },
      (error, stdout, stderr) => {
        const code = typeof error?.code === "number" ? error.code : error ? 1 : 0
        resolve({ code, stdout, stderr })
      },
    )
  })
}

test("deploy stops before publish when a variable is missing", async () => {
  const { bin, log } = await sandboxPath()
  const { DATABASE_URL: _ignored, ...withoutDatabase } = completeEnv

  const result = await run(bin, withoutDatabase)

  expect(result.code).not.toBe(0)
  expect(result.stdout).toContain("paso: preflight")
  expect(result.stderr).toContain("DATABASE_URL")
  await expect(readFile(log, "utf8")).rejects.toThrow()
})

test("deploy stops before publish when fly is missing", async () => {
  const { bin, log } = await sandboxPath()
  const { unlink } = await import("node:fs/promises")
  await unlink(path.join(bin, "fly"))

  const result = await run(bin, completeEnv)

  expect(result.code).not.toBe(0)
  expect(result.stdout).toContain("paso: preflight")
  expect(result.stderr).toContain("fly")
  await expect(readFile(log, "utf8")).rejects.toThrow()
})
