import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ChevronDown, Download } from 'lucide-react';
import PropTypes from 'prop-types';

import { buildExportUrl } from '../../services/dashboard-service.js';

const OPTIONS = [
  { label: 'Todo (JSON)', formato: 'json' },
  { label: 'Suministros (CSV)', formato: 'csv', dataset: 'suministros' },
  { label: 'Estado de proyectos (CSV)', formato: 'csv', dataset: 'estado-proyectos' },
  { label: 'Tiempos por etapa (CSV)', formato: 'csv', dataset: 'tiempos-etapas' },
  { label: 'Tiempos por tipo (CSV)', formato: 'csv', dataset: 'tiempos-por-tipo' },
];

function ExportMenu({ periodo, disabled = false }) {
  return (
    <Menu as="div" className="relative">
      <MenuButton
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:bg-brand/60"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Exportar
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-[1000] mt-2 w-64 rounded-xl border border-line bg-white p-1 shadow-float focus:outline-none"
      >
        {OPTIONS.map((option) => (
          <MenuItem key={option.label}>
            <a
              href={buildExportUrl({ ...option, ...periodo })}
              download
              className="block rounded-lg px-3 py-2 text-sm text-ink data-[focus]:bg-brand-soft data-[focus]:text-brand"
            >
              {option.label}
            </a>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

ExportMenu.propTypes = {
  periodo: PropTypes.shape({ desde: PropTypes.string, hasta: PropTypes.string }).isRequired,
  disabled: PropTypes.bool,
};

export default ExportMenu;
