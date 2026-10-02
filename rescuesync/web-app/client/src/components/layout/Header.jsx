import { LogOut, Siren, UserRound } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

import { isMunicipalOperator, isOngRepresentative, getRoleLabel } from '../../lib/auth-roles.js';

import NotificationInbox from './NotificationInbox.jsx';

function Header({ user = null, userName = '', onLogout }) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const currentUserName = userName || user?.username || '';
  const canRegisterEmergency = isMunicipalOperator(user || currentUserName);
  const roleLabel = getRoleLabel(user || currentUserName);

  return (
    <header className="relative bg-navy text-white shadow-[0_1px_0_rgb(255_255_255/0.06)_inset]">
      <div className="flex items-center justify-between gap-4 px-3 py-2 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link to="/emergencias" className="flex items-center gap-2.5 group">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_4px_12px_-4px_rgb(0_114_187/0.8)] group-hover:bg-brand-hover transition-colors">
              <Siren className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <p className="min-w-0 truncate leading-tight">
              <span className="text-lg font-bold tracking-tight font-stretch-semi-condensed">
                RescueSync
              </span>
              <span className="ml-2.5 hidden text-sm text-white/60 md:inline">
                Red regional de respuesta ante desastres
              </span>
            </p>
          </Link>

          <nav className="hidden sm:flex items-center gap-1.5 ml-4 border-l border-white/15 pl-4">
            <NavLink
              to="/emergencias"
              end
              className={({ isActive }) =>
                `px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white shadow-2xs'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              Bandeja de Incidentes
            </NavLink>
            {canRegisterEmergency && (
              <NavLink
                to="/emergencias/nueva"
                className={({ isActive }) =>
                  `px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white shadow-2xs'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                + Alta de Emergencia
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isOngRepresentative(user) && <NotificationInbox />}
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm ring-1 ring-white/15">
            <UserRound className="h-4 w-4 text-celeste" aria-hidden="true" />
            <span className="sr-only">Usuario: </span>
            <span className="font-medium">{currentUserName}</span>
            <span className="hidden sm:inline-block text-[11px] font-semibold text-white/75 bg-white/15 px-2 py-0.5 rounded-full">
              {roleLabel}
            </span>
          </div>

          {confirmingLogout ? (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="hidden text-white/80 sm:inline">¿Cerrar sesión?</span>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full bg-white px-3 py-1 font-semibold text-navy hover:bg-white/90"
              >
                Sí, salir
              </button>
              <button
                type="button"
                onClick={() => setConfirmingLogout(false)}
                className="rounded-full px-3 py-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingLogout(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Salir
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

Header.propTypes = {
  user: PropTypes.shape({
    username: PropTypes.string,
    role: PropTypes.string,
  }),
  userName: PropTypes.string,
  onLogout: PropTypes.func.isRequired,
};

export default Header;
