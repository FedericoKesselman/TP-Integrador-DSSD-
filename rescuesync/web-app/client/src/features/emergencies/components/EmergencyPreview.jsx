import { Clock, MapPin, MapPinned, Phone, UserRound, Users } from 'lucide-react';
import PropTypes from 'prop-types';

import { formatDateTime, formatRelative } from '../../../lib/dates.js';
import { TYPE_ICONS } from '../emergency-icons.js';
import { EMERGENCY_TYPES, SEVERITY_LEVELS } from '../emergency-constants.js';
import { emergencyValuesShape } from '../emergency-prop-types.js';

function PreviewItem({ icon: Icon, label, children = null, className = '' }) {
  return (
    <div className={`flex min-w-0 gap-2.5 ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-sm text-ink-muted">{label}</dt>
        <dd className={`mt-0.5 break-words ${children ? 'text-ink' : 'text-ink-muted/80'}`}>
          {children || 'Sin completar'}
        </dd>
      </div>
    </div>
  );
}

PreviewItem.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
  className: PropTypes.string,
};

// Resumen del reporte tal como lo va a recibir el Centro Coordinador. Se actualiza mientras se
// completa el formulario y se reutiliza en la confirmación.
function EmergencyPreview({
  values,
  title = 'Vista previa del reporte',
  footer = null,
  className = '',
}) {
  const type = EMERGENCY_TYPES.find((item) => item.value === values.type);
  const severity = SEVERITY_LEVELS.find((item) => item.value === values.severity);
  const TypeIcon = TYPE_ICONS[values.type];
  const typeLabel = values.type === 'otro' ? values.typeOther.trim() || 'Otro' : type?.label;
  const place = [values.municipality?.nombre, values.province?.nombre].filter(Boolean).join(', ');
  const occurredAt = values.occurredAt ? new Date(values.occurredAt) : null;
  const people = values.estimatedAffectedPeople
    ? `${Number(values.estimatedAffectedPeople).toLocaleString('es-AR')} personas`
    : null;
  const contact = [values.contactName.trim(), values.contactPhone.trim()].filter(Boolean);

  return (
    <article
      aria-labelledby="preview-title"
      style={{ '--sev': severity?.color ?? 'var(--color-line)' }}
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-paper shadow-paper ring-1 ring-ink/5 ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1.5 bg-(--sev) transition-colors duration-300"
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pl-6">
        <h2 id="preview-title" className="text-sm font-semibold text-ink-soft">
          {title}
        </h2>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper-sunken text-ink-soft">
              {TypeIcon ? <TypeIcon className="h-5 w-5" aria-hidden="true" /> : '?'}
            </span>
            <span
              className={`truncate text-2xl leading-tight font-bold font-stretch-semi-condensed ${typeLabel ? 'text-ink' : 'text-ink-muted/80'}`}
            >
              {typeLabel || 'Tipo sin elegir'}
            </span>
          </p>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold ${severity ? 'bg-(--sev)/12 text-(--sev)' : 'bg-paper-sunken text-ink-muted'}`}
          >
            {severity ? `Gravedad ${severity.label.toLowerCase()}` : 'Sin gravedad'}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-2">
          <PreviewItem icon={MapPin} label="Lugar">
            {place}
          </PreviewItem>
          <PreviewItem icon={Clock} label="Inicio">
            {occurredAt && !Number.isNaN(occurredAt.getTime())
              ? `${formatDateTime(occurredAt)} (${formatRelative(occurredAt)})`
              : null}
          </PreviewItem>
          <PreviewItem icon={MapPinned} label="Zona afectada" className="sm:col-span-2">
            {values.affectedZone.trim()}
          </PreviewItem>
          <PreviewItem icon={Users} label="Personas afectadas">
            {people}
          </PreviewItem>
          <PreviewItem icon={contact.length ? Phone : UserRound} label="Contacto">
            {contact.join(' | ')}
          </PreviewItem>
        </dl>

        <div className="mt-3 border-t border-line/70 pt-2.5">
          <p className="text-sm text-ink-muted">Descripción</p>
          <p
            className={`mt-1 line-clamp-4 whitespace-pre-line ${values.description.trim() ? 'text-ink' : 'text-ink-muted/80'}`}
          >
            {values.description.trim() || 'Sin completar'}
          </p>
        </div>
      </div>
      {footer && (
        <div className="relative z-10 shrink-0 border-t border-line/70 bg-paper-sunken p-3">
          {footer}
        </div>
      )}
    </article>
  );
}

EmergencyPreview.propTypes = {
  values: emergencyValuesShape.isRequired,
  title: PropTypes.string,
  footer: PropTypes.node,
  className: PropTypes.string,
};

export default EmergencyPreview;
