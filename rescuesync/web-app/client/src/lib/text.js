// Minúsculas y sin tildes, para buscar "cordoba" y encontrar "Córdoba".
// Conserva la longitud del texto original (en NFC), así los índices sirven para resaltar.
export function normalizeText(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
