import {
  AlertTriangle,
  Anchor,
  ArrowLeft,
  Bed,
  BedDouble,
  Box,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  Cross,
  Droplets,
  FileText,
  Flame,
  Fuel,
  HeartPulse,
  Layers,
  LifeBuoy,
  Lightbulb,
  MapPin,
  Minus,
  Package,
  PhoneCall,
  Pill,
  Plus,
  Radio,
  Save,
  Send,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Stethoscope,
  Tent,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  UtensilsCrossed,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import MiniIncidentMap from '../components/ui/MiniIncidentMap.jsx';
import {
  calculateSuggestedQuantity,
  generateAdaptivePresets,
  getClassicPresetsAndRange,
  CRITICAL_RESOURCES_BY_TYPE,
  IS_HUMANITARIAN_CALC_ENABLED,
  SEVERITY_FACTORS,
} from '../features/lotes/humanitarian-calculator.js';
import {
  RESOURCE_CATEGORIES,
  SUGGESTED_CATEGORIES_BY_TYPE,
} from '../features/lotes/lote-constants.js';
import { getEmergency } from '../services/emergency-service.js';
import { getLotes, publishConvocatoria, saveLotes } from '../services/lote-service.js';

// Mapa de iconos principales por categoría
const CATEGORY_ICONS = {
  Heart: HeartPulse,
  UtensilsCrossed,
  Tent,
  Shield,
  Truck,
};

// Mapa de iconos específicos por recurso
const RESOURCE_ICONS = {
  paramedicos: UserCheck,
  medicos: Stethoscope,
  ambulancias: Truck,
  'kits-primeros-auxilios': Cross,
  medicamentos: Pill,
  camillas: Bed,
  raciones: Package,
  'modulos-familiares': Boxes,
  'agua-potable': Droplets,
  'leche-formula': Package,
  'cocina-campo': Flame,
  carpas: Tent,
  colchones: BedDouble,
  frazadas: Sparkles,
  lonas: Layers,
  'kits-higiene': Package,
  bomberos: Flame,
  rescatistas: LifeBuoy,
  botes: Anchor,
  motobombas: Waves,
  chalecos: ShieldCheck,
  cisterna: Truck,
  generadores: Zap,
  camiones: Truck,
  combustible: Fuel,
  radios: Radio,
  iluminacion: Lightbulb,
  herramientas: Wrench,
};

const TYPE_HEADER_STYLES = {
  inundacion: 'water-flow-texture shadow-sky-950/20',
  incendio: 'fire-flow-texture shadow-rose-950/20',
};

const TYPE_HEADER_ICONS = {
  inundacion: Waves,
  incendio: Flame,
};

const SEVERITY_GLOWS = {
  baja: 'radial-glow-baja',
  media: 'radial-glow-media',
  alta: 'radial-glow-alta',
  critica: 'radial-glow-critica',
};

const SEVERITY_BADGES = {
  baja: 'bg-emerald-50/95 text-emerald-950 border-emerald-300 ring-2 ring-emerald-500/20',
  media: 'bg-amber-50/95 text-amber-950 border-amber-300 ring-2 ring-amber-500/20',
  alta: 'bg-orange-50/95 text-orange-950 border-orange-300 ring-2 ring-orange-500/20',
  critica: 'bg-rose-50/95 text-rose-950 border-rose-300 ring-2 ring-rose-500/20',
};

// Configuración de hover dinámico por categoría
const CATEGORY_HOVER_STYLES = {
  salud: {
    baseBorder: 'border-slate-200',
    hoverBorder: 'hover:border-rose-500',
    hoverBg: 'hover:bg-rose-50/70',
    hoverText: 'group-hover:text-rose-600',
    hoverIconBg: 'group-hover:bg-rose-100 group-hover:text-rose-600',
    activeRing: 'ring-rose-500 border-rose-500 bg-rose-50/90 text-rose-700',
    glow: 'hover:shadow-rose-500/20',
    accentColor: '#dc2626',
    headerBg: 'bg-rose-600 text-white',
    cardBg: 'bg-rose-50/30 border-rose-200',
    pillActive: 'bg-rose-600 text-white shadow-sm',
  },
  alimentos: {
    baseBorder: 'border-slate-200',
    hoverBorder: 'hover:border-amber-500',
    hoverBg: 'hover:bg-amber-50/70',
    hoverText: 'group-hover:text-amber-700',
    hoverIconBg: 'group-hover:bg-amber-100 group-hover:text-amber-700',
    activeRing: 'ring-amber-500 border-amber-500 bg-amber-50/90 text-amber-800',
    glow: 'hover:shadow-amber-500/20',
    accentColor: '#d97706',
    headerBg: 'bg-amber-600 text-white',
    cardBg: 'bg-amber-50/30 border-amber-200',
    pillActive: 'bg-amber-600 text-white shadow-sm',
  },
  refugio: {
    baseBorder: 'border-slate-200',
    hoverBorder: 'hover:border-purple-500',
    hoverBg: 'hover:bg-purple-50/70',
    hoverText: 'group-hover:text-purple-600',
    hoverIconBg: 'group-hover:bg-purple-100 group-hover:text-purple-600',
    activeRing: 'ring-purple-500 border-purple-500 bg-purple-50/90 text-purple-700',
    glow: 'hover:shadow-purple-500/20',
    accentColor: '#7c3aed',
    headerBg: 'bg-purple-600 text-white',
    cardBg: 'bg-purple-50/30 border-purple-200',
    pillActive: 'bg-purple-600 text-white shadow-sm',
  },
  rescate: {
    baseBorder: 'border-slate-200',
    hoverBorder: 'hover:border-sky-500',
    hoverBg: 'hover:bg-sky-50/70',
    hoverText: 'group-hover:text-sky-600',
    hoverIconBg: 'group-hover:bg-sky-100 group-hover:text-sky-600',
    activeRing: 'ring-sky-500 border-sky-500 bg-sky-50/90 text-sky-700',
    glow: 'hover:shadow-sky-500/20',
    accentColor: '#0284c7',
    headerBg: 'bg-sky-600 text-white',
    cardBg: 'bg-sky-50/30 border-sky-200',
    pillActive: 'bg-sky-600 text-white shadow-sm',
  },
  logistica: {
    baseBorder: 'border-slate-200',
    hoverBorder: 'hover:border-emerald-500',
    hoverBg: 'hover:bg-emerald-50/70',
    hoverText: 'group-hover:text-emerald-600',
    hoverIconBg: 'group-hover:bg-emerald-100 group-hover:text-emerald-600',
    activeRing: 'ring-emerald-500 border-emerald-500 bg-emerald-50/90 text-emerald-700',
    glow: 'hover:shadow-emerald-500/20',
    accentColor: '#059669',
    headerBg: 'bg-emerald-600 text-white',
    cardBg: 'bg-emerald-50/30 border-emerald-200',
    pillActive: 'bg-emerald-600 text-white shadow-sm',
  },
};

// Generador de opciones rápidas: dinámicas (Esfera) o clásicas fijas según VITE_ENABLE_HUMANITARIAN_CALC
function getResourcePresetsAndRange(res, currentQty, emergency) {
  if (!IS_HUMANITARIAN_CALC_ENABLED) {
    return getClassicPresetsAndRange(res, currentQty);
  }

  const people = emergency?.estimatedAffectedPeople || 100;
  const severity = emergency?.severity || 'media';
  const type = emergency?.type || 'otro';

  const suggestedQty = calculateSuggestedQuantity(res.id, people, severity, type);
  return {
    ...generateAdaptivePresets(suggestedQty, currentQty),
    isDynamic: true,
  };
}

function EmergencyLotesPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [emergency, setEmergency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Estado de selecciones: { [categoryId]: { [resourceId]: { selected, qty, notes } } }
  const [selections, setSelections] = useState({});
  const [expandedCategory, setExpandedCategory] = useState(null);
  // Estado de despliegue de notas individuales: { [resourceId]: boolean }
  const [openNotes, setOpenNotes] = useState({});

  const toggleNote = (resId, currentNotes = '') => {
    setOpenNotes((prev) => {
      const isCurrentlyOpen = prev[resId] ?? Boolean(currentNotes && currentNotes.trim().length > 0);
      return { ...prev, [resId]: !isCurrentlyOpen };
    });
  };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [emgData, lotesData] = await Promise.all([getEmergency(id), getLotes(id)]);
        setEmergency(emgData);

        if (lotesData && lotesData.length > 0) {
          const rebuilt = {};
          lotesData.forEach((lote) => {
            const category = RESOURCE_CATEGORIES.find((cat) =>
              cat.resources.some(
                (resource) =>
                  resource.label === lote.resourceType || resource.id === lote.resourceType,
              ),
            );
            if (!category) return;

            const resource = category.resources.find(
              (item) => item.label === lote.resourceType || item.id === lote.resourceType,
            );
            if (!rebuilt[category.id]) rebuilt[category.id] = {};
            rebuilt[category.id][resource.id] = {
              selected: true,
              qty: lote.quantityRequested,
              notes: lote.notes || '',
            };
          });
          setSelections(rebuilt);
          const firstWithLotes = RESOURCE_CATEGORIES.find(
            (c) => rebuilt[c.id] && Object.values(rebuilt[c.id]).some((r) => r.selected),
          );
          if (firstWithLotes) {
            setExpandedCategory(firstWithLotes.id);
          }
        } else if (emgData.status === 'registrada') {
          const suggestedOrder =
            SUGGESTED_CATEGORIES_BY_TYPE[emgData.type] || SUGGESTED_CATEGORIES_BY_TYPE.otro;
          setExpandedCategory(suggestedOrder[0]);
        }
      } catch (err) {
        setError(err.message || 'No se pudo cargar la información de la emergencia.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const isPublished = emergency?.status === 'convocatoria_abierta';

  const isResourceSelected = (catId, resId) => selections[catId]?.[resId]?.selected === true;
  const getResourceQty = (catId, resId, defaultQty) =>
    selections[catId]?.[resId]?.qty ?? defaultQty;
  const getResourceNotes = (catId, resId) => selections[catId]?.[resId]?.notes ?? '';

  const toggleResource = (catId, resId, defaultQty) => {
    if (isPublished) return;
    setSelections((prev) => {
      const catState = { ...(prev[catId] || {}) };
      if (catState[resId]?.selected) {
        catState[resId] = { ...catState[resId], selected: false };
      } else {
        const initialQty = IS_HUMANITARIAN_CALC_ENABLED
          ? calculateSuggestedQuantity(
              resId,
              emergency?.estimatedAffectedPeople,
              emergency?.severity,
              emergency?.type,
            )
          : defaultQty;

        catState[resId] = {
          selected: true,
          qty: catState[resId]?.qty ?? initialQty ?? defaultQty,
          notes: catState[resId]?.notes ?? '',
        };
      }
      return { ...prev, [catId]: catState };
    });
  };

  // Botón Mágico: carga automática per cápita según normas internacionales
  const applyAutoHumanitarianSuggestion = () => {
    if (isPublished || !emergency) return;
    const type = emergency.type || 'otro';
    const criticalList = CRITICAL_RESOURCES_BY_TYPE[type] || CRITICAL_RESOURCES_BY_TYPE.otro;
    const people = emergency.estimatedAffectedPeople || 100;
    const severity = emergency.severity || 'media';

    const newSelections = { ...selections };

    criticalList.forEach((item) => {
      if (!newSelections[item.categoryId]) {
        newSelections[item.categoryId] = {};
      }
      const calculatedQty = calculateSuggestedQuantity(
        item.resourceId,
        people,
        severity,
        type,
      );
      newSelections[item.categoryId][item.resourceId] = {
        selected: true,
        qty: calculatedQty,
        notes: newSelections[item.categoryId][item.resourceId]?.notes || '',
      };
    });

    setSelections(newSelections);

    const suggestedCategories =
      SUGGESTED_CATEGORIES_BY_TYPE[type] || SUGGESTED_CATEGORIES_BY_TYPE.otro;
    if (suggestedCategories && suggestedCategories[0]) {
      setExpandedCategory(suggestedCategories[0]);
    }

    setSuccessMessage(
      `¡Desglose humanitario aplicado! Se calcularon ${criticalList.length} recursos prioritarios según normas técnicas para ${Number(people).toLocaleString('es-AR')} personas (gravedad ${severity}). Podés ajustar cantidades con los sliders o agregar más insumos.`
    );
  };

  // Sin límites artificiales: permite cualquier valor numérico >= 1
  const updateQty = (catId, resId, newQty) => {
    if (isPublished) return;
    const parsed = Number(newQty);
    setSelections((prev) => {
      const catState = { ...(prev[catId] || {}) };
      catState[resId] = {
        ...catState[resId],
        qty: Number.isNaN(parsed) ? 1 : Math.max(1, parsed),
      };
      return { ...prev, [catId]: catState };
    });
  };

  const updateNotes = (catId, resId, notes) => {
    if (isPublished) return;
    setSelections((prev) => {
      const catState = { ...(prev[catId] || {}) };
      catState[resId] = { ...catState[resId], notes };
      return { ...prev, [catId]: catState };
    });
  };

  const getCategoryCount = (catId) => {
    const catState = selections[catId];
    if (!catState) return 0;
    return Object.values(catState).filter((r) => r.selected).length;
  };

  const selectedLotes = useMemo(
    () =>
      RESOURCE_CATEGORIES.flatMap((cat) => {
      const catState = selections[cat.id];
        if (!catState) return [];

        return cat.resources
          .filter((res) => catState[res.id]?.selected)
          .map((res) => ({
              categoryId: cat.id,
              resourceType: res.label,
              quantityRequested: catState[res.id].qty ?? res.defaultQty,
              unit: res.unit,
              notes: catState[res.id].notes ?? '',
          }));
      }),
    [selections],
  );

  const totalLotes = selectedLotes.length;
  const totalUnidades = selectedLotes.reduce((sum, l) => sum + (l.quantityRequested || 0), 0);
  const activeCategoryCount = RESOURCE_CATEGORIES.filter((c) => getCategoryCount(c.id) > 0).length;

  const handleSave = async () => {
    setError(null);
    setSuccessMessage(null);
    if (selectedLotes.length === 0) {
      setError('Seleccioná al menos un recurso antes de guardar.');
      return;
    }
    try {
      setSaving(true);
      await saveLotes(id, selectedLotes);
      setSuccessMessage('El desglose de lotes se guardó correctamente como borrador de trabajo.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setError(null);
    setSuccessMessage(null);
    if (selectedLotes.length === 0) {
      setError('Debés asignar al menos un lote de ayuda para publicar la convocatoria.');
      setShowConfirmModal(false);
      return;
    }
    try {
      setPublishing(true);
      await saveLotes(id, selectedLotes);
      const res = await publishConvocatoria(id);
      setEmergency((prev) => ({ ...prev, status: res.status }));
      setShowConfirmModal(false);
      setSuccessMessage('¡Convocatoria publicada con éxito!');
    } catch (err) {
      setError(err.message);
      setShowConfirmModal(false);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-tactical-grid">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand" />
        <p className="text-lg font-bold text-slate-700">Cargando situación de emergencia…</p>
      </div>
    );
  }

  if (!emergency) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Alert tone="error">La emergencia solicitada no existe o no pudo recuperarse.</Alert>
        <div className="mt-6">
          <Button onClick={() => navigate('/emergencias')} icon={ArrowLeft}>
            Regresar a la Bandeja de Incidentes
          </Button>
        </div>
      </div>
    );
  }

  const sortedCategories = (() => {
    const order =
      SUGGESTED_CATEGORIES_BY_TYPE[emergency.type] || SUGGESTED_CATEGORIES_BY_TYPE.otro;
    return order.map((catId) => RESOURCE_CATEGORIES.find((c) => c.id === catId));
  })();

  const occurredDate = new Date(emergency.occurredAt || emergency.createdAt);
  const EmergencyTypeIcon = TYPE_HEADER_ICONS[emergency.type] || AlertTriangle;
  const typeHeaderStyle = TYPE_HEADER_STYLES[emergency.type] || 'bg-slate-900 shadow-slate-900/20';
  const severityGlow = SEVERITY_GLOWS[emergency.severity] || SEVERITY_GLOWS.baja;
  const severityBadge = SEVERITY_BADGES[emergency.severity] || SEVERITY_BADGES.baja;

  return (
    <div className="min-h-screen bg-tactical-grid text-slate-800 pb-32 font-sans">
      {/* ─── Sub-Barra de Navegación Operativa ─── */}
      <div className="border-b border-slate-200/90 bg-white/95 px-6 py-3.5 shadow-xs backdrop-blur-md sticky top-0 z-30 lg:px-12">
        <div className="mx-auto flex max-w-[1740px] items-center justify-between gap-4">
          <Link
            to="/emergencias"
            className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-brand transition-all"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1 text-slate-400 group-hover:text-brand" />
            <span>Volver a la Bandeja de Incidentes</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block rounded-full bg-slate-100 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Desglose Operativo · {emergency.municipality}
            </span>
            {isPublished ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-600/20">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Convocatoria Publicada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-600/20">
                <Clock className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                Edición de Lotes Activa
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1740px] px-6 pt-8 lg:px-12">
        {/* Alertas */}
        {error && (
          <div className="mb-6">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        {successMessage && (
          <div className="mb-6">
            <Alert tone="success">{successMessage}</Alert>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            1. COMPONENTE DE PRESENTACIÓN DE LA EMERGENCIA
            - CATÁSTROFE CON TEXTURA
            - GRAVEDAD CON LUZ RADIAL DIFUMINADA
            - FECHA MODERNA Y ELEGANTE
            - CARDS ESTILO LUPA DENTAL (INGRESOS/GASTOS)
        ═══════════════════════════════════════════════════════════ */}
        <section className="mb-10 overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-md">
          {/* Cabecera de Alerta: Catástrofe con Textura + Gravedad con Luz Radial + Fecha */}
          <div className="border-b border-slate-100 bg-slate-50/70 p-6 lg:p-8 flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-5">
              {/* COMPONENTE LLAMATIVO CON TEXTURA DE CATÁSTROFE */}
              <div
                className={`relative flex items-center gap-3.5 rounded-2xl px-6 py-3.5 shadow-lg text-white overflow-hidden ${typeHeaderStyle}`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md text-white shadow-inner">
                  <EmergencyTypeIcon className="h-6 w-6 animate-pulse" />
                </span>
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-widest text-white/80">
                    Alerta Territorial
                  </span>
                  <span className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white drop-shadow-sm">
                    {emergency.type === 'otro' && emergency.typeOther
                      ? emergency.typeOther
                      : emergency.type}
                  </span>
                </div>
              </div>

              {/* COMPONENTE DE GRAVEDAD CON LUZ RADIAL DIFUMINADA */}
              <div className="relative flex items-center py-2 px-3">
                {/* Halo de luz radial difuminada suave */}
                <div
                  className={`absolute inset-0 -m-5 pointer-events-none rounded-full blur-2xl opacity-75 ${severityGlow}`}
                />
                <div
                  className={`relative flex items-center gap-2.5 rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-wider border shadow-md ${severityBadge}`}
                >
                  <span
                    className={`h-3 w-3 rounded-full ${
                      emergency.severity === 'critica'
                        ? 'bg-rose-600 animate-ping-slow'
                        : 'bg-orange-500 animate-pulse'
                    }`}
                  />
                  <span>Gravedad {emergency.severity}</span>
                </div>
              </div>
            </div>

            {/* FECHA MODERNA Y ELEGANTE (Sin rodeado naranja plano) */}
            <div className="flex items-center gap-3.5 rounded-2xl bg-white border border-slate-200/90 px-5 py-3 shadow-xs">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Calendar className="h-5 w-5" />
              </span>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Momento de Detección
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900">
                  {occurredDate.toLocaleDateString('es-AR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  ·{' '}
                  <span className="text-brand">
                    {occurredDate.toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    hs
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Ficha Táctica: Geografía + Tarjetas Estilo Dashboard Lupa Dental */}
          <div className="p-7 lg:p-9 grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            {/* 8 Columnas Izquierda: Héroe Geográfico y Tarjetas Inspiradas en Ingresos/Gastos */}
            <div className="lg:col-span-8 space-y-6">
              {/* TÍTULO HERO GEOGRÁFICO */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <MapPin className="h-4 w-4 text-brand" />
                  <span className="text-xs font-black uppercase tracking-widest text-brand">
                    Teatro de Operaciones y Localización
                  </span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                  {emergency.municipality}, {emergency.province}
                </h1>
                {emergency.affectedZone && (
                  <div className="mt-2.5 inline-flex items-center gap-2 rounded-2xl bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-bold text-slate-800 shadow-2xs">
                    <Compass className="h-4 w-4 text-brand" />
                    <span>Área Focal: {emergency.affectedZone}</span>
                  </div>
                )}
              </div>

              {/* GRID DE CARDS ESTILO LUPA DENTAL (INGRESOS / GASTOS) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                {/* Card 1: Diagnóstico Táctico Operacional */}
                <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-brand">
                          <TrendingUp className="h-4 w-4" />
                        </span>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Diagnóstico Táctico
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>

                    <p className="text-sm font-bold leading-relaxed text-slate-800">
                      {emergency.description || 'Sin descripción detallada informada.'}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-brand rounded-full" style={{ width: '85%' }} />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                      Prioridad Operativa: Despacho Inmediato
                    </span>
                  </div>
                </div>

                {/* Card 2: Población Civil Damnificada */}
                <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                          <Users className="h-4 w-4" />
                        </span>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Población Damnificada
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                        {emergency.estimatedAffectedPeople
                          ? Number(emergency.estimatedAffectedPeople).toLocaleString('es-AR')
                          : 'Sin precisar'}
                      </span>
                      <span className="text-xs font-bold text-slate-500">personas</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      en zona de riesgo directo · {emergency.municipality}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-1.5 w-full rounded-full bg-rose-100 overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: '90%' }} />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-rose-700">
                      Alerta Activa de Asistencia
                    </span>
                  </div>
                </div>
              </div>

              {/* Fila de Comando y Contacto Local */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-3.5 shadow-2xs">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    <PhoneCall className="h-4 w-4 text-brand" />
                  </span>
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Autoridad Local a Cargo
                    </span>
                    <span className="text-sm font-extrabold text-slate-800">
                      {emergency.contactName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                  <span className="rounded-xl bg-white border border-slate-200 px-3 py-1.5 shadow-2xs">
                    📞 {emergency.contactPhone}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Columnas Derecha: Mini-Mapa Satelital */}
            <div className="lg:col-span-4 w-full">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
                <div className="mb-2.5 flex items-center justify-between px-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-brand" />
                    Geo-Foco Satelital
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                    Enlace Activo
                  </span>
                </div>
                <MiniIncidentMap
                  latitude={emergency.latitude}
                  longitude={emergency.longitude}
                  municipalityId={emergency.municipalityId}
                  provinceId={emergency.provinceId}
                  municipality={emergency.municipality}
                  province={emergency.province}
                  severity={emergency.severity}
                  height="h-60"
                  zoom={12}
                  interactive
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            BANNER MÁGICO: CÁLCULO HUMANITARIO DINÁMICO (NORMAS ESFERA)
            Solo se activa si VITE_ENABLE_HUMANITARIAN_CALC=true en el archivo .env
        ═══════════════════════════════════════════════════════════ */}
        {IS_HUMANITARIAN_CALC_ENABLED && !isPublished && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-7 text-white shadow-xl relative">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/20 blur-3xl pointer-events-none" />
            <div className="absolute right-1/3 -bottom-16 h-48 w-48 rounded-full bg-purple-500/15 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 mb-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/30 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-amber-300">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-spin-slow" />
                    Motor Esfera & Cascos Blancos
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    Reserva operativa:{' '}
                    <strong className="text-white">
                      {(SEVERITY_FACTORS[emergency.severity] || 1.0).toFixed(1)}x
                    </strong>{' '}
                    (Gravedad {emergency.severity})
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                  Cálculo Per Cápita para{' '}
                  <span className="text-amber-300 underline decoration-amber-400/40 underline-offset-4">
                    {Number(emergency.estimatedAffectedPeople || 100).toLocaleString('es-AR')}{' '}
                    personas damnificadas
                  </span>
                </h3>

                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  El sistema dimensiona automáticamente los lotes según normas internacionales de
                  socorro: agua potable (3 L/día), raciones alimentarias calientes (2/día), abrigo
                  integral y dotación médica escalonada para {emergency.municipality}.
                </p>

                {/* Ratios técnicos clave en pastillas */}
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-200">
                  <span className="rounded-xl bg-white/10 px-2.5 py-1 border border-white/10">
                    💧 3 L agua/día/pers
                  </span>
                  <span className="rounded-xl bg-white/10 px-2.5 py-1 border border-white/10">
                    🍲 2 raciones/día/pers
                  </span>
                  <span className="rounded-xl bg-white/10 px-2.5 py-1 border border-white/10">
                    🛏️ 1 colchón/pers
                  </span>
                  <span className="rounded-xl bg-white/10 px-2.5 py-1 border border-white/10">
                    ⛺ 1 carpa / 5 pers
                  </span>
                  <span className="rounded-xl bg-white/10 px-2.5 py-1 border border-white/10">
                    🩺 1 paramédico / 60 pers
                  </span>
                </div>
              </div>

              {/* Botón de acción destacado */}
              <div className="flex flex-col sm:flex-row lg:flex-col shrink-0 gap-2.5">
                <button
                  type="button"
                  onClick={applyAutoHumanitarianSuggestion}
                  className="group relative inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-6 py-4 text-sm font-black text-slate-950 shadow-lg shadow-amber-400/25 hover:shadow-amber-400/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Sparkles className="h-5 w-5 text-slate-950 group-hover:rotate-12 transition-transform" />
                  <span>🪄 Aplicar Desglose Sugerido</span>
                </button>
                <span className="text-[11px] text-center text-slate-400 font-medium">
                  {totalLotes > 0
                    ? 'Sobrescribe los lotes con la recomendación técnica'
                    : '1 solo click para cargar la respuesta inicial óptima'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            2. SELECTOR DE CATEGORÍAS CON HOVER DINÁMICO
        ═══════════════════════════════════════════════════════════ */}
        {!isPublished && (
          <>
            <section className="mb-10">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    <span className="text-xs font-extrabold uppercase tracking-widest text-brand">
                      Selección de Fuerzas y Suministros
                    </span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">
                    Categorías de Ayuda Humanitaria
                  </h2>
                  <p className="text-sm text-slate-500">
                    Hacé click para abrir y configurar los insumos necesarios sin límites en el
                    formulario.
                  </p>
                </div>

                {totalLotes > 0 && (
                  <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 border border-slate-200 shadow-xs">
                    <span className="text-xs font-bold text-slate-700">
                      {activeCategoryCount} categorías activas ·{' '}
                      <strong className="text-brand">{totalLotes}</strong> recursos ·{' '}
                      <strong className="text-brand">{totalUnidades.toLocaleString('es-AR')}</strong>{' '}
                      unidades
                    </span>
                  </div>
                )}
              </div>

              {/* Grilla de las 5 Categorías */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {sortedCategories.map((cat) => {
                  const CatIcon = CATEGORY_ICONS[cat.icon] || Shield;
                  const count = getCategoryCount(cat.id);
                  const isExpanded = expandedCategory === cat.id;
                  const hoverTheme = CATEGORY_HOVER_STYLES[cat.id] || CATEGORY_HOVER_STYLES.rescate;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                      className={`group relative flex flex-col items-center gap-3 rounded-3xl border-2 p-5 text-center transition-all duration-300 ${
                        isExpanded
                          ? `${hoverTheme.activeRing} shadow-xl scale-[1.02]`
                          : `bg-white ${hoverTheme.baseBorder} ${hoverTheme.hoverBorder} ${hoverTheme.hoverBg} shadow-xs hover:shadow-xl hover:-translate-y-1 ${hoverTheme.glow}`
                      } cursor-pointer`}
                    >
                      {count > 0 && (
                        <span
                          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white shadow-md transition-transform group-hover:scale-110"
                          style={{ backgroundColor: hoverTheme.accentColor }}
                        >
                          {count}
                        </span>
                      )}

                      <span
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner transition-all duration-300 ${
                          isExpanded
                            ? 'bg-white text-slate-900 shadow-md scale-105'
                            : `bg-slate-100 text-slate-600 ${hoverTheme.hoverIconBg}`
                        }`}
                      >
                        <CatIcon className="h-7 w-7" />
                      </span>

                      <div>
                        <span
                          className={`block text-base font-black tracking-tight leading-tight transition-colors ${
                            isExpanded ? 'text-inherit' : `text-slate-800 ${hoverTheme.hoverText}`
                          }`}
                        >
                          {cat.shortLabel}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                          {cat.resources.length} tipos disponibles
                        </span>
                      </div>

                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-slate-700">
                          {isExpanded ? (
                            <>
                              Ocultar <ChevronUp className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              Configurar <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════
                3. PANEL EXPANDIDO CON CONTROLES FLEXIBLES
                - PRESETS ARRIBA DEL SLIDER
                - NÚMERO EDITABLE GIGANTE (SIN LÍMITES NI BLOQUEOS)
                - NOTA OPERATIVA GRANDE QUE APROVECHA EL ANCHO
            ═══════════════════════════════════════════════════════════ */}
            {expandedCategory && (() => {
              const cat = RESOURCE_CATEGORIES.find((c) => c.id === expandedCategory);
              if (!cat) return null;
              const CatIcon = CATEGORY_ICONS[cat.icon] || Shield;
              const hoverTheme = CATEGORY_HOVER_STYLES[cat.id] || CATEGORY_HOVER_STYLES.rescate;

              return (
                <section className="mb-10 overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-md animate-in slide-in-from-top-3 duration-300">
                  {/* Header de Categoría */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-4 px-8 py-5 text-white ${hoverTheme.headerBg}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white shadow-inner backdrop-blur-sm">
                        <CatIcon className="h-6 w-6" />
                      </span>
                      <div>
                        <h3 className="text-xl font-black tracking-tight">{cat.label}</h3>
                        <p className="text-xs text-white/85">
                          Ajustá cantidades con los presets, con el slider o escribiendo libremente
                          con el teclado.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white/20 px-3.5 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-sm">
                        {getCategoryCount(cat.id)} de {cat.resources.length} seleccionados
                      </span>
                    </div>
                  </div>

              {/* Lista de Recursos con Layout Ancho y Sin Restricciones */}
              <div className="divide-y divide-slate-100 p-4 space-y-3">
                {cat.resources.map((res) => {
                  const selected = isResourceSelected(cat.id, res.id);
                  const qty = getResourceQty(cat.id, res.id, res.defaultQty);
                  const notes = getResourceNotes(cat.id, res.id);
                  const ResIcon = RESOURCE_ICONS[res.id] || Box;
                  const { presets, min, max, step, suggested } = getResourcePresetsAndRange(
                    res,
                    qty,
                    emergency,
                  );
                  const isNoteOpen = openNotes[res.id] ?? Boolean(notes && notes.trim().length > 0);
                  const sliderVal = Math.min(Math.max(1, Number(qty) || 1), max);

                  return (
                    <div
                      key={res.id}
                      className={`flex flex-col gap-2 rounded-2xl p-4 transition-all border ${
                        selected
                          ? 'bg-slate-50/90 border-slate-300/80 shadow-xs'
                          : 'bg-white border-slate-200/70 opacity-70 hover:opacity-100 hover:bg-slate-50/40'
                      }`}
                    >
                      {/* Fila Principal: Izquierda (selector + dibujo + título) | Derecha (presets + slider + input + botón nota) */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Izquierda: Checkbox + Icono + Título/Unidad */}
                        <div className="flex items-center gap-3.5 min-w-[260px] sm:min-w-[300px]">
                          <button
                            type="button"
                            disabled={isPublished}
                            onClick={() => toggleResource(cat.id, res.id, res.defaultQty)}
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-all cursor-pointer ${
                              selected
                                ? 'border-transparent text-white shadow-md scale-105'
                                : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                            }`}
                            style={{
                              backgroundColor: selected ? hoverTheme.accentColor : '#ffffff',
                            }}
                            aria-label={`${selected ? 'Quitar' : 'Agregar'} ${res.label}`}
                          >
                            <Check className="h-5 w-5 stroke-[3]" />
                          </button>

                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner ${
                              selected
                                ? 'bg-white text-slate-900 border border-slate-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <ResIcon className="h-5 w-5" />
                          </span>

                          <div>
                            <p
                              className={`text-base font-black leading-tight ${
                                selected ? 'text-slate-900' : 'text-slate-600'
                              }`}
                            >
                              {res.label}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="text-xs font-semibold text-slate-400">
                                Unidad:{' '}
                                <strong className="text-slate-600 font-extrabold">{res.unit}</strong>
                                {!IS_HUMANITARIAN_CALC_ENABLED && (
                                  <span className="ml-1 text-[11px] font-medium text-slate-400">
                                    (Predeterminado: {res.defaultQty})
                                  </span>
                                )}
                              </span>
                              {IS_HUMANITARIAN_CALC_ENABLED && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700 ring-1 ring-blue-600/20">
                                  <Sparkles className="h-2.5 w-2.5 text-blue-600" />
                                  Sugerido Esfera: {suggested.toLocaleString('es-AR')} {res.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Derecha: Si no está seleccionado -> Botón simple de asignar */}
                        {!selected ? (
                          <button
                            type="button"
                            disabled={isPublished}
                            onClick={() => toggleResource(cat.id, res.id, res.defaultQty)}
                            className="rounded-full bg-white border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 shadow-2xs hover:bg-slate-100 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                          >
                            <span>
                              {IS_HUMANITARIAN_CALC_ENABLED
                                ? `+ Asignar (${suggested.toLocaleString('es-AR')} ${res.unit})`
                                : '+ Asignar a la Convocatoria'}
                            </span>
                          </button>
                        ) : (
                          /* Si está seleccionado -> Opciones sugeridas adaptativas arriba, Controles abajo */
                          <div className="flex flex-col items-start lg:items-end gap-1.5 flex-1 lg:max-w-2xl">
                            {/* Opciones rápidas sugeridas (presets) */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                                <Sliders className="h-3 w-3" />
                                {IS_HUMANITARIAN_CALC_ENABLED ? 'Opciones adaptadas:' : 'Opciones rápidas:'}
                              </span>
                              {presets.map((p) => {
                                const isActive = Number(qty) === p;
                                const isSuggested = IS_HUMANITARIAN_CALC_ENABLED && p === suggested;
                                let presetStyle =
                                  'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 shadow-2xs';
                                if (isSuggested) {
                                  presetStyle =
                                    'border-2 border-amber-400 bg-amber-50/90 text-amber-950 font-black shadow-xs hover:bg-amber-100';
                                }
                                if (isActive) presetStyle = hoverTheme.pillActive;

                                return (
                                  <button
                                    key={p}
                                    type="button"
                                    disabled={isPublished}
                                    onClick={() => updateQty(cat.id, res.id, p)}
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${presetStyle}`}
                                  >
                                    {isSuggested && !isActive && (
                                      <Sparkles className="h-2.5 w-2.5 text-amber-500 fill-amber-400" />
                                    )}
                                    <span>{p.toLocaleString('es-AR')}</span>
                                    {isSuggested && (
                                      <span className="text-[9px] text-amber-800 font-extrabold">(Esfera)</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Controles en línea compacta: [-] Slider [+] Input editable + Botón Nota */}
                            <div className="flex items-center gap-2 w-full justify-start lg:justify-end flex-wrap sm:flex-nowrap">
                              <button
                                type="button"
                                disabled={isPublished}
                                onClick={() =>
                                  updateQty(cat.id, res.id, Math.max(1, (Number(qty) || 1) - step))
                                }
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                                title="Restar paso"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>

                              <div className="w-28 sm:w-40 md:w-52 flex items-center px-1">
                                <input
                                  type="range"
                                  min={min}
                                  max={max}
                                  step={step}
                                  disabled={isPublished}
                                  value={sliderVal}
                                  onChange={(e) => updateQty(cat.id, res.id, e.target.value)}
                                  className="rs-slider w-full"
                                  style={{ accentColor: hoverTheme.accentColor }}
                                />
                              </div>

                              <button
                                type="button"
                                disabled={isPublished}
                                onClick={() =>
                                  updateQty(cat.id, res.id, (Number(qty) || 1) + step)
                                }
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                                title="Sumar paso"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>

                              {/* Input de Número Editable libremente por teclado (sin límite de formulario) */}
                              <div className="flex items-center gap-1.5 rounded-xl border-2 border-slate-300/80 bg-white px-2.5 py-1 shadow-inner focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 min-w-[115px] justify-between">
                                <input
                                  type="number"
                                  min="1"
                                  disabled={isPublished}
                                  value={qty}
                                  onChange={(e) => updateQty(cat.id, res.id, e.target.value)}
                                  className="w-16 bg-transparent text-xl font-black text-slate-900 focus:outline-none text-right"
                                  aria-label={`Cantidad editable de ${res.label}`}
                                />
                                <span className="text-[11px] font-black text-slate-500 uppercase">
                                  {res.unit}
                                </span>
                              </div>

                              {/* Botón para desplegar / contraer la Nota */}
                              <button
                                type="button"
                                disabled={isPublished}
                                onClick={() => toggleNote(res.id, notes)}
                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                  notes || isNoteOpen
                                    ? 'border-brand/40 bg-brand/10 text-brand font-black'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 shadow-2xs'
                                }`}
                                title={isNoteOpen ? 'Ocultar nota' : 'Agregar o editar nota operativa'}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span>{notes ? 'Nota' : '+ Nota'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Fila Desplegable de Nota Operativa (Abajo, sólo cuando está abierta o si ya tiene texto) */}
                      {selected && isNoteOpen && (
                        <div className="pt-2 border-t border-slate-200/60 flex items-center gap-3 animate-in fade-in duration-200">
                          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                            <FileText className="h-3.5 w-3.5 text-brand" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                              Nota operativa:
                            </span>
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              disabled={isPublished}
                              placeholder="Detalles específicos (ej. adultos mayores, zona norte, trasladar al hospital Rossi de Tolosa, guardia 24hs)..."
                              value={notes}
                              onChange={(e) => updateNotes(cat.id, res.id, e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs"
                            />
                          </div>
                          {!isPublished && (
                            <button
                              type="button"
                              onClick={() => toggleNote(res.id, notes)}
                              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100"
                              title="Ocultar campo de nota"
                            >
                              Ocultar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
            })()}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════
            4. RESUMEN DEL DESGLOSE - PUNTO DE DECISIÓN (FUNDAMENTAL)
        ═══════════════════════════════════════════════════════════ */}
        {totalLotes > 0 && (
          <section className="mb-12 overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-8 shadow-lg">
            {/* Cabecera del Punto de Decisión */}
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-5">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-brand">
                  Punto de Decisión y Verificación Final
                </span>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  Resumen Estructurado del Desglose de Lotes
                </h3>
                <p className="text-sm text-slate-500 max-w-3xl">
                  Revisá la distribución de suministros por cada categoría de auxilio antes de abrir
                  la convocatoria pública a las organizaciones.
                </p>
              </div>

              <span className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-brand ring-1 ring-blue-200 shadow-2xs">
                <CheckCircle2 className="h-4 w-4" />
                Listo para Despacho
              </span>
            </div>

            {/* Categorización estricta por bloques separados */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {RESOURCE_CATEGORIES.filter((c) => getCategoryCount(c.id) > 0).map((cat) => {
                const catState = selections[cat.id] || {};
                const selectedItems = cat.resources.filter((r) => catState[r.id]?.selected);
                const CatIcon = CATEGORY_ICONS[cat.icon] || Shield;
                const hoverTheme = CATEGORY_HOVER_STYLES[cat.id] || CATEGORY_HOVER_STYLES.rescate;
                const catTotalUnidades = selectedItems.reduce(
                  (sum, r) => sum + (catState[r.id]?.qty || r.defaultQty),
                  0,
                );

                return (
                  <div
                    key={cat.id}
                    className={`rounded-3xl border-2 p-6 transition-all shadow-xs ${hoverTheme.cardBg}`}
                    style={{ borderColor: `${hoverTheme.accentColor  }55` }}
                  >
                    <div className="mb-4 flex items-center justify-between border-b border-slate-200/80 pb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm"
                          style={{ backgroundColor: hoverTheme.accentColor }}
                        >
                          <CatIcon className="h-5 w-5" />
                        </span>
                        <div>
                          <h4 className="text-lg font-black text-slate-900">{cat.label}</h4>
                          <span className="text-xs font-bold text-slate-500">
                            {selectedItems.length} recurso{selectedItems.length !== 1 ? 's' : ''}{' '}
                            asignado{selectedItems.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <span
                        className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider shadow-2xs"
                        style={{
                          backgroundColor: `${hoverTheme.accentColor  }18`,
                          color: hoverTheme.accentColor,
                        }}
                      >
                        {catTotalUnidades.toLocaleString('es-AR')} unidades
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {selectedItems.map((res) => {
                        const qty = catState[res.id]?.qty || res.defaultQty;
                        const notes = catState[res.id]?.notes;
                        const ResIcon = RESOURCE_ICONS[res.id] || Box;

                        return (
                          <div
                            key={res.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                <ResIcon className="h-4 w-4" />
                              </span>
                              <div>
                                <span className="block text-sm font-extrabold text-slate-900 leading-tight">
                                  {res.label}
                                </span>
                                {notes && (
                                  <span className="mt-0.5 block text-[11px] font-medium text-slate-500 italic">
                                    Nota: {notes}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className="inline-block text-base font-black px-2.5 py-0.5 rounded-lg shadow-2xs"
                                style={{
                                  backgroundColor: `${hoverTheme.accentColor  }15`,
                                  color: hoverTheme.accentColor,
                                }}
                              >
                                × {qty.toLocaleString('es-AR')}
                              </span>
                              <span className="block text-[11px] font-bold text-slate-400 mt-0.5">
                                {res.unit}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cockpit de Decisión Final con Métricas Gigantes */}
            <div className="mt-8 rounded-3xl border border-slate-200/90 bg-slate-50/80 p-6 shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid grid-cols-3 gap-4 lg:gap-8">
                  <div>
                    <span className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Categorías
                    </span>
                    <span className="text-3xl sm:text-4xl font-black text-slate-900">
                      {activeCategoryCount}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Lotes Solicitados
                    </span>
                    <span className="text-3xl sm:text-4xl font-black text-slate-900">
                      {totalLotes}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Unidades Convocadas
                    </span>
                    <span className="text-3xl sm:text-4xl font-black text-brand">
                      {totalUnidades.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                {!isPublished ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="secondary"
                      size="lg"
                      icon={Save}
                      loading={saving}
                      onClick={handleSave}
                      className="rounded-2xl font-bold shadow-xs hover:shadow-md"
                    >
                      Guardar Borrador
                    </Button>

                    <button
                      type="button"
                      disabled={publishing}
                      onClick={() => setShowConfirmModal(true)}
                      className="group relative flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-8 py-4 text-base font-black text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                      <span>Publicar Convocatoria</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-2xl bg-emerald-100 px-5 py-3 text-sm font-black text-emerald-900">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    <span>Convocatoria Abierta · Convocada a la red de ONGs</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {totalLotes === 0 && !isPublished && (
          <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white/70 p-16 text-center shadow-xs">
            <Boxes className="mx-auto h-12 w-12 text-slate-300" />
            <h4 className="mt-3 text-lg font-black text-slate-700">
              Aún no se han configurado lotes para esta emergencia
            </h4>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              Hacé click en cualquiera de las 5 categorías superiores para seleccionar recursos y
              ajustar cantidades con un clic.
            </p>
          </div>
        )}
      </div>

      {/* Modal de Confirmación */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
                <ShieldCheck className="h-8 w-8" />
              </span>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  ¿Publicar la Convocatoria de Lotes?
                </h3>
                <p className="text-sm font-semibold text-slate-500">
                  {emergency.municipality}, {emergency.province}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/80">
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                Al confirmar, la catástrofe pasará al estado{' '}
                <strong className="text-emerald-700 font-extrabold">Convocatoria Abierta</strong>.
                Todos los lotes configurados se remitirán de forma inmediata al panel de las ONGs
                para que puedan postular donaciones y despachos.
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200/80 pt-4 text-center">
                <div>
                  <span className="block text-[10px] font-black uppercase text-slate-400">
                    Categorías
                  </span>
                  <span className="text-lg font-black text-slate-900">{activeCategoryCount}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-black uppercase text-slate-400">
                    Recursos
                  </span>
                  <span className="text-lg font-black text-slate-900">{totalLotes}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-black uppercase text-slate-400">
                    Unidades
                  </span>
                  <span className="text-lg font-black text-brand">
                    {totalUnidades.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancelar y Revisar
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={handlePublish}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>Confirmar y Publicar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmergencyLotesPage;
