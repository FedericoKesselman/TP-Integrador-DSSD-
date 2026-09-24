import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import PropTypes from 'prop-types';

const TONES = {
  error: { box: 'bg-danger-soft text-ink', icon: CircleAlert, iconColor: 'text-danger' },
  warning: { box: 'bg-warn-soft text-ink', icon: TriangleAlert, iconColor: 'text-warn' },
  success: { box: 'bg-ok-soft text-ink', icon: CircleCheck, iconColor: 'text-ok' },
  info: { box: 'bg-brand-soft text-ink', icon: Info, iconColor: 'text-brand' },
};

function Alert({ tone = 'info', title = undefined, action = undefined, children }) {
  const { box, icon: Icon, iconColor } = TONES[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl p-3.5 text-sm ${box}`}
    >
      <Icon className={`mt-px h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5 text-ink-soft' : ''}>{children}</div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

Alert.propTypes = {
  tone: PropTypes.oneOf(['error', 'warning', 'success', 'info']),
  title: PropTypes.string,
  action: PropTypes.node,
  children: PropTypes.node.isRequired,
};

export default Alert;
