import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiRequest } from '../../services/api-client.js';

function NotificationInbox() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const items = await apiRequest('/notifications');
        if (active) {
          setNotifications(items);
          setError('');
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);
  return (
    <details className="relative">
      <summary className="cursor-pointer rounded-lg px-2 py-1 text-sm">
        Avisos ({notifications.length})
      </summary>
      <div className="absolute right-0 z-[1000] mt-2 max-h-80 w-72 overflow-y-auto rounded-xl bg-white p-3 text-ink shadow-lg">
        {error && (
          <p role="status" className="text-sm text-danger">
            {error}
          </p>
        )}
        {!error && notifications.length === 0 && <p className="text-sm">No hay avisos.</p>}
        {notifications.map((notification) => (
          <Link
            key={notification.id}
            to={`/emergencias/${notification.emergencyId}/oferta`}
            className="block border-b border-line p-2 text-sm hover:bg-paper-sunken"
          >
            Nueva convocatoria: {notification.emergencyId.slice(0, 8).toUpperCase()}
            <span className="block text-xs text-ink-muted">
              {new Date(notification.createdAt).toLocaleString('es-AR')}
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}

export default NotificationInbox;
