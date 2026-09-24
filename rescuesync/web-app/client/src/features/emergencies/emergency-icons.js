import {
  Activity,
  CircleHelp,
  ClipboardList,
  Flame,
  MapPin,
  Phone,
  TriangleAlert,
  Waves,
} from 'lucide-react';

export const TYPE_ICONS = {
  inundacion: Waves,
  incendio: Flame,
  terremoto: Activity,
  otro: CircleHelp,
};

// Un ícono por sección del formulario (ids de FORM_SECTIONS).
export const SECTION_ICONS = {
  'seccion-tipo': TriangleAlert,
  'seccion-ubicacion': MapPin,
  'seccion-detalle': ClipboardList,
  'seccion-contacto': Phone,
};
