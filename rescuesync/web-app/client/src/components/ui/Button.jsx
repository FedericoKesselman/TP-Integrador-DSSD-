import { LoaderCircle } from 'lucide-react';
import PropTypes from 'prop-types';

const VARIANTS = {
  primary:
    'bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(23_33_47/0.2)] ' +
    'hover:bg-brand-hover hover:shadow-lift focus-visible:ring-brand/30 disabled:bg-brand/60',
  secondary:
    'bg-white text-ink ring-1 ring-line shadow-sm hover:ring-ink-muted hover:bg-paper-sunken ' +
    'focus-visible:ring-brand/30 disabled:text-ink-muted',
  ghost: 'text-brand hover:bg-brand-soft focus-visible:ring-brand/30 disabled:text-ink-muted',
};

const SIZES = {
  sm: 'gap-1.5 rounded-lg px-3 py-1.5 text-sm',
  md: 'gap-2 rounded-lg px-4 py-2.5 text-base',
  lg: 'gap-2 rounded-xl px-5 py-3.5 text-lg',
};

function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  icon: Icon = null,
  loading = false,
  disabled = false,
  onClick = undefined,
  form = undefined,
  className = '',
}) {
  return (
    <button
      // eslint-disable-next-line react/button-has-type
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={
        'inline-flex items-center justify-center font-semibold transition-[background-color,box-shadow,transform] ' +
        'duration-150 active:translate-y-px focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed ' +
        `${SIZES[size]} ${VARIANTS[variant]} ${className}`
      }
    >
      {loading && <LoaderCircle className="h-[1.1em] w-[1.1em] animate-spin" aria-hidden="true" />}
      {!loading && Icon && <Icon className="h-[1.1em] w-[1.1em]" aria-hidden="true" />}
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  icon: PropTypes.elementType,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  form: PropTypes.string,
  className: PropTypes.string,
};

export default Button;
