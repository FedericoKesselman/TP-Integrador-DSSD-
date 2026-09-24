-- Up Migration

-- Función genérica para mantener "updated_at" al día en cada UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Emergencias registradas por el Operador Municipal.
-- Enums (type, severity) documentados en docs/api-contracts.md y en
-- web-app/shared/emergency-validation.js (fuente única; client y server
-- derivan de ahí) — si cambian, actualizar los tres lugares.
CREATE TABLE emergencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('inundacion', 'incendio', 'terremoto', 'otro')),
  type_other TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('baja', 'media', 'alta', 'critica')),
  province_id TEXT NOT NULL,
  province TEXT NOT NULL,
  municipality_id TEXT,
  municipality TEXT NOT NULL,
  affected_zone TEXT NOT NULL,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  occurred_at TIMESTAMPTZ NOT NULL,
  estimated_affected_people INTEGER CHECK (estimated_affected_people >= 0),
  description TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  -- Estados mínimos para esta etapa; se van a sumar más a medida que se
  -- integre la validación/adjudicación con Bonita y el Sistema Nacional.
  status TEXT NOT NULL DEFAULT 'registrada'
    CHECK (status IN ('registrada', 'convocatoria_abierta', 'convocatoria_cerrada')),
  bonita_case_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (type <> 'otro' OR type_other IS NOT NULL),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE TRIGGER emergencies_set_updated_at
  BEFORE UPDATE ON emergencies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Lotes de Necesidades: desglose de una emergencia hecho por el
-- Centro Coordinador Regional (ej: 5 Paramédicos, 1000 raciones).
CREATE TABLE lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id UUID NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  unit TEXT,
  quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lotes_emergency_id_idx ON lotes (emergency_id);

CREATE TRIGGER lotes_set_updated_at
  BEFORE UPDATE ON lotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ONGs de la red: entidad de dominio (no de autenticación). Los usuarios
-- y roles viven en la organización de Bonita, no acá — ver
-- roadmapfase2.md, sección "Autenticación".
CREATE TABLE ongs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bonita_org_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER ongs_set_updated_at
  BEFORE UPDATE ON ongs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ofertas de Ayuda cargadas por una o varias ONGs para una emergencia.
CREATE TABLE ofertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id UUID NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registrada' CHECK (status IN ('registrada', 'retirada')),
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ofertas_emergency_id_idx ON ofertas (emergency_id);

CREATE TRIGGER ofertas_set_updated_at
  BEFORE UPDATE ON ofertas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Consorcio: qué ONGs conforman una misma oferta (una oferta puede tener
-- una sola ONG o varias asociadas).
CREATE TABLE oferta_ongs (
  oferta_id UUID NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  ong_id UUID NOT NULL REFERENCES ongs(id) ON DELETE RESTRICT,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (oferta_id, ong_id)
);

CREATE INDEX oferta_ongs_ong_id_idx ON oferta_ongs (ong_id);

-- Qué lotes cubre una oferta y con qué cantidad (permite ofertas
-- parciales, sobre uno o varios lotes).
CREATE TABLE oferta_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT,
  quantity_offered INTEGER NOT NULL CHECK (quantity_offered > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (oferta_id, lote_id)
);

CREATE INDEX oferta_lotes_lote_id_idx ON oferta_lotes (lote_id);

CREATE TRIGGER oferta_lotes_set_updated_at
  BEFORE UPDATE ON oferta_lotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trazabilidad de ofertas: una fila por cada versión guardada cuando una
-- ONG edita/actualiza su oferta (requisito del enunciado, sección
-- "Gestión de Versiones de Ofertas"). "changed_by" queda como texto
-- libre (id/usuario de Bonita) y sin FK, porque los usuarios no viven
-- en una tabla local.
CREATE TABLE oferta_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (oferta_id, version)
);

CREATE INDEX oferta_historial_oferta_id_idx ON oferta_historial (oferta_id);

-- Down Migration

DROP TABLE IF EXISTS oferta_historial;
DROP TABLE IF EXISTS oferta_lotes;
DROP TABLE IF EXISTS oferta_ongs;
DROP TABLE IF EXISTS ofertas;
DROP TABLE IF EXISTS ongs;
DROP TABLE IF EXISTS lotes;
DROP TABLE IF EXISTS emergencies;
DROP FUNCTION IF EXISTS set_updated_at();
