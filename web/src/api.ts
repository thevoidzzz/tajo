import type { Equipment, EquipmentChange, MaintenanceNote } from "./yard.js"

const base = import.meta.env.VITE_API_URL ?? ""

export async function listEquipment(): Promise<Equipment[]> {
  const response = await fetch(`${base}/equipment`)
  if (!response.ok) throw new Error("list_failed")
  return response.json() as Promise<Equipment[]>
}

export async function createEquipment(input: EquipmentChange): Promise<void> {
  const response = await fetch(`${base}/equipment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (response.status === 409) throw new Error("duplicate_code")
  if (!response.ok) throw new Error("invalid_body")
}

export async function updateEquipment(id: string, input: EquipmentChange): Promise<void> {
  const response = await fetch(`${base}/equipment/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (response.status === 422) throw new Error("horometer_below_cycle")
  if (response.status === 409) throw new Error("duplicate_code")
  if (!response.ok) throw new Error("invalid_body")
}

export async function deleteEquipment(id: string): Promise<void> {
  const response = await fetch(`${base}/equipment/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error("not_found")
}

export async function recordMaintenance(id: string): Promise<void> {
  const response = await fetch(`${base}/equipment/${id}/maintenance`, { method: "POST" })
  if (!response.ok) throw new Error("invalid_body")
}

export async function listMaintenance(id: string): Promise<MaintenanceNote[]> {
  const response = await fetch(`${base}/equipment/${id}/maintenance`)
  if (!response.ok) throw new Error("list_failed")
  return response.json() as Promise<MaintenanceNote[]>
}
