import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { listEquipment } from "./api.js"
import { Page } from "./page.js"

vi.mock("./api.js", () => ({
  listEquipment: vi.fn(),
  listMaintenance: vi.fn(),
  createEquipment: vi.fn(),
  updateEquipment: vi.fn(),
  deleteEquipment: vi.fn(),
  recordMaintenance: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test("the yard shows a skeleton until the list arrives", async () => {
  let release: (rows: []) => void = () => {}
  vi.mocked(listEquipment).mockReturnValue(
    new Promise((resolve) => {
      release = resolve
    }),
  )

  render(<Page />)

  expect(screen.getByRole("status").textContent).toBe("Cargando el patio.")
  expect(document.querySelectorAll(".skeleton span")).toHaveLength(3)

  release([])

  expect(await screen.findByText("El patio está vacío. Anota el código y las horas con las que llega.")).toBeTruthy()
  expect(screen.queryByRole("status")).toBeNull()
})

test("a failed list replaces the skeleton with the error", async () => {
  vi.mocked(listEquipment).mockRejectedValue(new Error("list_failed"))

  render(<Page />)

  expect((await screen.findByRole("alert")).textContent).toBe("No se pudo leer el patio.")
  expect(screen.queryByRole("status")).toBeNull()
})
