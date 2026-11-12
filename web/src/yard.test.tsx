import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { Yard, type Equipment } from "./yard.js"

const due: Equipment = {
  id: "1",
  code: "CM-099",
  type: "camion",
  horometerHours: 250,
  cycleStartHours: 0,
  intervalHours: 250,
  status: "Requiere mantenimiento",
}

const current: Equipment = {
  id: "2",
  code: "EX-001",
  type: "excavadora",
  horometerHours: 0,
  cycleStartHours: 0,
  intervalHours: 500,
  status: "Al día",
}

afterEach(() => {
  cleanup()
})

test("the yard shows the hours left until the cut", () => {
  const truck: Equipment = {
    id: "3",
    code: "CM-014",
    type: "camion",
    horometerHours: 1400,
    cycleStartHours: 1200,
    intervalHours: 250,
    status: "Al día",
  }

  render(<Yard equipment={[due, truck]} onCreate={async () => {}} />)

  expect(screen.getByText("Faltan 50 h para el corte")).toBeTruthy()
  expect(screen.getAllByText(/Faltan/).length).toBe(1)
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
  expect(within(rows[0]).getByRole("button", { name: "Anotar mantenimiento" }).classList.contains("quiet")).toBe(false)
  expect(within(rows[1]).getByRole("button", { name: "Anotar mantenimiento" }).classList.contains("quiet")).toBe(true)
})

test("a maintenance recorded from the yard keeps its place in the history", () => {
  const onMaintain = vi.fn().mockResolvedValue(undefined)
  render(
    <Yard
      equipment={[due]}
      history={{ "1": [{ id: "m1", horometerHours: 250 }] }}
      onCreate={async () => {}}
      onMaintain={onMaintain}
    />,
  )

  fireEvent.click(screen.getByRole("button", { name: "Anotar mantenimiento" }))

  expect(onMaintain).toHaveBeenCalledWith("1")
  expect(screen.getByText("Anotado en 250 h")).toBeTruthy()
})

test("a horometer edited below the cycle stays on the machine", async () => {
  const onUpdate = vi.fn().mockRejectedValue(new Error("horometer_below_cycle"))
  render(<Yard equipment={[due]} onCreate={async () => {}} onUpdate={onUpdate} />)

  fireEvent.click(screen.getByRole("button", { name: "Cambiar" }))
  fireEvent.change(screen.getByLabelText("Horómetro de CM-099"), { target: { value: "100" } })
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

  expect(onUpdate).toHaveBeenCalledWith("1", { code: "CM-099", type: "camion", horometerHours: 100 })
  expect((await screen.findByRole("alert")).textContent).toBe(
    "El horómetro no puede quedar detrás del inicio del ciclo.",
  )
  expect(screen.getByText("250 h")).toBeTruthy()
})

test("removing a machine asks once and then takes it off the yard", () => {
  const onDelete = vi.fn().mockResolvedValue(undefined)
  render(<Yard equipment={[current]} onCreate={async () => {}} onDelete={onDelete} />)

  fireEvent.click(screen.getByRole("button", { name: "Sacar del patio" }))
  expect(onDelete).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
  expect(onDelete).toHaveBeenCalledWith("2")
})

test("an empty horometer does not add a machine", () => {
  const onCreate = vi.fn()
  render(<Yard equipment={[]} onCreate={onCreate} />)

  fireEvent.change(screen.getByLabelText("Código"), { target: { value: "CM-014" } })
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))

  expect(onCreate).not.toHaveBeenCalled()
  expect(screen.getByRole("alert").textContent).toBe("El horómetro se anota en horas enteras, solo números.")
})

test("a script or too many characters do not enter the yard", () => {
  const onCreate = vi.fn()
  render(<Yard equipment={[]} onCreate={onCreate} />)

  fireEvent.change(screen.getByLabelText("Código"), { target: { value: "<script>alert(1)</script>" } })
  fireEvent.change(screen.getByLabelText("Horómetro"), { target: { value: "1200" } })
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))

  expect(onCreate).not.toHaveBeenCalled()
  expect(screen.getByRole("alert").textContent).toBe("El código usa letras, números y guiones, hasta 32.")

  fireEvent.change(screen.getByLabelText("Código"), { target: { value: "A".repeat(33) } })
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))
  expect(onCreate).not.toHaveBeenCalled()
})

test("letters or too many hours do not pass as a horometer", () => {
  const onCreate = vi.fn()
  render(<Yard equipment={[]} onCreate={onCreate} />)

  fireEvent.change(screen.getByLabelText("Código"), { target: { value: "CM-014" } })
  fireEvent.change(screen.getByLabelText("Horómetro"), { target: { value: "1200 h" } })
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))

  expect(onCreate).not.toHaveBeenCalled()
  expect(screen.getByRole("alert").textContent).toBe("El horómetro se anota en horas enteras, solo números.")

  fireEvent.change(screen.getByLabelText("Horómetro"), { target: { value: "9999999999" } })
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))
  expect(screen.getByRole("alert").textContent).toBe("El horómetro no admite tantas horas.")
})

test("a code is shown as text", () => {
  render(
    <Yard
      equipment={[{ ...current, code: "<script>alert(1)</script>" }]}
      onCreate={async () => {}}
    />,
  )

  expect(document.querySelector("script")).toBeNull()
  expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy()
})

test("clicking a field shows green when it fits and red when dar de alta finds it wrong", () => {
  const onCreate = vi.fn()
  render(<Yard equipment={[]} onCreate={onCreate} />)
  const code = screen.getByLabelText("Código")
  const hours = screen.getByLabelText("Horómetro")

  fireEvent.focus(code)
  expect(screen.getByText("El código usa letras, números y guiones, hasta 32.")).toBeTruthy()
  expect(code.className).not.toContain("bad")

  fireEvent.change(code, { target: { value: "CM-014" } })
  expect(code.className).toContain("good")
  expect(screen.getByText("El código sirve.")).toBeTruthy()

  fireEvent.change(hours, { target: { value: "1200 h" } })
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))

  expect(onCreate).not.toHaveBeenCalled()
  expect(hours.className).toContain("bad")
  expect(screen.getByRole("alert").textContent).toBe("El horómetro se anota en horas enteras, solo números.")
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
  expect(screen.getByText("El patio está vacío. Anota el código y las horas con las que llega.")).toBeTruthy()
})

test("the alta holds its button until the machine is saved", async () => {
  let release: () => void = () => {}
  const onCreate = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve
      }),
  )
  render(<Yard equipment={[]} onCreate={onCreate} />)

  fireEvent.change(screen.getByLabelText("Código"), { target: { value: "CM-014" } })
  fireEvent.change(screen.getByLabelText("Horómetro"), { target: { value: "1200" } })
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))

  const waiting = await screen.findByRole("button", { name: "Dando de alta…" })
  expect((waiting as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(waiting)
  expect(onCreate).toHaveBeenCalledTimes(1)

  release()
  expect(await screen.findByRole("button", { name: "Dar de alta" })).toBeTruthy()
})

test("maintenance holds its button until the note is saved", async () => {
  let release: () => void = () => {}
  const onMaintain = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve
      }),
  )
  render(<Yard equipment={[due]} onCreate={async () => {}} onMaintain={onMaintain} />)

  fireEvent.click(screen.getByRole("button", { name: "Anotar mantenimiento" }))

  const waiting = await screen.findByRole("button", { name: "Anotando…" })
  expect((waiting as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(waiting)
  expect(onMaintain).toHaveBeenCalledTimes(1)

  release()
  expect(await screen.findByRole("button", { name: "Anotar mantenimiento" })).toBeTruthy()
})
