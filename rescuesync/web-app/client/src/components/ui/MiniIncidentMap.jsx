import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { Compass, ExternalLink, MapPin, ZoomIn, ZoomOut } from 'lucide-react';
import PropTypes from 'prop-types';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

// Coordenadas de referencia para municipios comunes en Argentina si lat/lon son nulos
const FALLBACK_COORDS = {
  'la plata': { lat: -34.9214, lon: -57.9545 },
  'capilla del monte': { lat: -30.8606, lon: -64.5244 },
  córdoba: { lat: -31.4201, lon: -64.1888 },
  cordoba: { lat: -31.4201, lon: -64.1888 },
  quilmes: { lat: -34.7242, lon: -58.2524 },
  tigre: { lat: -34.4251, lon: -58.5796 },
  rosario: { lat: -32.9468, lon: -60.6393 },
  'mar del plata': { lat: -38.0055, lon: -57.5562 },
  mendoza: { lat: -32.8895, lon: -68.8458 },
  salta: { lat: -24.7859, lon: -65.4117 },
  bariloche: { lat: -41.1335, lon: -71.3103 },
};

const SEVERITY_PIN_COLORS = {
  baja: '#10b981', // emerald
  media: '#f59e0b', // amber
  alta: '#f97316', // orange
  critica: '#ef4444', // red
};

function MiniIncidentMap({
  latitude,
  longitude,
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
  const [mapReady, setMapReady] = useState(false);

  // Resolver coordenadas reales o fallback
  const resolvedCoords = useMemo(() => {
    if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
      return { lat: latitude, lon: longitude };
    }
    const muniKey = (municipality || '').trim().toLowerCase();
    if (FALLBACK_COORDS[muniKey]) {
      return FALLBACK_COORDS[muniKey];
    }
    const provKey = (province || '').trim().toLowerCase();
    if (FALLBACK_COORDS[provKey]) {
      return FALLBACK_COORDS[provKey];
    }
    return { lat: -34.9214, lon: -57.9545 }; // Default La Plata
  }, [latitude, longitude, municipality, province]);

  const pinColor = SEVERITY_PIN_COLORS[severity] || '#0284c7';

  useEffect(() => {
    if (!mapContainerRef.current) return;

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
      setMapReady(true);

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
  municipality: PropTypes.string,
  province: PropTypes.string,
  severity: PropTypes.string,
  height: PropTypes.string,
  zoom: PropTypes.number,
  interactive: PropTypes.bool,
  className: PropTypes.string,
};

export default memo(MiniIncidentMap);
