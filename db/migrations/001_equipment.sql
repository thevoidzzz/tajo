CREATE TABLE equipment_type (
  type_code text PRIMARY KEY,
  interval_hours integer NOT NULL CHECK (interval_hours > 0)
);

INSERT INTO equipment_type (type_code, interval_hours) VALUES
  ('camion', 250),
  ('excavadora', 500),
  ('perforadora', 200);

CREATE TABLE equipment (
  equipment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type_code text NOT NULL REFERENCES equipment_type (type_code),
  horometer_hours integer NOT NULL CHECK (horometer_hours >= 0),
  cycle_start_hours integer NOT NULL CHECK (cycle_start_hours >= 0),
  CONSTRAINT equipment_horometer_covers_cycle CHECK (horometer_hours >= cycle_start_hours)
);
