import {
  Activity,
  AlertOctagon,
  ArrowRight,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  HelpCircle,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Waves,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';

import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import MiniIncidentMap from '../components/ui/MiniIncidentMap.jsx';
import { SEVERITY_LEVELS } from '../features/emergencies/emergency-constants.js';
import { isMunicipalOperator, isRegionalCoordinator } from '../lib/auth-roles.js';
import { listEmergencies } from '../services/emergency-service.js';

const TYPE_CONFIG = {
  inundacion: {
    label: 'Inundación',
    icon: Waves,
    badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    iconBg: 'bg-cyan-100 text-cyan-700',
    glowColor: 'group-hover:border-cyan-400/80',
  },
  incendio: {
    label: 'Incendio',
    icon: Flame,
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
    iconBg: 'bg-rose-100 text-rose-700',
    glowColor: 'group-hover:border-rose-400/80',
  },
  terremoto: {
    label: 'Terremoto',
    icon: Activity,
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    iconBg: 'bg-amber-100 text-amber-700',
    glowColor: 'group-hover:border-amber-400/80',
  },
  otro: {
    label: 'Emergencia General',
    icon: HelpCircle,
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
    iconBg: 'bg-slate-200 text-slate-700',
    glowColor: 'group-hover:border-slate-400/80',
  },
};

const SEVERITY_PILLS = {
  baja: {
    label: 'Baja',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-300/80 shadow-emerald-500/10',
    dot: 'bg-emerald-500',
  },
  media: {
    label: 'Media',
    bg: 'bg-amber-50 text-amber-800 border-amber-300/80 shadow-amber-500/10',
    dot: 'bg-amber-500',
  },
  alta: {
    label: 'Alta',
    bg: 'bg-orange-50 text-orange-900 border-orange-300/80 shadow-orange-500/10',
    dot: 'bg-orange-500 animate-pulse',
  },
  critica: {
    label: 'Crítica',
    bg: 'bg-rose-50 text-rose-900 border-rose-400/80 shadow-rose-500/15',
    dot: 'bg-rose-600 animate-ping-slow',
  },
};

const TYPE_TEXTURES = {
  inundacion: 'water-flow-texture',
  incendio: 'fire-flow-texture',
};

const SEVERITY_GLOWS = {
  baja: 'radial-glow-baja',
  media: 'radial-glow-media',
  alta: 'radial-glow-alta',
  critica: 'radial-glow-critica',
};

const CRITICAL_FOCUS = {
  inundacion: 'Riesgo de anegamiento masivo, corte de suministros y aislamiento de familias.',
  incendio: 'Propagación activa por vientos. Peligro inminente en interfase con viviendas.',
  terremoto: 'Daños estructurales, búsqueda y rescate en estructuras colapsadas.',
  otro: 'Atención inmediata de damnificados y logística de emergencia.',
};

function EmergenciesListPage() {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const navigate = useNavigate();
  const outletContext = useOutletContext();
  const user = outletContext?.user;
  const canRegisterEmergency = isMunicipalOperator(user);
  const canManageLotes = isRegionalCoordinator(user);

  const fetchList = () => {
    setLoading(true);
    setError(null);
    listEmergencies()
      .then(setEmergencies)
      .catch((err) => setError(err.message || 'Error al cargar las emergencias.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  const metrics = useMemo(() => {
    const total = emergencies.length;
    const registradas = emergencies.filter((e) => e.status === 'registrada').length;
    const abiertas = emergencies.filter((e) => e.status === 'convocatoria_abierta').length;
    const afectados = emergencies.reduce(
      (sum, e) => sum + (Number(e.estimatedAffectedPeople) || 0),
      0,
    );
    return { total, registradas, abiertas, afectados };
  }, [emergencies]);

  const filteredEmergencies = useMemo(() => emergencies.filter((item) => {
      const matchSearch =
        !search.trim() ||
        item.municipality?.toLowerCase().includes(search.toLowerCase()) ||
        item.province?.toLowerCase().includes(search.toLowerCase()) ||
        item.affectedZone?.toLowerCase().includes(search.toLowerCase()) ||
        item.type?.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchSeverity = severityFilter === 'all' || item.severity === severityFilter;

      return matchSearch && matchStatus && matchSeverity;
    }), [emergencies, search, statusFilter, severityFilter]);

  return (
    <div className="min-h-screen bg-tactical-grid text-slate-800 pb-20 font-sans">
      {/* ─── Topbar Operativa del Sistema Nacional ─── */}
      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 py-3.5 lg:px-12 sticky top-0 z-30 shadow-xs">
        <div className="mx-auto flex max-w-[1780px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-blue-950 text-white shadow-md shadow-slate-900/10">
              <ShieldAlert className="h-4 w-4 text-cyan-400" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  RescueSync · Comando de Respuesta Operativa
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sistema en vivo
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Monitoreo territorial y despacho estratégico de lotes humanitarios a ONGs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchList}
              title="Refrescar incidentes"
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            {canRegisterEmergency && (
              <Button
                type="button"
                variant="primary"
                size="md"
                icon={Plus}
                onClick={() => navigate('/emergencias/nueva')}
                className="rounded-full shadow-md shadow-brand/25 font-bold"
              >
                Registrar Nueva Catástrofe
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1780px] px-6 pt-8 lg:px-12">
        {/* ─── Encabezado Principal de Pantalla Ancha (27") ─── */}
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span className="text-xs font-bold uppercase tracking-widest text-brand">
                Panel de Coordinación y Despacho
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 lg:text-4xl">
              Bandeja Territorial de Incidentes
            </h1>
            <p className="mt-1.5 text-base text-slate-600 max-w-4xl">
              Analizá la situación geográfica de cada foco crítico, estructurá las necesidades en
              lotes específicos y convocá a las organizaciones de la sociedad civil.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl border border-slate-200/80 shadow-xs">
            <Calendar className="h-4 w-4 text-brand" />
            <span>
              {new Date().toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* ─── Tarjetas de Métricas Rápidas (Inspiradas en Referencia 4: Lupa / SaaS Premium) ─── */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Incidentes */}
          <div className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Total Incidentes Activos
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-brand shadow-inner group-hover:scale-110 transition-transform">
                <Shield className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-4xl font-black tracking-tight text-slate-900">
                {metrics.total}
              </span>
              <span className="text-xs font-semibold text-slate-500">focos registrados</span>
            </div>
            {/* Barra visual de estado */}
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-brand rounded-full" style={{ width: '100%' }} />
              </div>
              <span className="text-[11px] font-bold text-slate-400">100%</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Monitoreados por la sala de crisis</p>
          </div>

          {/* Card 2: Por Desglosar */}
          <div className="group relative overflow-hidden rounded-3xl border border-amber-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-amber-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
                🟡 Pendientes de Desglose
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-inner group-hover:scale-110 transition-transform">
                <Clock className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-4xl font-black tracking-tight text-amber-900">
                {metrics.registradas}
              </span>
              <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-xs font-bold text-amber-800">
                Acción prioritaria
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 w-full rounded-full bg-amber-100/60 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${metrics.total ? (metrics.registradas / metrics.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-bold text-amber-700">
                {metrics.total ? Math.round((metrics.registradas / metrics.total) * 100) : 0}%
              </span>
            </div>
            <p className="mt-2 text-xs text-amber-700 font-medium">
              Esperan conversión a lotes para abrir convocatoria
            </p>
          </div>

          {/* Card 3: Convocatoria Abierta */}
          <div className="group relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-emerald-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                🟢 Convocatorias Abiertas
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner group-hover:scale-110 transition-transform">
                <Boxes className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-4xl font-black tracking-tight text-emerald-900">
                {metrics.abiertas}
              </span>
              <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-xs font-bold text-emerald-800">
                En despacho
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 w-full rounded-full bg-emerald-100/60 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${metrics.total ? (metrics.abiertas / metrics.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-bold text-emerald-700">
                {metrics.total ? Math.round((metrics.abiertas / metrics.total) * 100) : 0}%
              </span>
            </div>
            <p className="mt-2 text-xs text-emerald-700 font-medium">
              Lotes activos visibles para las ONGs aliadas
            </p>
          </div>

          {/* Card 4: Personas Afectadas */}
          <div className="group relative overflow-hidden rounded-3xl border border-rose-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-rose-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-800">
                Población Civil Afectada
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-inner group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-rose-950">
                {metrics.afectados.toLocaleString('es-AR')}
              </span>
              <span className="text-xs font-semibold text-rose-800">personas</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 w-full rounded-full bg-rose-100 overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: '85%' }} />
              </div>
              <span className="text-[11px] font-bold text-rose-700">Alerta Roja</span>
            </div>
            <p className="mt-2 text-xs text-rose-800 font-medium">
              Impacto humanitario estimado en zonas de desastre
            </p>
          </div>
        </div>

        {/* ─── Barra de Búsqueda y Filtros con Estilo Píldora ─── */}
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
          {/* Buscador redondeado / píldora */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por municipio, provincia, barrio o tipo de catástrofe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-slate-200/90 bg-slate-50/70 py-3 pl-12 pr-6 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all shadow-inner"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/60 px-3.5 py-1.5 text-xs font-bold text-slate-600">
              <SlidersHorizontal className="h-3.5 w-3.5 text-brand" />
              <span>Filtros:</span>
            </div>

            {/* Dropdown Estado */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-slate-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="registrada">🟡 Pendientes de Desglose</option>
              <option value="convocatoria_abierta">🟢 Convocatoria Abierta</option>
            </select>

            {/* Dropdown Severidad */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-slate-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all cursor-pointer"
            >
              <option value="all">Todas las gravedades</option>
              {SEVERITY_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>
                  Gravedad {lvl.label}
                </option>
              ))}
            </select>

            {(search || statusFilter !== 'all' || severityFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setSeverityFilter('all');
                }}
                className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* ─── Mensajes de Error ─── */}
        {error && (
          <div className="mb-6">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        {/* ─── Loading Skeleton ─── */}
        {loading && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 p-16 text-slate-500 shadow-sm">
            <RefreshCw className="h-9 w-9 animate-spin text-brand" />
            <p className="mt-4 text-base font-bold text-slate-800">
              Sincronizando incidentes territoriales…
            </p>
            <p className="text-xs text-slate-400">Consultando base distribuida de emergencias</p>
          </div>
        )}

        {/* ─── Lista Vacía ─── */}
        {!loading && filteredEmergencies.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/80 p-16 text-center shadow-sm">
            <AlertOctagon className="h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-extrabold text-slate-800">
              No se hallaron emergencias con los criterios seleccionados
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {search || statusFilter !== 'all' || severityFilter !== 'all'
                ? 'Intentá restablecer los filtros para volver a ver todas las zonas afectadas.'
                : 'Actualmente no hay incidentes activos informados por los municipios.'}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setSeverityFilter('all');
                }}
              >
                Restablecer Filtros
              </Button>
              {canRegisterEmergency && (
                <Button onClick={() => navigate('/emergencias/nueva')} icon={Plus}>
                  Cargar Nueva Emergencia
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ─── Grilla de Emergencias (Escalada para Pantallas Grandes de 27") ─── */}
        {!loading && filteredEmergencies.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredEmergencies.map((item) => {
              const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.otro;
              const TypeIcon = typeConf.icon;
              const severityPill = SEVERITY_PILLS[item.severity] || SEVERITY_PILLS.media;
              const isAbierta = item.status === 'convocatoria_abierta';

              return (
                <div
                  key={item.id}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm backdrop-blur-xs transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${typeConf.glowColor}`}
                >
                  <div>
                    {/* ══════════════════════════════════════════════════
                        CABECERA: TAGS DE TIPO, FECHA Y SEVERIDAD
                    ══════════════════════════════════════════════════ */}
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      {/* Tipo de emergencia con textura de flujo heroico */}
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-11 px-3.5 items-center gap-2 rounded-2xl shadow-md text-white ${TYPE_TEXTURES[item.type] || 'bg-slate-900'}`}
                        >
                          <TypeIcon className="h-4 w-4" />
                          <span className="text-xs font-black uppercase tracking-wider">
                            {item.type === 'otro' && item.typeOther
                              ? item.typeOther
                              : typeConf.label}
                          </span>
                        </span>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                            <Calendar className="h-3.5 w-3.5 text-brand" />
                            {new Date(item.occurredAt || item.createdAt).toLocaleDateString(
                              'es-AR',
                              {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}{' '}
                            hs
                          </p>
                        </div>
                      </div>

                      {/* Pill de Severidad con Luz Radial Difuminada */}
                      <div className="relative flex items-center">
                        <div
                          className={`absolute inset-0 -m-3 pointer-events-none rounded-full blur-xl opacity-60 ${SEVERITY_GLOWS[item.severity] || SEVERITY_GLOWS.baja}`}
                        />
                        <span
                          className={`relative inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-black uppercase tracking-wider shadow-xs ${severityPill.bg}`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${severityPill.dot}`} />
                          Gravedad {item.severity}
                        </span>
                      </div>
                    </div>

                    {/* ══════════════════════════════════════════════════
                        1. JERARQUÍA GEOGRÁFICA (EL PROTAGONISTA ABSOLUTO)
                    ══════════════════════════════════════════════════ */}
                    <div className="mt-5">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand">
                          <MapPin className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Lugar Geográfico del Incidente
                          </span>
                          <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-snug">
                            {item.municipality}, {item.province}
                          </h2>
                          {item.affectedZone && (
                            <p className="mt-1 inline-block rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                              📍 {item.affectedZone}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ══════════════════════════════════════════════════
                          WIDGET DE MINI-MAPA INTEGRADO (CONTEXTO ESPACIAL RÁPIDO)
                      ══════════════════════════════════════════════════ */}
                      <div className="mt-4">
                        <MiniIncidentMap
                          latitude={item.latitude}
                          longitude={item.longitude}
                          municipality={item.municipality}
                          province={item.province}
                          severity={item.severity}
                          height="h-36"
                          zoom={11}
                          interactive={false}
                        />
                      </div>
                    </div>

                    {/* ══════════════════════════════════════════════════
                        ESTRUCTURA DE DATOS DESGLOSADA: CAJAS MODULARES NO FUSIONADAS
                    ══════════════════════════════════════════════════ */}
                    <div className="mt-5 space-y-3">
                      {/* Caja Modular 1: Descripción General */}
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 shadow-2xs">
                        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                          Descripción del Evento
                        </span>
                        <p className="text-xs font-medium leading-relaxed text-slate-700 line-clamp-3">
                          {item.description || 'Sin descripción detallada informada.'}
                        </p>
                      </div>

                      {/* Caja Modular 2: Problema Específico / Foco Crítico */}
                      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3.5 shadow-2xs">
                        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-amber-800/80 mb-1">
                          Foco Crítico de Intervención
                        </span>
                        <p className="text-xs font-semibold leading-relaxed text-amber-950">
                          {CRITICAL_FOCUS[item.type] || CRITICAL_FOCUS.otro}
                        </p>
                      </div>

                      {/* Caja Modular 3: Impacto Humano & Estado de Lotes */}
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                            <Users className="h-5 w-5" />
                          </span>
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Afectados Estimados
                            </span>
                            <span className="text-base font-black text-slate-900">
                              {item.estimatedAffectedPeople
                                ? `${Number(item.estimatedAffectedPeople).toLocaleString('es-AR')} personas`
                                : 'Sin precisar'}
                            </span>
                          </div>
                        </div>

                        {/* Tag de Estado */}
                        <div>
                          {isAbierta ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-600/20">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Convocatoria Abierta
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-600/20">
                              <Clock className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                              Por Desglosar
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ══════════════════════════════════════════════════
                      BOTÓN DE ACCIÓN REDISEÑADO (MODERNO, CON VOLUMEN Y GRADIENTE)
                  ══════════════════════════════════════════════════ */}
                  {canManageLotes && (
                    <div className="mt-6 pt-2">
                      <Link
                        to={`/emergencias/${item.id}/lotes`}
                        className={`group/btn relative flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-black shadow-md transition-all duration-200 ${
                          isAbierta
                            ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:shadow-lg'
                            : 'gradient-sunset text-white glow-sunset hover:scale-[1.01] active:scale-[0.99]'
                        }`}
                      >
                        <Boxes className="h-4 w-4" />
                        <span>
                          {isAbierta ? 'Ver Lotes Convocados' : 'Desglosar Lotes y Convocar'}
                        </span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default EmergenciesListPage;
