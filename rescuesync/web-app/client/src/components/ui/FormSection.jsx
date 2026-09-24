import PropTypes from 'prop-types';

import StepMarker from './StepMarker.jsx';

// Una sección de la hoja del formulario. En pantallas muy anchas el título pasa a una columna
// a la izquierda; en el resto va arriba para dejarles todo el ancho a los campos.
function FormSection({
  id,
  step,
  icon,
  title,
  description = undefined,
  complete = false,
  children,
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-20 gap-x-10 gap-y-4 border-t border-line/70 px-4 py-5 first:border-t-0 sm:px-6 lg:py-6 2xl:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)] 2xl:px-8"
    >
      <header className="flex items-center gap-3 2xl:flex-col 2xl:items-start">
        <StepMarker step={step} icon={icon} complete={complete} />
        <div>
          <h2
            id={`${id}-title`}
            className="text-xl leading-tight font-bold tracking-tight text-ink font-stretch-semi-condensed"
          >
            {title}
          </h2>
          {description && <p className="text-sm text-ink-soft">{description}</p>}
        </div>
      </header>
      <div className="grid grid-cols-1 content-start gap-x-6 gap-y-5 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

FormSection.propTypes = {
  id: PropTypes.string.isRequired,
  step: PropTypes.number.isRequired,
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  complete: PropTypes.bool,
  children: PropTypes.node.isRequired,
};

export default FormSection;
