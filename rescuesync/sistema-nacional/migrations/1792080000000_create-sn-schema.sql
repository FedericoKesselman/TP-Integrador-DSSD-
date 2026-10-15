-- Up Migration

-- Esquema del Sistema Nacional (ver docs/api-contracts-sistema-nacional.md).
-- Guarda ONGs, sus cuentas, su stock y los compromisos de recursos. NO guarda
-- ofertas ni borradores: esos viven en la base de la web-app.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ONGs habilitadas en el SN. `ref` es el slug compartido con la web-app
-- (`ongs.bonita_org_ref` allá, ej. `rescatistas-unidos`).
CREATE TABLE ongs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref TEXT NOT NULL UNIQUE CHECK (ref ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre TEXT NOT NULL,
  nivel_operativo SMALLINT NOT NULL CHECK (nivel_operativo BETWEEN 1 AND 4),
  habilitada BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER ongs_set_updated_at
  BEFORE UPDATE ON ongs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cuentas que pueden pedir un JWT. Rol `integracion` (la usa Bonita) o `ong`
-- (una por ONG, solo ve su propio stock).
CREATE TABLE api_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('integracion', 'ong')),
  ong_id UUID REFERENCES ongs (id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((role = 'ong') = (ong_id IS NOT NULL))
);

CREATE TRIGGER api_clients_set_updated_at
  BEFORE UPDATE ON api_clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Catálogo de recursos. `codigo` = id de web-app/client/src/features/lotes/
-- lote-constants.js (el `recursoCodigo` del contrato). Se carga en la
-- migración siguiente.
CREATE TABLE recursos_catalogo (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL,
  categoria TEXT NOT NULL
);

-- Stock de cada ONG. `id` es secuencial para poder bloquear las filas
-- siempre en el mismo orden (`ORDER BY id ... FOR UPDATE`) y evitar
-- deadlocks entre transacciones concurrentes. El CHECK es la red de
-- seguridad: aunque falle la lógica, la base nunca sobre-asigna.
CREATE TABLE ong_recursos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ong_id UUID NOT NULL REFERENCES ongs (id) ON DELETE CASCADE,
  recurso_codigo TEXT NOT NULL REFERENCES recursos_catalogo (codigo),
  cantidad_total INTEGER NOT NULL CHECK (cantidad_total >= 0),
  cantidad_comprometida INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_comprometida >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ong_id, recurso_codigo),
  CHECK (cantidad_comprometida <= cantidad_total)
);

CREATE TRIGGER ong_recursos_set_updated_at
  BEFORE UPDATE ON ong_recursos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Compromiso de una oferta adjudicada. Idempotente por
-- (emergencia_id, oferta_id): repetir el POST no reserva dos veces.
-- emergencia_id y oferta_id son ids de la web-app (sin FK: otra base).
CREATE TABLE compromisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergencia_id UUID NOT NULL,
  oferta_id UUID NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'liberado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  liberado_at TIMESTAMPTZ,
  UNIQUE (emergencia_id, oferta_id),
  CHECK ((estado = 'liberado') = (liberado_at IS NOT NULL))
);

CREATE INDEX compromisos_emergencia_idx ON compromisos (emergencia_id);

-- Reparto del compromiso por ONG y recurso (con consorcio, una oferta puede
-- repartirse entre varias ONGs).
CREATE TABLE compromiso_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compromiso_id UUID NOT NULL REFERENCES compromisos (id) ON DELETE CASCADE,
  ong_recurso_id BIGINT NOT NULL REFERENCES ong_recursos (id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0)
);

CREATE INDEX compromiso_items_compromiso_idx ON compromiso_items (compromiso_id);

-- ONGs que informaron el fin de su actividad en una emergencia
-- (POST /emergencias/:emergenciaId/finalizacion).
CREATE TABLE emergencia_finalizaciones (
  emergencia_id UUID NOT NULL,
  ong_id UUID NOT NULL REFERENCES ongs (id) ON DELETE CASCADE,
  finalizada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (emergencia_id, ong_id)
);

-- Down Migration

DROP TABLE emergencia_finalizaciones;
DROP TABLE compromiso_items;
DROP TABLE compromisos;
DROP TABLE ong_recursos;
DROP TABLE recursos_catalogo;
DROP TABLE api_clients;
DROP TABLE ongs;
DROP FUNCTION set_updated_at();
