-- Up Migration
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id UUID NOT NULL REFERENCES emergencies(id),
  ong_id UUID NOT NULL REFERENCES ongs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (emergency_id, ong_id)
);
-- Down Migration
DROP TABLE notifications;
