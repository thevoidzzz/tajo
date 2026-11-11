import { useState, type FormEvent } from "react"

export type Equipment = {
  id: string
  code: string
  type: "camion" | "excavadora" | "perforadora"
  horometerHours: number
  status: "Requiere mantenimiento" | "Al día"
}

const typeName: Record<Equipment["type"], string> = {
  camion: "Camión",
  excavadora: "Excavadora",
  perforadora: "Perforadora",
}

export function Yard({
  equipment,
  onCreate,
}: {
  equipment: Equipment[]
  onCreate: (input: { code: string; type: Equipment["type"]; horometerHours: number }) => Promise<void>
}) {
  const [code, setCode] = useState("")
  const [type, setType] = useState<Equipment["type"]>("camion")
  const [horometer, setHorometer] = useState("")
  const [error, setError] = useState("")
  const dueCount = equipment.filter((item) => item.status === "Requiere mantenimiento").length

  async function submit(event: FormEvent) {
    event.preventDefault()
    const hours = Number(horometer)
    if (code.trim() === "" || horometer.trim() === "" || !Number.isInteger(hours) || hours < 0) {
      setError("Revisa el código, el tipo y el horómetro.")
      return
    }
    try {
      await onCreate({ code: code.trim(), type, horometerHours: hours })
      setCode("")
      setHorometer("")
      setError("")
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === "duplicate_code"
          ? "Ese código ya está en el patio."
          : "Revisa el código, el tipo y el horómetro.",
      )
    }
  }

  return (
    <main className="board">
      <h1>Patio</h1>
      {dueCount === 1 ? <p className="tally">1 requiere mantenimiento</p> : null}
      {dueCount > 1 ? <p className="tally">{dueCount} requieren mantenimiento</p> : null}
      {equipment.length === 0 ? (
        <p className="empty">El patio está vacío.</p>
      ) : (
        <ul className="yard">
          {equipment.map((item) => {
            const due = item.status === "Requiere mantenimiento"
            return (
              <li key={item.id} className={due ? "machine due" : "machine"}>
                <span className="code">{item.code}</span>
                <span className="kind">{typeName[item.type]}</span>
                <span className="hours">{item.horometerHours} h</span>
                <span className={due ? "status due" : "status"}>{item.status}</span>
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={submit}>
        <label>
          Código
          <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" />
        </label>
        <label>
          Tipo
          <select value={type} onChange={(event) => setType(event.target.value as Equipment["type"])}>
            <option value="camion">Camión</option>
            <option value="excavadora">Excavadora</option>
            <option value="perforadora">Perforadora</option>
          </select>
        </label>
        <label>
          Horómetro
          <input
            value={horometer}
            onChange={(event) => setHorometer(event.target.value)}
            inputMode="numeric"
          />
        </label>
        <button type="submit">Dar de alta</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  )
}
