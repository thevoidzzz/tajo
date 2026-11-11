import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { Yard, type Equipment } from "./yard.js"

const due: Equipment = {
  id: "1",
  code: "CM-099",
  type: "camion",
  horometerHours: 250,
  status: "Requiere mantenimiento",
}

const current: Equipment = {
  id: "2",
  code: "EX-001",
  type: "excavadora",
  horometerHours: 0,
  status: "Al día",
}

afterEach(() => {
  cleanup()
})

test("the yard lists equipment that requires maintenance first", () => {
  render(<Yard equipment={[due, current]} onCreate={async () => {}} />)

  const rows = screen.getAllByRole("listitem")

  expect(rows[0].textContent).toContain("CM-099")
  expect(rows[0].textContent).toContain("Camión")
  expect(rows[0].textContent).toContain("250 h")
  expect(rows[0].textContent).toContain("Requiere mantenimiento")
  expect(rows[1].textContent).toContain("EX-001")
  expect(rows[1].textContent).toContain("Al día")
  expect(screen.getByText("1 requiere mantenimiento")).toBeTruthy()
})

test("an empty horometer does not add a machine", () => {
  const onCreate = vi.fn()
  render(<Yard equipment={[]} onCreate={onCreate} />)

  fireEvent.change(screen.getByLabelText("Código"), { target: { value: "CM-014" } })
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))

  expect(onCreate).not.toHaveBeenCalled()
  expect(screen.getByRole("alert").textContent).toBe("Revisa el código, el tipo y el horómetro.")
})

test("giving a machine a code, a type and a horometer adds it to the yard", async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined)
  render(<Yard equipment={[]} onCreate={onCreate} />)

  fireEvent.change(screen.getByLabelText("Código"), { target: { value: "CM-014" } })
  fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "camion" } })
  fireEvent.change(screen.getByLabelText("Horómetro"), { target: { value: "1200" } })
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))

  expect(onCreate).toHaveBeenCalledWith({
    code: "CM-014",
    type: "camion",
    horometerHours: 1200,
  })
  expect(screen.getByText("El patio está vacío.")).toBeTruthy()
})
