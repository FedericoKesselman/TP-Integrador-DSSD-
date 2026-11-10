-- Up Migration

-- E5-10 / E5-11: todo lo que necesita el ciclo completo de una emergencia
-- (validación, decisión, adjudicación, ejecución, cierre). Ver
-- docs/api-contracts.md y roadmapfase5.md.

-- 1. Estados ampliados --------------------------------------------------------
ALTER TABLE emergencies DROP CONSTRAINT IF EXISTS emergencies_status_check;
ALTER TABLE emergencies ADD CONSTRAINT emergencies_status_check CHECK (
  status IN (
    'registrada', 'convocatoria_abierta', 'convocatoria_cerrada',
    'validada', 'adjudicada', 'en_ejecucion', 'finalizada'
  )
);

ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS ofertas_status_check;
ALTER TABLE ofertas ADD CONSTRAINT ofertas_status_check CHECK (
  status IN (
    'registrada', 'retirada', 'validada', 'adjudicada', 'no_seleccionada', 'finalizada'
  )
);

-- 2. Columnas nuevas en emergencies --------------------------------------------
ALTER TABLE emergencies
  -- Ventana de ofertas elegida por el coordinador al publicar / reabrir.
  ADD COLUMN duracion_convocatoria_min INTEGER CHECK (duracion_convocatoria_min > 0),
  -- Cuenta cuántas veces se publicó la convocatoria; evita avisos duplicados
  -- ante reintentos de Bonita pero permite avisar de nuevo al reabrir.
  ADD COLUMN convocatoria_ronda INTEGER NOT NULL DEFAULT 0,
  -- `resumen` de la última validación del SN (cobertura por lote).
  ADD COLUMN validacion_resumen JSONB,
  -- Detalle del último 409 del SN al registrar el compromiso.
  ADD COLUMN ultimo_conflicto_compromiso JSONB;

UPDATE emergencies SET convocatoria_ronda = 1 WHERE status <> 'registrada';

-- 3. Historial de estados de la emergencia (alimenta el dashboard) -----------------
CREATE TABLE emergency_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id UUID NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX emergency_status_history_emergency_idx
  ON emergency_status_history (emergency_id, changed_at);

INSERT INTO emergency_status_history (emergency_id, from_status, to_status, changed_by, changed_at)
SELECT id, NULL, status, 'migracion', created_at FROM emergencies;

-- 4. Perfil de validación de cada oferta (respuesta del SN) -----------------------
CREATE TABLE oferta_validaciones (
  oferta_id UUID PRIMARY KEY REFERENCES ofertas(id) ON DELETE CASCADE,
  nivel_habilitacion TEXT NOT NULL
    CHECK (nivel_habilitacion IN ('PLENO', 'PARCIAL', 'APOYO', 'SIN_CAPACIDAD')),
  rol_sugerido TEXT NOT NULL CHECK (rol_sugerido IN ('principal', 'apoyo')),
  nivel_riesgo_permitido TEXT NOT NULL
    CHECK (nivel_riesgo_permitido IN ('baja', 'media', 'alta', 'critica')),
  capacidades JSONB NOT NULL DEFAULT '[]'::jsonb,
  observaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER oferta_validaciones_set_updated_at
  BEFORE UPDATE ON oferta_validaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Adjudicación: selección del municipio y reparto confirmado por el SN ----------
-- La selección se guarda acá; las ofertas solo pasan a adjudicada /
-- no_seleccionada cuando el SN confirma el compromiso.
CREATE TABLE adjudicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id UUID NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
  oferta_id UUID NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  compromiso_id TEXT,
  reparto JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (emergency_id, oferta_id)
);

-- 6. Finalización de ofertas por parte de la ONG ---------------------------------
CREATE TABLE oferta_finalizaciones (
  oferta_id UUID PRIMARY KEY REFERENCES ofertas(id) ON DELETE CASCADE,
  ong_id UUID NOT NULL REFERENCES ongs(id) ON DELETE RESTRICT,
  finalizada_by TEXT,
  finalizada_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Avisos: tipos, ronda y lectura --------------------------------------------
ALTER TABLE notifications
  ADD COLUMN tipo TEXT NOT NULL DEFAULT 'CONVOCATORIA' CHECK (
    tipo IN (
      'CONVOCATORIA', 'CIERRE_CONVOCATORIA', 'OFERTA_RETIRADA', 'ADJUDICADA', 'NO_SELECCIONADA'
    )
  ),
  ADD COLUMN ronda INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN leida_at TIMESTAMPTZ;

ALTER TABLE notifications DROP CONSTRAINT notifications_emergency_id_ong_id_key;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_emergency_ong_tipo_ronda_key
  UNIQUE (emergency_id, ong_id, tipo, ronda);

CREATE INDEX notifications_ong_id_idx ON notifications (ong_id, created_at DESC);

-- 8. lotes.resource_code (E5-11) -------------------------------------------------
-- Los lotes cargados antes de existir el código se borran y se recargan (no se
-- rellenan): arrastran sus renglones de oferta y, si una oferta se queda sin
-- renglones, también se borra. Las emergencias que se quedan sin lotes vuelven
-- a `registrada` para poder armarlos de nuevo.
ALTER TABLE lotes ADD COLUMN resource_code TEXT;

DELETE FROM oferta_lotes WHERE lote_id IN (SELECT id FROM lotes WHERE resource_code IS NULL);
DELETE FROM ofertas o WHERE NOT EXISTS (SELECT 1 FROM oferta_lotes ol WHERE ol.oferta_id = o.id);
DELETE FROM lotes WHERE resource_code IS NULL;
UPDATE emergencies e
  SET status = 'registrada', convocatoria_ronda = 0
  WHERE e.status <> 'registrada'
    AND NOT EXISTS (SELECT 1 FROM lotes l WHERE l.emergency_id = e.id);

ALTER TABLE lotes ALTER COLUMN resource_code SET NOT NULL;

-- Down Migration

ALTER TABLE lotes DROP COLUMN IF EXISTS resource_code;

DROP INDEX IF EXISTS notifications_ong_id_idx;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_emergency_ong_tipo_ronda_key;
DELETE FROM notifications WHERE tipo <> 'CONVOCATORIA';
DELETE FROM notifications a USING notifications b
  WHERE a.emergency_id = b.emergency_id
    AND a.ong_id = b.ong_id
    AND (a.created_at, a.id) > (b.created_at, b.id);
ALTER TABLE notifications
  DROP COLUMN IF EXISTS leida_at,
  DROP COLUMN IF EXISTS ronda,
  DROP COLUMN IF EXISTS tipo;
ALTER TABLE notifications ADD CONSTRAINT notifications_emergency_id_ong_id_key
  UNIQUE (emergency_id, ong_id);

DROP TABLE IF EXISTS oferta_finalizaciones;
DROP TABLE IF EXISTS adjudicaciones;
DROP TABLE IF EXISTS oferta_validaciones;
DROP TABLE IF EXISTS emergency_status_history;

ALTER TABLE emergencies
  DROP COLUMN IF EXISTS ultimo_conflicto_compromiso,
  DROP COLUMN IF EXISTS validacion_resumen,
  DROP COLUMN IF EXISTS convocatoria_ronda,
  DROP COLUMN IF EXISTS duracion_convocatoria_min;

-- Los estados nuevos no existen en el CHECK viejo: se llevan al más cercano.
UPDATE ofertas SET status = 'registrada'
  WHERE status IN ('validada', 'adjudicada', 'no_seleccionada', 'finalizada');
UPDATE emergencies SET status = 'convocatoria_cerrada'
  WHERE status IN ('validada', 'adjudicada', 'en_ejecucion', 'finalizada');

ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS ofertas_status_check;
ALTER TABLE ofertas ADD CONSTRAINT ofertas_status_check
  CHECK (status IN ('registrada', 'retirada'));

ALTER TABLE emergencies DROP CONSTRAINT IF EXISTS emergencies_status_check;
ALTER TABLE emergencies ADD CONSTRAINT emergencies_status_check
  CHECK (status IN ('registrada', 'convocatoria_abierta', 'convocatoria_cerrada'));
