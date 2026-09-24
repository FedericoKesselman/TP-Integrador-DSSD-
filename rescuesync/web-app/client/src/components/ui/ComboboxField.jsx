import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { Check, ChevronsUpDown, LoaderCircle } from 'lucide-react';
import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';

import { normalizeText } from '../../lib/text.js';
import { controlClassName, describedBy } from './field-styles.js';
import FormField from './FormField.jsx';

const optionShape = PropTypes.shape({
  id: PropTypes.string,
  nombre: PropTypes.string.isRequired,
});

// Primero las opciones que empiezan con lo buscado, después las que lo contienen.
function filterOptions(options, query) {
  const needle = normalizeText(query.trim());
  if (!needle) return options;
  const startsWith = [];
  const contains = [];
  options.forEach((option) => {
    const name = normalizeText(option.nombre);
    if (name.startsWith(needle)) startsWith.push(option);
    else if (name.includes(needle)) contains.push(option);
  });
  return [...startsWith, ...contains];
}

function HighlightMatch({ text, query }) {
  const needle = normalizeText(query.trim());
  const index = needle ? normalizeText(text).indexOf(needle) : -1;
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-transparent font-bold text-inherit underline decoration-brand/60 decoration-2 underline-offset-2">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

HighlightMatch.propTypes = {
  text: PropTypes.string.isRequired,
  query: PropTypes.string.isRequired,
};

// Selector con búsqueda (sin distinguir tildes) para listas largas como los municipios.
function ComboboxField({
  id,
  label,
  value = null,
  options,
  onChange,
  onBlur = undefined,
  hint = undefined,
  error = undefined,
  disabled = false,
  loading = false,
  emptyMessage = 'No hay coincidencias. Probá con otra parte del nombre.',
  className = '',
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);

  let content = filtered.map((option) => (
    <ComboboxOption
      key={option.id}
      value={option}
      className="group flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-base text-ink select-none data-focus:bg-brand-soft data-focus:text-brand-hover"
    >
      <Check
        className="invisible mt-1 h-4 w-4 shrink-0 text-brand group-data-selected:visible"
        aria-hidden="true"
      />
      <span className="min-w-0 break-words">
        <HighlightMatch text={option.nombre} query={query} />
      </span>
    </ComboboxOption>
  ));
  if (loading) {
    content = <p className="px-3 py-2.5 text-sm text-ink-muted">Cargando opciones…</p>;
  } else if (filtered.length === 0) {
    content = <p className="px-3 py-2.5 text-sm text-ink-muted">{emptyMessage}</p>;
  }

  return (
    <FormField id={id} label={label} hint={hint} error={error} className={className}>
      <Combobox
        value={value}
        onChange={onChange}
        onClose={() => setQuery('')}
        by="id"
        disabled={disabled}
        immediate
      >
        <div className="relative">
          <ComboboxInput
            id={id}
            autoComplete="off"
            displayValue={(option) => option?.nombre ?? ''}
            onChange={(event) => setQuery(event.target.value)}
            onBlur={onBlur}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy(id, { hint, error })}
            className={`${controlClassName(Boolean(error))} pr-11`}
          />
          <ComboboxButton
            aria-label={`Ver opciones de ${label.toLowerCase()}`}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-ink-muted transition-colors hover:text-brand disabled:hover:text-ink-muted"
          >
            {loading ? (
              <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <ChevronsUpDown className="h-5 w-5" aria-hidden="true" />
            )}
          </ComboboxButton>
        </div>
        <ComboboxOptions
          anchor="bottom start"
          transition
          className="z-50 max-h-72 w-(--input-width) overflow-y-auto rounded-xl bg-white p-1 shadow-float ring-1 ring-ink/10 [--anchor-gap:6px] transition duration-150 ease-out data-closed:-translate-y-1 data-closed:opacity-0"
        >
          {content}
        </ComboboxOptions>
      </Combobox>
    </FormField>
  );
}

ComboboxField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: optionShape,
  options: PropTypes.arrayOf(optionShape).isRequired,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  hint: PropTypes.node,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  emptyMessage: PropTypes.string,
  className: PropTypes.string,
};

export default ComboboxField;
