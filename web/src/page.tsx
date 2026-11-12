import { useEffect, useState } from "react"

import { createEquipment, deleteEquipment, listEquipment, listMaintenance, recordMaintenance, updateEquipment } from "./api.js"
import { Yard, type Equipment, type MaintenanceNote } from "./yard.js"

export function Page() {
  const [equipment, setEquipment] = useState<Equipment[] | null>(null)
  const [history, setHistory] = useState<Record<string, MaintenanceNote[]>>({})
  const [loadError, setLoadError] = useState(false)

  async function reload() {
    try {
      const listed = await listEquipment()
      const notes = await Promise.all(
        listed.map(async (item) => {
          try {
            return [item.id, await listMaintenance(item.id)] as const
          } catch {
            return [item.id, []] as const
          }
        }),
      )
      setEquipment(listed)
      setHistory(Object.fromEntries(notes))
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  if (loadError) return <p role="alert">No se pudo leer el patio.</p>
  if (!equipment) return <p>Cargando el patio.</p>

  return (
    <Yard
      equipment={equipment}
      history={history}
      onCreate={async (input) => {
        await createEquipment(input)
        await reload()
      }}
      onUpdate={async (id, input) => {
        await updateEquipment(id, input)
        await reload()
      }}
      onDelete={async (id) => {
        await deleteEquipment(id)
        await reload()
      }}
      onMaintain={async (id) => {
        await recordMaintenance(id)
        await reload()
      }}
    />
  )
}
