import { useId, useState, type FormEvent } from "react"

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

const hourLimit = 2_147_483_647
const codePattern = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/
const codeRule = "El código usa letras, números y guiones, hasta 32."
const hoursRule = "El horómetro se anota en horas enteras, solo números."

function codeProblem(code: string): string {
  const trimmed = code.trim()
  if (!codePattern.test(trimmed) || trimmed.length > 32) return codeRule
  return ""
}

function hoursProblem(horometer: string): string {
  if (!/^\d+$/.test(horometer.trim())) return hoursRule
  if (Number(horometer) > hourLimit) return "El horómetro no admite tantas horas."
  return ""
}

function reading(code: string, horometer: string): { code: string; horometerHours: number } | string {
  const codeIssue = codeProblem(code)
  if (codeIssue) return codeIssue
  const hoursIssue = hoursProblem(horometer)
  if (hoursIssue) return hoursIssue
  return { code: code.trim(), horometerHours: Number(horometer) }
}

type Tone = "" | "hint" | "good" | "bad"

function tone(value: string, issue: string, seen: boolean, submitted: boolean): Tone {
  if (!seen && !submitted) return ""
  if (!issue) return "good"
  if (submitted || value.trim() !== "") return "bad"
  return "hint"
}

function useMarks(code: string, horometer: string) {
  const [codeSeen, setCodeSeen] = useState(false)
  const [hoursSeen, setHoursSeen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [codeFault, setCodeFault] = useState("")
  const [hoursFault, setHoursFault] = useState("")
  const codeIssue = codeFault || codeProblem(code)
  const hoursIssue = hoursFault || hoursProblem(horometer)

  return {
    codeTone: tone(code, codeIssue, codeSeen, submitted),
    hoursTone: tone(horometer, hoursIssue, hoursSeen, submitted),
    codeText: codeFault || (codeProblem(code) ? codeRule : "El código sirve."),
    hoursText: hoursFault || hoursProblem(horometer) || "Horas enteras.",
    seeCode: () => setCodeSeen(true),
    seeHours: () => setHoursSeen(true),
    editCode: () => setCodeFault(""),
    editHours: () => setHoursFault(""),
    reject: () => setSubmitted(true),
    fail(caught: unknown) {
      if (!(caught instanceof Error)) return false
      if (caught.message === "duplicate_code") {
        setCodeFault("Ese código ya está en el patio.")
        setSubmitted(true)
        return true
      }
      if (caught.message === "horometer_below_cycle") {
        setHoursFault("El horómetro no puede quedar detrás del inicio del ciclo.")
        setSubmitted(true)
        return true
      }
      return false
    },
    reset() {
      setSubmitted(false)
      setCodeSeen(false)
      setHoursSeen(false)
      setCodeFault("")
      setHoursFault("")
    },
  }
}

function FieldNote({ id, tone: fieldTone, text }: { id: string; tone: Tone; text: string }) {
  if (!fieldTone) return null
  return (
    <p id={id} className={`mark ${fieldTone}`} role={fieldTone === "bad" ? "alert" : undefined}>
      {text}
    </p>
  )
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
  const codeId = useId()
  const codeHint = useId()
  const typeId = useId()
  const hoursId = useId()
  const hoursHint = useId()
  const marks = useMarks(code, horometer)
  const dueCount = equipment.filter((item) => item.status === "Requiere mantenimiento").length

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const parsed = reading(code, horometer)
    if (typeof parsed === "string") {
      marks.reject()
      return
    }
    setSaving(true)
    try {
      await onCreate({ ...parsed, type })
      setCode("")
      setHorometer("")
      setError("")
      marks.reset()
    } catch (caught) {
      if (!marks.fail(caught)) setError(message(caught))
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
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={codeId}>Código</label>
          <input
            id={codeId}
            className={marks.codeTone === "good" || marks.codeTone === "bad" ? marks.codeTone : undefined}
            value={code}
            onFocus={marks.seeCode}
            onChange={(event) => {
              setCode(event.target.value)
              marks.seeCode()
              marks.editCode()
            }}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={32}
            disabled={saving}
            aria-invalid={marks.codeTone === "bad"}
            aria-describedby={codeHint}
          />
          <FieldNote id={codeHint} tone={marks.codeTone} text={marks.codeText} />
        </div>
        <div className="field">
          <label htmlFor={typeId}>Tipo</label>
          <select
            id={typeId}
            value={type}
            onChange={(event) => setType(event.target.value as Equipment["type"])}
            disabled={saving}
          >
            <option value="camion">Camión</option>
            <option value="excavadora">Excavadora</option>
            <option value="perforadora">Perforadora</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={hoursId}>Horómetro</label>
          <input
            id={hoursId}
            className={marks.hoursTone === "good" || marks.hoursTone === "bad" ? marks.hoursTone : undefined}
            value={horometer}
            onFocus={marks.seeHours}
            onChange={(event) => {
              setHorometer(event.target.value)
              marks.seeHours()
              marks.editHours()
            }}
            inputMode="numeric"
            maxLength={10}
            disabled={saving}
            aria-invalid={marks.hoursTone === "bad"}
            aria-describedby={hoursHint}
          />
          <FieldNote id={hoursHint} tone={marks.hoursTone} text={marks.hoursText} />
        </div>
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
  const codeId = useId()
  const codeHint = useId()
  const typeId = useId()
  const hoursId = useId()
  const hoursHint = useId()
  const marks = useMarks(code, horometer)
  const due = item.status === "Requiere mantenimiento"
  const left = item.cycleStartHours + item.intervalHours - item.horometerHours

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const parsed = reading(code, horometer)
    if (typeof parsed === "string") {
      marks.reject()
      return
    }
    setBusy("save")
    try {
      await onUpdate(item.id, { ...parsed, type })
      setEditing(false)
      setError("")
      marks.reset()
    } catch (caught) {
      if (!marks.fail(caught)) setError(message(caught))
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
        <form className="edit" onSubmit={save} noValidate>
          <div className="field">
            <label htmlFor={codeId}>Código</label>
            <input
              id={codeId}
              className={marks.codeTone === "good" || marks.codeTone === "bad" ? marks.codeTone : undefined}
              aria-label={`Código de ${item.code}`}
              value={code}
              onFocus={marks.seeCode}
              onChange={(event) => {
                setCode(event.target.value)
                marks.seeCode()
                marks.editCode()
              }}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={32}
              disabled={busy !== ""}
              aria-invalid={marks.codeTone === "bad"}
              aria-describedby={codeHint}
            />
            <FieldNote id={codeHint} tone={marks.codeTone} text={marks.codeText} />
          </div>
          <div className="field">
            <label htmlFor={typeId}>Tipo</label>
            <select
              id={typeId}
              aria-label={`Tipo de ${item.code}`}
              value={type}
              disabled={busy !== ""}
              onChange={(event) => setType(event.target.value as Equipment["type"])}
            >
              <option value="camion">Camión</option>
              <option value="excavadora">Excavadora</option>
              <option value="perforadora">Perforadora</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={hoursId}>Horómetro</label>
            <input
              id={hoursId}
              className={marks.hoursTone === "good" || marks.hoursTone === "bad" ? marks.hoursTone : undefined}
              aria-label={`Horómetro de ${item.code}`}
              value={horometer}
              onFocus={marks.seeHours}
              onChange={(event) => {
                setHorometer(event.target.value)
                marks.seeHours()
                marks.editHours()
              }}
              inputMode="numeric"
              maxLength={10}
              disabled={busy !== ""}
              aria-invalid={marks.hoursTone === "bad"}
              aria-describedby={hoursHint}
            />
            <FieldNote id={hoursHint} tone={marks.hoursTone} text={marks.hoursText} />
          </div>
          <button type="submit" disabled={busy !== ""} aria-busy={busy === "save"}>
            {busy === "save" ? "Guardando…" : "Guardar"}
          </button>
        </form>
      ) : null}
      {notes.length > 0 ? (
        <div className="notes">
          {notes.map((note) => (
            <p key={note.id} className="note">
              Anotado en {note.horometerHours} h
            </p>
          ))}
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </li>
  )
}
