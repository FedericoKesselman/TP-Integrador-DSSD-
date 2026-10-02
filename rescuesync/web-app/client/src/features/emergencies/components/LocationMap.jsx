import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import PropTypes from 'prop-types';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';

const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ARGENTINA_VIEW = { lat: -38.4, lon: -63.6, zoom: 4 };

const placeIcon = L.divIcon({
  className: '',
  html: '<span class="rs-place"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  tooltipAnchor: [0, -10],
});

const coordinateShape = PropTypes.shape({
  lat: PropTypes.number.isRequired,
  lon: PropTypes.number.isRequired,
});

// Mueve la cámara cuando cambia la vista pedida y recalcula el tamaño si el contenedor cambia.
function ViewController({ view = null, reducedMotion }) {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (!view) return;
    map.flyTo([view.lat, view.lon], view.zoom, { animate: !reducedMotion, duration: 1.1 });
  }, [map, view, reducedMotion]);

  return null;
}

ViewController.propTypes = {
  view: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lon: PropTypes.number.isRequired,
    zoom: PropTypes.number.isRequired,
  }),
  reducedMotion: PropTypes.bool.isRequired,
};

function PointPicker({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lon: event.latlng.lng });
    },
  });
  return null;
}

PointPicker.propTypes = {
  onPick: PropTypes.func.isRequired,
};

function LocationMap({
  view = null,
  place = null,
  point = null,
  pointColor = 'var(--color-brand)',
  onPick,
  reducedMotion,
  className = '',
}) {
  const initialView = view ?? ARGENTINA_VIEW;
  const pointIcon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `<span class="rs-pin" style="--pin:${pointColor}"></span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 34],
      }),
    [pointColor],
  );
  const markerHandlers = useMemo(
    () => ({
      dragend(event) {
        const { lat, lng } = event.target.getLatLng();
        onPick({ lat, lon: lng });
      },
    }),
    [onPick],
  );

  return (
    <MapContainer
      center={[initialView.lat, initialView.lon]}
      zoom={initialView.zoom}
      scrollWheelZoom={false}
      className={`rs-map ${className}`}
    >
      <TileLayer url={TILES_URL} attribution={ATTRIBUTION} maxZoom={18} />
      <ViewController view={view} reducedMotion={reducedMotion} />
      <PointPicker onPick={onPick} />
      {place && (
        <Marker
          position={[place.centroide.lat, place.centroide.lon]}
          icon={placeIcon}
          interactive={false}
        >
          <Tooltip permanent direction="top">
            {place.nombre}
          </Tooltip>
        </Marker>
      )}
      {point && (
        <Marker
          position={[point.lat, point.lon]}
          icon={pointIcon}
          draggable
          autoPan
          eventHandlers={markerHandlers}
          title="Punto de la emergencia (arrastrá para ajustar)"
        />
      )}
    </MapContainer>
  );
}

LocationMap.propTypes = {
  view: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lon: PropTypes.number.isRequired,
    zoom: PropTypes.number.isRequired,
  }),
  place: PropTypes.shape({
    nombre: PropTypes.string.isRequired,
    centroide: coordinateShape.isRequired,
  }),
  point: coordinateShape,
  pointColor: PropTypes.string,
  onPick: PropTypes.func.isRequired,
  reducedMotion: PropTypes.bool.isRequired,
  className: PropTypes.string,
};

export default LocationMap;
