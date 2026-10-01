-- Up Migration

-- Entidades de dominio correspondientes a los representantes de ONG
-- definidos en la organización de prueba de Bonita.
CREATE UNIQUE INDEX ongs_bonita_org_ref_uidx
  ON ongs (bonita_org_ref)
  WHERE bonita_org_ref IS NOT NULL;

INSERT INTO ongs (name, bonita_org_ref)
VALUES
  ('Rescatistas Unidos', 'rescatistas-unidos'),
  ('Manos Solidarias', 'manos-solidarias')
ON CONFLICT (bonita_org_ref) WHERE bonita_org_ref IS NOT NULL DO NOTHING;

-- Down Migration

DELETE FROM ongs
WHERE bonita_org_ref IN ('rescatistas-unidos', 'manos-solidarias');

DROP INDEX IF EXISTS ongs_bonita_org_ref_uidx;
