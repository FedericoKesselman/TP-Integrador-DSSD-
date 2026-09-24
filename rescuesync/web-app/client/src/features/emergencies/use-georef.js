import { useCallback, useEffect, useState } from 'react';

import {
  getCachedMunicipalities,
  getMunicipalities,
  locatePoint,
} from '../../services/georef-service.js';

const POINT_LOOKUP_DELAY_MS = 450;

function initialMunicipalities(provinceId) {
  if (!provinceId) return { status: 'idle', items: [] };
  const cached = getCachedMunicipalities(provinceId);
  return cached ? { status: 'ready', items: cached } : { status: 'loading', items: [] };
}

// Lista de municipios de la provincia elegida: { status: idle|loading|ready|error, items, retry }.
export function useMunicipalities(provinceId) {
  const [state, setState] = useState(() => initialMunicipalities(provinceId));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setState(initialMunicipalities(provinceId));
    if (!provinceId) return undefined;

    const controller = new AbortController();
    getMunicipalities(provinceId, { signal: controller.signal })
      .then((items) => setState({ status: 'ready', items }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', items: [] });
      });
    return () => controller.abort();
  }, [provinceId, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { ...state, retry };
}

// Provincia y municipio en los que cae el punto marcado (con una espera para no consultar
// en cada paso mientras se arrastra el marcador).
export function usePointPlace(lat, lon) {
  const [state, setState] = useState({ status: 'idle', place: null });

  useEffect(() => {
    if (lat == null || lon == null) {
      setState({ status: 'idle', place: null });
      return undefined;
    }

    const controller = new AbortController();
    setState((previous) => ({ ...previous, status: 'loading' }));
    const timer = setTimeout(() => {
      locatePoint(lat, lon, { signal: controller.signal })
        .then((place) => setState({ status: 'ready', place }))
        .catch((error) => {
          if (error.name !== 'AbortError') setState({ status: 'error', place: null });
        });
    }, POINT_LOOKUP_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lon]);

  return state;
}
