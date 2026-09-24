// API Georef (datos.gob.ar): normaliza provincias y municipios con los códigos oficiales del
// INDEC. Es pública y permite CORS, así que el cliente la consulta directo.
const GEOREF_URL = 'https://apis.datos.gob.ar/georef/api';

const municipalityCache = new Map();

async function georefRequest(path, params, signal) {
  const response = await fetch(`${GEOREF_URL}/${path}?${new URLSearchParams(params)}`, { signal });
  if (!response.ok) throw new Error(`Georef respondió ${response.status}`);
  return response.json();
}

export function getCachedMunicipalities(provinceId) {
  return municipalityCache.get(provinceId) ?? null;
}

// Municipios de una provincia (en CABA, Georef devuelve las 15 comunas).
export async function getMunicipalities(provinceId, { signal } = {}) {
  const cached = getCachedMunicipalities(provinceId);
  if (cached) return cached;

  const data = await georefRequest(
    'municipios',
    { provincia: provinceId, campos: 'id,nombre,centroide', max: '1000', orden: 'nombre' },
    signal,
  );
  const municipalities = data.municipios.map((municipality) => ({
    id: municipality.id,
    nombre: municipality.nombre,
    centroide: { lat: municipality.centroide.lat, lon: municipality.centroide.lon },
  }));
  municipalityCache.set(provinceId, municipalities);
  return municipalities;
}

// Provincia y municipio en los que cae un punto. Fuera de Argentina, los ids vienen en null.
export async function locatePoint(lat, lon, { signal } = {}) {
  const { ubicacion } = await georefRequest('ubicacion', { lat, lon }, signal);
  return {
    provincia: ubicacion.provincia?.id ? ubicacion.provincia : null,
    municipio: ubicacion.municipio?.id ? ubicacion.municipio : null,
  };
}
