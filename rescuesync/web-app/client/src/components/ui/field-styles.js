const BASE_CONTROL =
  'block w-full rounded-lg border bg-white text-ink ' +
  'shadow-[inset_0_1px_2px_rgb(23_33_47/0.07)] transition-[border-color,box-shadow] duration-150 ' +
  'placeholder:text-ink-muted/70 hover:border-ink-muted focus:outline-none focus:ring-4 ' +
  'disabled:cursor-not-allowed disabled:bg-paper-sunken disabled:text-ink-muted ' +
  'disabled:hover:border-line';

// "sm" solo se usa en escritorio: debajo de 16px iOS hace zoom al tocar el campo.
const CONTROL_SIZES = {
  md: 'px-3.5 py-2.5 text-base',
  sm: 'px-2.5 py-1.5 text-sm',
};

const OK_CONTROL = 'border-line focus:border-brand focus:ring-brand/15';
const ERROR_CONTROL = 'border-danger focus:border-danger focus:ring-danger/15';

export function controlClassName(hasError, size = 'md') {
  return `${BASE_CONTROL} ${CONTROL_SIZES[size]} ${hasError ? ERROR_CONTROL : OK_CONTROL}`;
}

// Campo con error: barra roja a la izquierda de todo el grupo (patrón de GOV.UK). Es un
// pseudo-elemento en el margen, así el contenido no se desplaza cuando aparece el error.
export function groupClassName(hasError, className = '') {
  const bar = hasError ? 'before:opacity-100' : 'before:opacity-0';
  return (
    'relative min-w-0 before:absolute before:inset-y-0 before:-left-3 before:w-1 before:rounded-full ' +
    `before:bg-danger before:transition-opacity before:duration-200 ${bar} ${className}`
  );
}

export function describedBy(id, { hint, error }) {
  const ids = [];
  if (hint) ids.push(`${id}-hint`);
  if (error) ids.push(`${id}-error`);
  return ids.length ? ids.join(' ') : undefined;
}
