CREATE TABLE maintenance (
  maintenance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES equipment (equipment_id) ON DELETE CASCADE,
  horometer_hours integer NOT NULL CHECK (horometer_hours >= 0),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
