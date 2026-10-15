-- Up Migration

-- Catálogo de recursos, copiado de
-- web-app/client/src/features/lotes/lote-constants.js. Si se agrega un
-- recurso allá, sumar una migración nueva con el INSERT acá.
INSERT INTO recursos_catalogo (codigo, nombre, unidad, categoria) VALUES
  ('paramedicos', 'Paramédicos', 'personas', 'salud'),
  ('medicos', 'Médicos de emergencia', 'personas', 'salud'),
  ('ambulancias', 'Ambulancias equipadas', 'vehículos', 'salud'),
  ('kits-primeros-auxilios', 'Kits de primeros auxilios', 'kits', 'salud'),
  ('medicamentos', 'Medicamentos básicos', 'lotes', 'salud'),
  ('camillas', 'Camillas y sillas de ruedas', 'unidades', 'salud'),
  ('raciones', 'Raciones de comida seca', 'raciones', 'alimentos'),
  ('modulos-familiares', 'Módulos alimentarios familiares', 'módulos', 'alimentos'),
  ('agua-potable', 'Agua potable envasada', 'litros', 'alimentos'),
  ('leche-formula', 'Leche en polvo / fórmula', 'kg', 'alimentos'),
  ('cocina-campo', 'Cocinas de campaña', 'unidades', 'alimentos'),
  ('carpas', 'Carpas familiares (4-6 personas)', 'unidades', 'refugio'),
  ('colchones', 'Colchones', 'unidades', 'refugio'),
  ('frazadas', 'Frazadas térmicas', 'unidades', 'refugio'),
  ('lonas', 'Lonas impermeables', 'unidades', 'refugio'),
  ('kits-higiene', 'Kits de higiene personal', 'kits', 'refugio'),
  ('bomberos', 'Bomberos / Brigadistas', 'personas', 'rescate'),
  ('rescatistas', 'Rescatistas especializados', 'personas', 'rescate'),
  ('botes', 'Botes de rescate', 'unidades', 'rescate'),
  ('motobombas', 'Motobombas de achique', 'unidades', 'rescate'),
  ('chalecos', 'Chalecos salvavidas', 'unidades', 'rescate'),
  ('cisterna', 'Camiones cisterna de agua', 'vehículos', 'rescate'),
  ('generadores', 'Generadores eléctricos', 'unidades', 'logistica'),
  ('camiones', 'Camiones de transporte', 'vehículos', 'logistica'),
  ('combustible', 'Combustible', 'litros', 'logistica'),
  ('radios', 'Radios de comunicación', 'unidades', 'logistica'),
  ('iluminacion', 'Torres de iluminación', 'unidades', 'logistica'),
  ('herramientas', 'Herramientas de trabajo', 'kits', 'logistica');

-- Down Migration

DELETE FROM recursos_catalogo;
