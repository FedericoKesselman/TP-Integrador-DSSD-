import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { Compass, MapPin, ZoomIn, ZoomOut } from 'lucide-react';
import PropTypes from 'prop-types';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { PROVINCES } from '../../features/emergencies/emergency-constants.js';
import { getMunicipalities } from '../../services/georef-service.js';

const ARGENTINA_CENTER = { lat: -38.4161, lon: -63.6167 };

const SEVERITY_PIN_COLORS = {
  baja: '#10b981', // emerald
  media: '#f59e0b', // amber
  alta: '#f97316', // orange
  critica: '#ef4444', // red
};

function normalizePlaceName(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function MiniIncidentMap({
  latitude = null,
  longitude = null,
  municipalityId = '',
  provinceId = '',
  municipality = '',
  province = '',
  severity = 'media',
  height = 'h-40',
  zoom = 12,
  interactive = false,
  className = '',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [georefCoords, setGeorefCoords] = useState(null);

  const explicitCoords = useMemo(() => {
    if (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !Number.isNaN(latitude) &&
      !Number.isNaN(longitude)
    ) {
      return { lat: latitude, lon: longitude };
    }
    return null;
  }, [latitude, longitude]);

  const provinceCoords = useMemo(() => {
    const provinceById = PROVINCES.find((item) => item.id === String(provinceId));
    if (provinceById?.centroide) return provinceById.centroide;

    const normalizedProvince = normalizePlaceName(province);
    const provinceByName = PROVINCES.find(
      (item) => normalizePlaceName(item.nombre) === normalizedProvince,
    );
    return provinceByName?.centroide ?? null;
  }, [province, provinceId]);

  useEffect(() => {
    if (explicitCoords || !provinceId) {
      setGeorefCoords(null);
      return undefined;
    }

    const controller = new AbortController();
    setGeorefCoords(null);

    getMunicipalities(provinceId, { signal: controller.signal })
      .then((items) => {
        const normalizedMunicipality = normalizePlaceName(municipality);
        const matchedMunicipality = items.find((item) => item.id === String(municipalityId))
          ?? items.find((item) => normalizePlaceName(item.nombre) === normalizedMunicipality);

        setGeorefCoords(matchedMunicipality?.centroide ?? null);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('MiniIncidentMap georef warning:', err);
        }
      });

    return () => controller.abort();
  }, [explicitCoords, municipality, municipalityId, provinceId]);

  // Resolver coordenadas reales o un centroide oficial aproximado.
  const resolvedCoords = useMemo(() => {
    if (explicitCoords) return explicitCoords;
    if (georefCoords) return georefCoords;
    if (provinceCoords) return provinceCoords;
    return ARGENTINA_CENTER;
  }, [explicitCoords, georefCoords, provinceCoords]);

  const pinColor = SEVERITY_PIN_COLORS[severity] || '#0284c7';

  useEffect(() => {
    if (!mapContainerRef.current) return undefined;

    // Si ya existe instancia previa, limpiarla
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: [resolvedCoords.lat, resolvedCoords.lon],
        zoom,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: interactive,
        dragging: interactive,
        touchZoom: interactive,
        doubleClickZoom: interactive,
      });

      // OpenStreetMap: mapa base de alta disponibilidad, rápido y sin marcas de agua ni restricciones de API
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Marcador de radar palpitante
      const radarIcon = L.divIcon({
        className: 'rs-radar-pin',
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background-color: ${pinColor}; opacity: 0.35; animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; width: 22px; height: 22px; border-radius: 9999px; background-color: ${pinColor}; opacity: 0.55;"></div>
            <div style="position: absolute; width: 12px; height: 12px; border-radius: 9999px; background-color: #ffffff; border: 3px solid ${pinColor}; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([resolvedCoords.lat, resolvedCoords.lon], { icon: radarIcon }).addTo(map);

      mapInstanceRef.current = map;

      // Invalidate size después del render inicial
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);
    } catch (err) {
      console.warn('MiniIncidentMap leaflet initialization warning:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [resolvedCoords.lat, resolvedCoords.lon, zoom, interactive, pinColor]);

  const handleZoomIn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-inner ${height} ${className}`}
    >
      {/* Contenedor Leaflet */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Sutil overlay de viñeta para contraste cinematográfico */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-slate-900/10" />

      {/* Tag flotante de coordenadas GPS */}
      <div className="absolute bottom-2 left-2.5 z-[400] flex items-center gap-1.5 rounded-lg bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md">
        <MapPin className="h-3 w-3 text-brand-celeste animate-pulse" />
        <span>
          {resolvedCoords.lat.toFixed(3)}, {resolvedCoords.lon.toFixed(3)}
        </span>
      </div>

      {/* Controles rápidos de mapa en la esquina superior derecha */}
      <div className="absolute right-2 top-2 z-[400] flex flex-col gap-1">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Acercar mapa"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-slate-700 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-slate-900 active:scale-95"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Alejar mapa"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-slate-700 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-slate-900 active:scale-95"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Badge de Centro Operativo en la esquina superior izquierda */}
      <div className="absolute left-2 top-2 z-[400] flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-xs backdrop-blur-sm">
        <Compass className="h-3 w-3 text-brand" />
        <span>Geo-Foco</span>
      </div>
    </div>
  );
}

MiniIncidentMap.propTypes = {
  latitude: PropTypes.number,
  longitude: PropTypes.number,
  municipalityId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  provinceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  municipality: PropTypes.string,
  province: PropTypes.string,
  severity: PropTypes.string,
  height: PropTypes.string,
  zoom: PropTypes.number,
  interactive: PropTypes.bool,
  className: PropTypes.string,
};

export default memo(MiniIncidentMap);
