import { useEffect, useState } from "react"

import { createEquipment, listEquipment } from "./api.js"
import { Yard, type Equipment } from "./yard.js"

export function Page() {
  const [equipment, setEquipment] = useState<Equipment[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  async function reload() {
    try {
      setEquipment(await listEquipment())
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
      onCreate={async (input) => {
        await createEquipment(input)
        await reload()
      }}
    />
  )
}
