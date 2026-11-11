import type { Equipment } from "./yard.js"

const base = import.meta.env.VITE_API_URL ?? ""

export async function listEquipment(): Promise<Equipment[]> {
  const response = await fetch(`${base}/equipment`)
  if (!response.ok) throw new Error("list_failed")
  return response.json() as Promise<Equipment[]>
}

export async function createEquipment(input: {
  code: string
  type: Equipment["type"]
  horometerHours: number
}): Promise<void> {
  const response = await fetch(`${base}/equipment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (response.status === 409) throw new Error("duplicate_code")
  if (!response.ok) throw new Error("invalid_body")
}
