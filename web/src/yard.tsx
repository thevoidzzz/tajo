import { useState, type FormEvent } from "react"

export type Equipment = {
  id: string
  code: string
  type: "camion" | "excavadora" | "perforadora"
  horometerHours: number
  cycleStartHours: number
  intervalHours: number
  status: "Requiere mantenimiento" | "Al día"
}

export type MaintenanceNote = {
  id: string
  horometerHours: number
}

export type EquipmentChange = {
  code: string
  type: Equipment["type"]
  horometerHours: number
}

const typeName: Record<Equipment["type"], string> = {
  camion: "Camión",
  excavadora: "Excavadora",
  perforadora: "Perforadora",
}

function message(caught: unknown): string {
  if (caught instanceof Error && caught.message === "horometer_below_cycle") {
    return "El horómetro no puede quedar detrás del inicio del ciclo."
  }
  if (caught instanceof Error && caught.message === "duplicate_code") {
    return "Ese código ya está en el patio."
  }
  return "Revisa el código, el tipo y el horómetro."
}

export function Yard({
  equipment,
  history = {},
  onCreate,
  onUpdate = async () => {},
  onDelete = async () => {},
  onMaintain = async () => {},
}: {
  equipment: Equipment[]
  history?: Record<string, MaintenanceNote[]>
  onCreate: (input: EquipmentChange) => Promise<void>
  onUpdate?: (id: string, input: EquipmentChange) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onMaintain?: (id: string) => Promise<void>
}) {
  const [code, setCode] = useState("")
  const [type, setType] = useState<Equipment["type"]>("camion")
  const [horometer, setHorometer] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const dueCount = equipment.filter((item) => item.status === "Requiere mantenimiento").length

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const hours = Number(horometer)
    if (code.trim() === "" || horometer.trim() === "" || !Number.isInteger(hours) || hours < 0) {
      setError("Revisa el código, el tipo y el horómetro.")
      return
    }
    setSaving(true)
    try {
      await onCreate({ code: code.trim(), type, horometerHours: hours })
      setCode("")
      setHorometer("")
      setError("")
    } catch (caught) {
      setError(message(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="board">
      <h1>Patio</h1>
      {dueCount === 1 ? <p className="tally">1 requiere mantenimiento</p> : null}
      {dueCount > 1 ? <p className="tally">{dueCount} requieren mantenimiento</p> : null}
      {equipment.length === 0 ? (
        <p className="empty">El patio está vacío. Anota el código y las horas con las que llega.</p>
      ) : (
        <ul className="yard">
          {equipment.map((item) => (
            <Machine
              key={item.id}
              item={item}
              notes={history[item.id] ?? []}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onMaintain={onMaintain}
            />
          ))}
        </ul>
      )}
      <form onSubmit={submit}>
        <label>
          Código
          <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" disabled={saving} />
        </label>
        <label>
          Tipo
          <select
            value={type}
            onChange={(event) => setType(event.target.value as Equipment["type"])}
            disabled={saving}
          >
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
            disabled={saving}
          />
        </label>
        <button type="submit" disabled={saving} aria-busy={saving}>
          {saving ? "Dando de alta…" : "Dar de alta"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  )
}

function Machine({
  item,
  notes,
  onUpdate,
  onDelete,
  onMaintain,
}: {
  item: Equipment
  notes: MaintenanceNote[]
  onUpdate: (id: string, input: EquipmentChange) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onMaintain: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [code, setCode] = useState(item.code)
  const [type, setType] = useState(item.type)
  const [horometer, setHorometer] = useState(String(item.horometerHours))
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<"" | "maintain" | "save" | "delete">("")
  const due = item.status === "Requiere mantenimiento"
  const left = item.cycleStartHours + item.intervalHours - item.horometerHours

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const hours = Number(horometer)
    if (code.trim() === "" || horometer.trim() === "" || !Number.isInteger(hours) || hours < 0) {
      setError("Revisa el código, el tipo y el horómetro.")
      return
    }
    setBusy("save")
    try {
      await onUpdate(item.id, { code: code.trim(), type, horometerHours: hours })
      setEditing(false)
      setError("")
    } catch (caught) {
      setError(message(caught))
    } finally {
      setBusy("")
    }
  }

  function run(kind: "maintain" | "delete", action: () => Promise<void>) {
    if (busy) return
    setBusy(kind)
    void action()
      .then(() => setError(""))
      .catch((caught: unknown) => setError(message(caught)))
      .finally(() => setBusy(""))
  }

  return (
    <li className={due ? "entry due" : "entry"}>
      <div className="machine">
        <span className="code">{item.code}</span>
        <span className="kind">{typeName[item.type]}</span>
        <span className="hours">
          {item.horometerHours} h
          {left > 0 ? (
            <span className="left">{left === 1 ? "Falta 1 h para el corte" : `Faltan ${left} h para el corte`}</span>
          ) : null}
        </span>
        <span className={due ? "status due" : "status"}>{item.status}</span>
      </div>
      <div className="actions">
        <button
          type="button"
          className={due ? undefined : "quiet"}
          disabled={busy !== ""}
          aria-busy={busy === "maintain"}
          onClick={() => run("maintain", () => onMaintain(item.id))}
        >
          {busy === "maintain" ? "Anotando…" : "Anotar mantenimiento"}
        </button>
        {editing ? null : (
          <button
            type="button"
            className="quiet"
            disabled={busy !== ""}
            onClick={() => {
              setCode(item.code)
              setType(item.type)
              setHorometer(String(item.horometerHours))
              setEditing(true)
              setError("")
            }}
          >
            Cambiar
          </button>
        )}
        {confirming ? (
          <>
            <button
              type="button"
              disabled={busy !== ""}
              aria-busy={busy === "delete"}
              onClick={() => run("delete", () => onDelete(item.id))}
            >
              {busy === "delete" ? "Sacando…" : "Confirmar"}
            </button>
            <button type="button" className="quiet" disabled={busy !== ""} onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className="quiet" disabled={busy !== ""} onClick={() => setConfirming(true)}>
            Sacar del patio
          </button>
        )}
      </div>
      {editing ? (
        <form className="edit" onSubmit={save}>
          <label>
            Código
            <input
              aria-label={`Código de ${item.code}`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={busy !== ""}
            />
          </label>
          <label>
            Tipo
            <select
              aria-label={`Tipo de ${item.code}`}
              value={type}
              disabled={busy !== ""}
              onChange={(event) => setType(event.target.value as Equipment["type"])}
            >
              <option value="camion">Camión</option>
              <option value="excavadora">Excavadora</option>
              <option value="perforadora">Perforadora</option>
            </select>
          </label>
          <label>
            Horómetro
            <input
              aria-label={`Horómetro de ${item.code}`}
              value={horometer}
              onChange={(event) => setHorometer(event.target.value)}
              inputMode="numeric"
              disabled={busy !== ""}
            />
          </label>
          <button type="submit" disabled={busy !== ""} aria-busy={busy === "save"}>
            {busy === "save" ? "Guardando…" : "Guardar"}
          </button>
        </form>
      ) : null}
      {notes.map((note) => (
        <p key={note.id} className="note">
          Anotado en {note.horometerHours} h
        </p>
      ))}
      {error ? <p role="alert">{error}</p> : null}
    </li>
  )
}
