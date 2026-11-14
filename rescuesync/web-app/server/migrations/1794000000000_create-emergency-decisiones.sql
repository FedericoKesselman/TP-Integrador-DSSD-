-- Up Migration
CREATE TABLE emergency_decisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id UUID NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
  camino TEXT NOT NULL CHECK (camino IN ('continuar', 'reabrir', 'reformular')),
  decided_by TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX emergency_decisiones_emergency_id_idx ON emergency_decisiones (emergency_id);
-- Down Migration
DROP TABLE emergency_decisiones;
