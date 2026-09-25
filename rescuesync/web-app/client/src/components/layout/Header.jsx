import { LogOut, Siren, UserRound } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

function Header({ userName, onLogout }) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  return (
    <header className="relative bg-navy text-white shadow-[0_1px_0_rgb(255_255_255/0.06)_inset]">
      <div className="flex items-center justify-between gap-4 px-3 py-2 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_4px_12px_-4px_rgb(0_114_187/0.8)]">
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
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <p className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm ring-1 ring-white/15">
            <UserRound className="h-4 w-4 text-celeste" aria-hidden="true" />
            <span className="sr-only">Usuario: </span>
            {userName}
          </p>

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
  userName: PropTypes.string.isRequired,
  onLogout: PropTypes.func.isRequired,
};

export default Header;
