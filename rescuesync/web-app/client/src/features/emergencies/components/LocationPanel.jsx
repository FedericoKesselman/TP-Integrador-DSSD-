import {
  CircleCheck,
  LoaderCircle,
  LocateFixed,
  MapPinned,
  MousePointerClick,
  X,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';

import Alert from '../../../components/ui/Alert.jsx';
import Button from '../../../components/ui/Button.jsx';
import { controlClassName, groupClassName } from '../../../components/ui/field-styles.js';
import { usePrefersReducedMotion } from '../../../hooks/use-media-query.js';
import { normalizeText } from '../../../lib/text.js';
import { getCachedMunicipalities } from '../../../services/georef-service.js';
import { CABA_ID, PROVINCES } from '../emergency-constants.js';
import { usePointPlace } from '../use-georef.js';
import LocationMap from './LocationMap.jsx';

const PROVINCE_ZOOM = { [CABA_ID]: 11, 90: 8, 54: 7, 94: 7 };
const GEOLOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 };

// "card": tarjeta flotante en la columna lateral; "inset": dentro de la hoja del formulario.
const VARIANTS = {
  card: 'rounded-2xl bg-paper shadow-float ring-1 ring-ink/5',
  inset: 'rounded-xl bg-paper ring-1 ring-line',
};

const placeShape = PropTypes.shape({
  id: PropTypes.string,
  nombre: PropTypes.string.isRequired,
  centroide: PropTypes.shape({ lat: PropTypes.number, lon: PropTypes.number }),
});

// Campo numérico chico con prefijo visible ("Lat", "Lon") y etiqueta completa para lectores.
function CoordinateInput({ id, label, prefix, value, size, hasError, onChange, onBlur }) {
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs font-semibold text-ink-muted"
      >
        {prefix}
      </span>
      <input
        id={id}
        name={id}
        type="number"
        step="any"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={hasError}
        className={`${controlClassName(hasError, size)} pl-10! tabular-nums`}
      />
    </div>
  );
}

CoordinateInput.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  prefix: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['sm', 'md']).isRequired,
  hasError: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func.isRequired,
};

function viewFor(province, municipality) {
  if (municipality?.centroide) {
    return { ...municipality.centroide, zoom: province?.id === CABA_ID ? 13 : 11 };
  }
  if (province) return { ...province.centroide, zoom: PROVINCE_ZOOM[province.id] ?? 6 };
  return null;
}

function parsePoint(latitude, longitude) {
  const lat = Number.parseFloat(latitude);
  const lon = Number.parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return { lat, lon };
}

// Compara el lugar donde cae el punto (según Georef) con la provincia y municipio elegidos.
function comparePlace(place, province, municipality) {
  if (!place.provincia) return 'outside';
  if (!province || place.provincia.id !== province.id) return 'other-province';
  if (!place.municipio) return 'no-municipality';
  if (!municipality) return 'suggest';
  const same = municipality.id
    ? municipality.id === place.municipio.id
    : normalizeText(municipality.nombre) === normalizeText(place.municipio.nombre);
  return same ? 'match' : 'other-municipality';
}

function describePlace(place) {
  return [place.municipio?.nombre, place.provincia?.nombre].filter(Boolean).join(', ');
}

function PointCheck({ status, place = null, province = null, municipality = null, onApply }) {
  if (status === 'loading' || status === 'idle') {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Verificando en qué municipio cae el punto…
      </p>
    );
  }
  if (status === 'error' || !place) {
    return (
      <p className="text-sm text-ink-muted" role="status">
        No se pudo verificar el punto con Georef. Revisalo a simple vista en el mapa.
      </p>
    );
  }

  const result = comparePlace(place, province, municipality);
  const applyButton = (
    <Button size="sm" variant="secondary" onClick={onApply}>
      Usar {describePlace(place)}
    </Button>
  );

  if (result === 'outside') {
    return (
      <Alert tone="warning" title="El punto está fuera de Argentina">
        Movelo dentro del país o quitalo.
      </Alert>
    );
  }
  if (result === 'other-province' || result === 'other-municipality') {
    return (
      <Alert
        tone="warning"
        title="El punto no coincide con la ubicación elegida"
        action={applyButton}
      >
        Cae en {describePlace(place)}.
      </Alert>
    );
  }
  if (result === 'suggest') {
    return (
      <Alert tone="info" title={`El punto está en ${place.municipio.nombre}`} action={applyButton}>
        Podés usarlo para completar el municipio.
      </Alert>
    );
  }
  if (result === 'no-municipality') {
    return (
      <Alert tone="info">
        El punto está en {place.provincia.nombre}, fuera del ejido de un municipio.
      </Alert>
    );
  }
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-ok" role="status">
      <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
      El punto está dentro de {place.municipio.nombre}.
    </p>
  );
}

PointCheck.propTypes = {
  status: PropTypes.oneOf(['idle', 'loading', 'ready', 'error']).isRequired,
  place: PropTypes.shape({
    provincia: PropTypes.shape({ id: PropTypes.string, nombre: PropTypes.string }),
    municipio: PropTypes.shape({ id: PropTypes.string, nombre: PropTypes.string }),
  }),
  province: placeShape,
  municipality: placeShape,
  onApply: PropTypes.func.isRequired,
};

function LocationPanel({
  province = null,
  municipality = null,
  latitude,
  longitude,
  latitudeError = undefined,
  longitudeError = undefined,
  pointColor = undefined,
  onCoordinateChange,
  onCoordinateBlur,
  onPointChange,
  onRelocate,
  variant = 'card',
  compact = false,
  mapHeightClass = 'h-72',
  className = '',
}) {
  const reducedMotion = usePrefersReducedMotion();
  const point = parsePoint(latitude, longitude);
  const pointLat = point ? point.lat : null;
  const pointLon = point ? point.lon : null;
  const pointPlace = usePointPlace(pointLat, pointLon);

  const [view, setView] = useState(() => viewFor(province, municipality));
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);

  // Al elegir provincia o municipio, el mapa vuela hasta ahí.
  useEffect(() => {
    setView(viewFor(province, municipality));
  }, [province, municipality]);

  const applyPlace = useCallback(
    (place) => {
      const nextProvince = PROVINCES.find((item) => item.id === place.provincia?.id);
      if (!nextProvince) return;
      let nextMunicipality = null;
      if (place.municipio) {
        nextMunicipality = getCachedMunicipalities(nextProvince.id)?.find(
          (item) => item.id === place.municipio.id,
        ) ?? {
          id: place.municipio.id,
          nombre: place.municipio.nombre,
          centroide: pointLat == null ? null : { lat: pointLat, lon: pointLon },
        };
      }
      onRelocate({ province: nextProvince, municipality: nextMunicipality });
    },
    [onRelocate, pointLat, pointLon],
  );

  // Si marcaron el punto antes de elegir provincia, la completamos con lo que dice Georef.
  useEffect(() => {
    if (province || pointPlace.status !== 'ready' || !pointPlace.place?.provincia) return;
    applyPlace(pointPlace.place);
  }, [province, pointPlace, applyPlace]);

  const handleLocate = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('Este navegador no permite obtener la ubicación. Marcá el punto en el mapa.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lon: position.coords.longitude };
        setLocating(false);
        onPointChange(next);
        setView({ ...next, zoom: 15 });
      },
      (error) => {
        setLocating(false);
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? 'No diste permiso para usar tu ubicación. Podés marcar el punto en el mapa o cargar las coordenadas.'
            : 'No se pudo obtener tu ubicación. Probá de nuevo o marcá el punto en el mapa.',
        );
      },
      GEOLOCATION_OPTIONS,
    );
  };

  let caption = 'Elegí provincia y municipio para ver la zona.';
  if (province && !municipality) caption = `${province.nombre}. Elegí el municipio para acercar.`;
  if (municipality) caption = `Confirmá que ${municipality.nombre} sea la zona correcta.`;

  const coordinateErrors = [latitudeError, longitudeError].filter(Boolean);
  const coordinateSize = compact ? 'sm' : 'md';

  return (
    <section
      aria-labelledby="mapa-titulo"
      className={`overflow-hidden ${VARIANTS[variant]} ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-3 pb-2.5">
        <div className="min-w-0 flex-1 basis-52">
          <h2
            id="mapa-titulo"
            className="text-lg leading-tight font-bold text-ink font-stretch-semi-condensed"
          >
            Mapa de la zona
          </h2>
          <p className="text-sm text-ink-soft" aria-live="polite">
            {caption}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={LocateFixed}
          loading={locating}
          onClick={handleLocate}
          className="shrink-0"
        >
          Usar mi ubicación
        </Button>
      </header>

      <div
        className={`relative isolate overflow-hidden border-y border-line/70 bg-paper-sunken transition-[height] duration-500 ease-out motion-reduce:transition-none ${province ? mapHeightClass : 'h-28'}`}
      >
        {province ? (
          <>
            <LocationMap
              view={view}
              place={municipality?.centroide ? municipality : null}
              point={point}
              pointColor={pointColor}
              onPick={onPointChange}
              reducedMotion={reducedMotion}
              className="absolute inset-0 h-full w-full"
            />
            {!point && (
              <p className="pointer-events-none absolute top-3 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-ink shadow-lift">
                <MousePointerClick className="h-4 w-4 text-brand" aria-hidden="true" />
                Tocá el mapa para marcar el punto exacto
              </p>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(rgb(23_33_47/0.13)_1px,transparent_1px)] bg-[size:14px_14px] px-6 text-center">
            <p className="flex max-w-xs items-center gap-2 rounded-xl bg-paper/90 px-4 py-3 text-sm text-ink-soft shadow-sm">
              <MapPinned className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
              El mapa se abre cuando elijas la provincia.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2.5 px-4 pt-2.5 pb-3">
        {geoError && <Alert tone="warning">{geoError}</Alert>}
        {point && (
          <PointCheck
            status={pointPlace.status}
            place={pointPlace.place}
            province={province}
            municipality={municipality}
            onApply={() => applyPlace(pointPlace.place)}
          />
        )}
        <fieldset
          className={groupClassName(coordinateErrors.length > 0)}
          aria-describedby={coordinateErrors.length ? 'coordinates-error' : undefined}
        >
          <legend className="text-sm font-semibold text-ink">
            Coordenadas del punto <span className="font-normal text-ink-muted">(opcional)</span>
          </legend>
          <div className="mt-1 flex items-center gap-2">
            <CoordinateInput
              id="latitude"
              label="Latitud"
              prefix="Lat"
              value={latitude}
              size={coordinateSize}
              hasError={Boolean(latitudeError)}
              onChange={onCoordinateChange}
              onBlur={onCoordinateBlur}
            />
            <CoordinateInput
              id="longitude"
              label="Longitud"
              prefix="Lon"
              value={longitude}
              size={coordinateSize}
              hasError={Boolean(longitudeError)}
              onChange={onCoordinateChange}
              onBlur={onCoordinateBlur}
            />
            {point && (
              <button
                type="button"
                onClick={() => onPointChange(null)}
                aria-label="Quitar el punto"
                title="Quitar el punto"
                className="shrink-0 rounded-lg p-2 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/25"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {coordinateErrors.length > 0 && (
            <p id="coordinates-error" className="mt-1 text-sm font-semibold text-danger">
              <span className="sr-only">Error: </span>
              {coordinateErrors[0]}
            </p>
          )}
        </fieldset>
      </div>
    </section>
  );
}

LocationPanel.propTypes = {
  province: placeShape,
  municipality: placeShape,
  latitude: PropTypes.string.isRequired,
  longitude: PropTypes.string.isRequired,
  latitudeError: PropTypes.string,
  longitudeError: PropTypes.string,
  pointColor: PropTypes.string,
  onCoordinateChange: PropTypes.func.isRequired,
  onCoordinateBlur: PropTypes.func.isRequired,
  onPointChange: PropTypes.func.isRequired,
  onRelocate: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['card', 'inset']),
  compact: PropTypes.bool,
  mapHeightClass: PropTypes.string,
  className: PropTypes.string,
};

export default LocationPanel;
