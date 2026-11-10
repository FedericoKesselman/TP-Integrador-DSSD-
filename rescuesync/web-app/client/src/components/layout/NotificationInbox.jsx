/* Los handlers de cada aviso dependen del aviso, así que se pasan como funciones. */
/* eslint-disable react/jsx-no-bind */
import { Bell, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EMERGENCY_TYPES } from '../../features/emergencies/emergency-constants.js';
import { getNotificationCopy } from '../../features/notifications/notification-copy.js';
import { listNotifications, markNotificationRead } from '../../services/notification-service.js';

const POLL_MS = 30000;
const TYPE_LABELS = Object.fromEntries(EMERGENCY_TYPES.map((type) => [type.value, type.label]));

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Bandeja de avisos de la ONG: todos los tipos, contador de no leídos y marcado
// como leído (por aviso o todos juntos). Se consulta al entrar y cada 30 segundos.
function NotificationInbox() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setNotifications(await listNotifications());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const unread = notifications.filter((item) => !item.leida);

  // Marca en pantalla de inmediato y deshace si el backend falla.
  async function markRead(ids) {
    const idSet = new Set(ids);
    setNotifications((current) =>
      current.map((item) => (idSet.has(item.id) ? { ...item, leida: true } : item)),
    );
    try {
      await Promise.all(ids.map((id) => markNotificationRead(id)));
      setError('');
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  function handleOpenNotification(notification) {
    setOpen(false);
    if (!notification.leida) markRead([notification.id]);
    navigate(getNotificationCopy(notification.tipo).to(notification));
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Avisos, ${unread.length} sin leer`}
        className="relative flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-white/80 hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        <span>Avisos</span>
        {unread.length > 0 && (
          <span className="ml-0.5 min-w-5 rounded-full bg-danger px-1.5 text-center text-[11px] font-bold leading-5 text-white">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[1000] mt-2 w-80 overflow-hidden rounded-xl bg-white text-ink shadow-lg ring-1 ring-line sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-bold">Avisos</p>
            <button
              type="button"
              disabled={unread.length === 0}
              onClick={() => markRead(unread.map((item) => item.id))}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft disabled:text-ink-muted disabled:hover:bg-transparent"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Marcar todos como leídos
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {error && (
              <p role="alert" className="px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            {!error && notifications.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ink-muted">No hay avisos.</p>
            )}
            <ul>
              {notifications.map((notification) => {
                const copy = getNotificationCopy(notification.tipo);
                const typeLabel =
                  TYPE_LABELS[notification.emergencyType] ?? notification.emergencyType;
                return (
                  <li key={notification.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(notification)}
                      className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-paper-sunken ${
                        notification.leida ? '' : 'bg-brand-soft/40'
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            notification.leida ? 'bg-transparent' : 'bg-brand'
                          }`}
                        />
                        <span className="min-w-0">
                          <span
                            className={`block ${notification.leida ? 'font-medium' : 'font-bold'}`}
                          >
                            {copy.title}
                            {!notification.leida && <span className="sr-only"> (sin leer)</span>}
                          </span>
                          <span className="block text-xs text-ink-soft">
                            {typeLabel} · {notification.emergencyMunicipality},{' '}
                            {notification.emergencyProvince}
                          </span>
                          {copy.detail && (
                            <span className="mt-0.5 block text-xs text-ink-muted">
                              {copy.detail}
                            </span>
                          )}
                          <span className="mt-0.5 block text-[11px] text-ink-muted">
                            {formatDate(notification.createdAt)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationInbox;
