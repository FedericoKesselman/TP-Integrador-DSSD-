// fieldProps() agrupa id/name/value/handlers/error comunes a los campos de texto; se esparce
// para no repetir esos 6 props en cada uno.
/* eslint-disable react/jsx-props-no-spreading */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import ComboboxField from '../components/ui/ComboboxField.jsx';
import ErrorSummary from '../components/ui/ErrorSummary.jsx';
import FormSection from '../components/ui/FormSection.jsx';
import TextAreaField from '../components/ui/TextAreaField.jsx';
import TextField from '../components/ui/TextField.jsx';
import EmergencyConfirmation from '../features/emergencies/components/EmergencyConfirmation.jsx';
import EmergencyPreview from '../features/emergencies/components/EmergencyPreview.jsx';
import EmergencyTypePicker from '../features/emergencies/components/EmergencyTypePicker.jsx';
import LocationPanel from '../features/emergencies/components/LocationPanel.jsx';
import ProgressTracker from '../features/emergencies/components/ProgressTracker.jsx';
import SeverityPicker from '../features/emergencies/components/SeverityPicker.jsx';
import {
  CABA_ID,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  FORM_SECTIONS,
  PROVINCES,
  SEVERITY_LEVELS,
  createEmptyEmergency,
} from '../features/emergencies/emergency-constants.js';
import { SECTION_ICONS } from '../features/emergencies/emergency-icons.js';
import { useMunicipalities } from '../features/emergencies/use-georef.js';
import {
  getSectionProgress,
  toEmergencyPayload,
  validateEmergency,
} from '../features/emergencies/validate-emergency.js';
import { useMediaQuery, usePrefersReducedMotion } from '../hooks/use-media-query.js';
import { toLocalInputValue } from '../lib/dates.js';
import { createEmergency } from '../services/emergency-service.js';

const FORM_ID = 'emergency-form';

// Los grupos de radios se enfocan en su primera opción.
const FOCUS_TARGETS = { type: 'type-inundacion', severity: 'severity-baja' };
const fieldTargetId = (field) => FOCUS_TARGETS[field] ?? field;

function EmergencyFormPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const reducedMotion = usePrefersReducedMotion();
  const scrollBehavior = reducedMotion ? 'auto' : 'smooth';

  const [values, setValues] = useState(() => createEmptyEmergency());
  const [touched, setTouched] = useState({});
  const [submitCount, setSubmitCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [created, setCreated] = useState(null);
  const [activeSection, setActiveSection] = useState(FORM_SECTIONS[0].id);
  const submitErrorRef = useRef(null);

  const errors = useMemo(() => validateEmergency(values), [values]);
  const sections = useMemo(() => getSectionProgress(values, errors), [values, errors]);
  const municipalities = useMunicipalities(values.province?.id);

  const errorEntries = Object.entries(errors);
  const missingCount = sections.reduce((sum, section) => sum + section.total - section.done, 0);
  const severityColor = SEVERITY_LEVELS.find((level) => level.value === values.severity)?.color;
  const municipalityLabel = values.province?.id === CABA_ID ? 'Comuna' : 'Municipio';
  const showAllErrors = submitCount > 0;

  const fieldError = (name) => (showAllErrors || touched[name] ? errors[name] : undefined);
  const touch = useCallback((name) => setTouched((prev) => ({ ...prev, [name]: true })), []);

  // Sección visible, para resaltarla en la barra de progreso.
  useEffect(() => {
    if (created) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    FORM_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [created]);

  // Evita perder lo cargado al cerrar o recargar la pestaña por error.
  const isDirty = !created && Object.keys(touched).length > 0;
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  useEffect(() => {
    if (submitError) submitErrorRef.current?.focus();
  }, [submitError]);

  const handleChange = (event) => {
    const { name, value, type } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (type === 'radio') touch(name);
  };

  const handleBlur = (event) => touch(event.target.name);

  const handleProvinceChange = (province) => {
    setValues((prev) =>
      prev.province?.id === province?.id
        ? prev
        : { ...prev, province, municipality: null, latitude: '', longitude: '' },
    );
    touch('province');
  };

  const handleMunicipalityChange = (municipality) => {
    setValues((prev) => ({ ...prev, municipality }));
    touch('municipality');
  };

  // Sin lista de Georef, el municipio se escribe a mano.
  const handleMunicipalityText = (event) => {
    const nombre = event.target.value;
    setValues((prev) => ({
      ...prev,
      municipality: nombre ? { id: null, nombre, centroide: null } : null,
    }));
  };

  const handlePointChange = useCallback((point) => {
    setValues((prev) => ({
      ...prev,
      latitude: point ? point.lat.toFixed(6) : '',
      longitude: point ? point.lon.toFixed(6) : '',
    }));
  }, []);

  const handleRelocate = useCallback(({ province, municipality }) => {
    setValues((prev) => ({ ...prev, province, municipality }));
    setTouched((prev) => ({ ...prev, province: true, municipality: true }));
  }, []);

  const focusField = (field) => {
    const element = document.getElementById(fieldTargetId(field));
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'center', behavior: scrollBehavior });
  };

  const navigateToSection = (sectionId) => {
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ block: 'start', behavior: scrollBehavior });
    setActiveSection(sectionId);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitCount((count) => count + 1);
    setSubmitError(null);
    if (errorEntries.length > 0) return;

    setSubmitting(true);
    try {
      const emergency = await createEmergency(toEmergencyPayload(values));
      setCreated({ emergency, values });
      window.scrollTo({ top: 0 });
    } catch (error) {
      setSubmitError(error.message || 'No se pudo registrar la emergencia.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterAnother = () => {
    setValues(createEmptyEmergency());
    setTouched({});
    setSubmitCount(0);
    setSubmitError(null);
    setCreated(null);
    setActiveSection(FORM_SECTIONS[0].id);
  };

  if (created) {
    return (
      <EmergencyConfirmation
        emergency={created.emergency}
        values={created.values}
        onRegisterAnother={handleRegisterAnother}
      />
    );
  }

  const fieldProps = (name) => ({
    id: name,
    name,
    value: values[name],
    onChange: handleChange,
    onBlur: handleBlur,
    error: fieldError(name),
  });

  let municipalityHint = 'Primero elegí la provincia.';
  if (municipalities.status === 'loading') municipalityHint = 'Cargando la lista oficial…';
  if (municipalities.status === 'ready') {
    const unit = values.province.id === CABA_ID ? 'comunas' : 'municipios';
    municipalityHint = `${municipalities.items.length} ${unit} en ${values.province.nombre}. Escribí para buscar.`;
  }

  const locationPanel = (
    <LocationPanel
      province={values.province}
      municipality={values.municipality}
      latitude={values.latitude}
      longitude={values.longitude}
      latitudeError={fieldError('latitude')}
      longitudeError={fieldError('longitude')}
      pointColor={severityColor}
      onCoordinateChange={handleChange}
      onCoordinateBlur={handleBlur}
      onPointChange={handlePointChange}
      onRelocate={handleRelocate}
      variant={isDesktop ? 'card' : 'inset'}
      compact={isDesktop}
      mapHeightClass={isDesktop ? 'h-[clamp(150px,22vh,280px)]' : 'h-64'}
      className={isDesktop ? 'shrink-0' : 'sm:col-span-2'}
    />
  );

  const submitErrorAlert = submitError && (
    <div ref={submitErrorRef} tabIndex={-1} className="outline-none">
      <Alert tone="error" title="No se pudo registrar la emergencia">
        {submitError} Tus datos siguen cargados; probá de nuevo en unos segundos.
      </Alert>
    </div>
  );

  const submitLabel = submitting ? 'Registrando…' : 'Registrar emergencia';
  const missingText =
    missingCount > 0
      ? `Faltan ${missingCount} ${missingCount === 1 ? 'dato obligatorio' : 'datos obligatorios'}.`
      : 'Todo listo. Se va a notificar al Centro Coordinador Regional.';

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-3 py-3 sm:px-4 lg:px-6">
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-ink font-stretch-semi-condensed lg:text-[1.75rem]">
          Registrar emergencia
        </h1>
        <p className="max-w-[90ch] text-sm text-ink-soft">
          Al registrarla, el Centro Coordinador Regional recibe la alerta y arma los lotes de
          necesidades. Todos los datos son obligatorios, salvo los marcados como opcionales.
        </p>
      </div>

      <ProgressTracker
        sections={sections}
        activeId={activeSection}
        onNavigate={navigateToSection}
      />

      <div className="grid items-start gap-4 px-3 pt-4 pb-28 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.62fr)] lg:px-6 lg:pb-8 xl:gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.55fr)]">
        <div className="min-w-0 space-y-4">
          {showAllErrors && errorEntries.length > 0 && (
            <ErrorSummary
              errors={errorEntries}
              focusKey={submitCount}
              onSelect={focusField}
              getTargetId={fieldTargetId}
            />
          )}
          {!isDesktop && submitErrorAlert}

          <form
            id={FORM_ID}
            onSubmit={handleSubmit}
            noValidate
            className="rounded-2xl bg-paper shadow-paper ring-1 ring-ink/5"
          >
            <FormSection
              id={sections[0].id}
              step={1}
              icon={SECTION_ICONS[sections[0].id]}
              title="Tipo y gravedad"
              description="Qué está pasando y qué tan grave es."
              complete={sections[0].complete}
            >
              <EmergencyTypePicker
                value={values.type}
                onChange={handleChange}
                error={fieldError('type')}
                className="sm:col-span-2"
              />
              {values.type === 'otro' && (
                <TextField
                  {...fieldProps('typeOther')}
                  label="¿Qué tipo de emergencia es?"
                  hint="Por ejemplo: deslizamiento de tierra o nevada intensa."
                  className="sm:col-span-2 xl:col-span-1"
                />
              )}
              <SeverityPicker
                value={values.severity}
                onChange={handleChange}
                error={fieldError('severity')}
                className="sm:col-span-2"
              />
            </FormSection>

            <FormSection
              id={sections[1].id}
              step={2}
              icon={SECTION_ICONS[sections[1].id]}
              title="Ubicación"
              description={
                isDesktop
                  ? 'Dónde ocurre. El mapa de la derecha te muestra el lugar elegido.'
                  : 'Dónde ocurre. El mapa te ayuda a confirmar el lugar.'
              }
              complete={sections[1].complete}
            >
              <ComboboxField
                id="province"
                label="Provincia"
                value={values.province}
                options={PROVINCES}
                onChange={handleProvinceChange}
                onBlur={() => touch('province')}
                hint="Escribí para buscar."
                error={fieldError('province')}
              />
              {municipalities.status === 'error' ? (
                <TextField
                  id="municipality"
                  name="municipality"
                  label={municipalityLabel}
                  value={values.municipality?.nombre ?? ''}
                  onChange={handleMunicipalityText}
                  onBlur={() => touch('municipality')}
                  error={fieldError('municipality')}
                  hint={
                    <>
                      No se pudo cargar la lista oficial. Escribí el nombre o{' '}
                      <button
                        type="button"
                        onClick={municipalities.retry}
                        className="font-semibold text-brand underline underline-offset-2 hover:text-brand-hover"
                      >
                        volvé a intentar
                      </button>
                      .
                    </>
                  }
                />
              ) : (
                <ComboboxField
                  id="municipality"
                  label={municipalityLabel}
                  value={values.municipality}
                  options={municipalities.items}
                  onChange={handleMunicipalityChange}
                  onBlur={() => touch('municipality')}
                  disabled={!values.province}
                  loading={municipalities.status === 'loading'}
                  hint={municipalityHint}
                  error={fieldError('municipality')}
                />
              )}
              <TextField
                {...fieldProps('affectedZone')}
                label="Zona afectada"
                hint="Barrios, localidades o referencias. Por ejemplo: barrios Tolosa y Ringuelet, márgenes del arroyo El Gato."
                className="sm:col-span-2"
              />
              {!isDesktop && locationPanel}
            </FormSection>

            <FormSection
              id={sections[2].id}
              step={3}
              icon={SECTION_ICONS[sections[2].id]}
              title="Detalle"
              description="Cuándo empezó y qué se sabe hasta ahora."
              complete={sections[2].complete}
            >
              <TextField
                {...fieldProps('occurredAt')}
                label="Inicio del evento"
                type="datetime-local"
                max={toLocalInputValue(new Date())}
                hint="Tiene la fecha y hora actuales. Cambiala si empezó antes."
              />
              <TextField
                {...fieldProps('estimatedAffectedPeople')}
                label="Personas afectadas"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                optional
                hint="Un número aproximado alcanza. Por ejemplo: 350."
              />
              <TextAreaField
                {...fieldProps('description')}
                label="Descripción inicial"
                hint="Qué pasó, cómo está la situación ahora y qué se necesita con urgencia."
                minLength={DESCRIPTION_MIN_LENGTH}
                maxLength={DESCRIPTION_MAX_LENGTH}
                className="sm:col-span-2"
              />
            </FormSection>

            <FormSection
              id={sections[3].id}
              step={4}
              icon={SECTION_ICONS[sections[3].id]}
              title="Contacto"
              description="A quién puede llamar el Centro Coordinador."
              complete={sections[3].complete}
            >
              <TextField
                {...fieldProps('contactName')}
                label="Nombre y apellido del responsable"
                autoComplete="name"
              />
              <TextField
                {...fieldProps('contactPhone')}
                label="Teléfono"
                type="tel"
                autoComplete="tel"
                hint="Con código de área. Por ejemplo: 0221 555-1234."
              />
            </FormSection>
          </form>

          {!isDesktop && (
            <EmergencyPreview values={values} title="Revisá el reporte antes de enviarlo" />
          )}
        </div>

        {isDesktop && (
          <aside
            aria-label="Mapa, vista previa y envío"
            className="sticky top-[4.5rem] flex max-h-[calc(100dvh-5.5rem)] flex-col gap-3"
          >
            {locationPanel}
            <EmergencyPreview
              values={values}
              className="min-h-40 shrink"
              footer={
                <div className="space-y-2">
                  {submitErrorAlert}
                  <Button
                    type="submit"
                    form={FORM_ID}
                    loading={submitting}
                    className="w-full py-3!"
                  >
                    {submitLabel}
                  </Button>
                  <p className="text-center text-sm text-ink-soft" aria-live="polite">
                    {missingText}
                  </p>
                </div>
              }
            />
          </aside>
        )}
      </div>

      {!isDesktop && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-fog/85 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-10px_24px_-18px_rgb(23_33_47/0.5)] backdrop-blur-md sm:px-4">
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-sm leading-tight text-ink-soft" aria-live="polite">
              {missingCount > 0 ? (
                <>
                  Faltan <strong className="text-ink">{missingCount}</strong>{' '}
                  {missingCount === 1 ? 'dato' : 'datos'}
                </>
              ) : (
                <strong className="text-ok">Todo listo</strong>
              )}
            </p>
            <Button type="submit" form={FORM_ID} loading={submitting}>
              {submitLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmergencyFormPage;
