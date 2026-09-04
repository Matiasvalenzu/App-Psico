"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquarePlus,
  Inbox,
  ShieldCheck,
  Bug,
  Lightbulb,
  Heart,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Filter,
  Search,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Send,
  Loader2,
  RefreshCw,
  User,
  Paperclip,
  Check,
} from "lucide-react";
import { apiFetch, getCurrentUser } from "@/lib/api";
import {
  FeedbackReport,
  FeedbackStats,
  FeedbackTipo,
  FeedbackEstado,
  FeedbackSeveridad,
} from "@/types/feedback";
import FeedbackForm from "@/components/feedback/FeedbackForm";

export default function FeedbackPage() {
  const [activeTab, setActiveTab] = useState<"nuevo" | "mis_reportes" | "admin">(
    "nuevo"
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Estados para "Mis Reportes"
  const [misReportes, setMisReportes] = useState<FeedbackReport[]>([]);
  const [loadingMisReportes, setLoadingMisReportes] = useState(false);

  // Estados para "Gestión Admin"
  const [adminReportes, setAdminReportes] = useState<FeedbackReport[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal de Detalle / Respuesta Admin
  const [selectedReporte, setSelectedReporte] = useState<FeedbackReport | null>(null);
  const [nuevoEstadoAdmin, setNuevoEstadoAdmin] = useState<FeedbackEstado>("en_revision");
  const [respuestaAdminTexto, setRespuestaAdminTexto] = useState("");
  const [guardandoRespuesta, setGuardandoRespuesta] = useState(false);
  const [notifGuardado, setNotifGuardado] = useState(false);

  // Cargar usuario actual
  useEffect(() => {
    async function checkUser() {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        const adminFlag =
          user.username === "Admin" ||
          user.is_admin === true ||
          user.is_superuser === true;
        setIsAdmin(adminFlag);
      } catch (err) {
        console.error("Error al obtener usuario:", err);
      }
    }
    checkUser();
  }, []);

  // Cargar mis reportes
  const cargarMisReportes = useCallback(async () => {
    setLoadingMisReportes(true);
    try {
      const res = await apiFetch("/feedback/mis-reportes/");
      if (res.ok) {
        const data = await res.json();
        setMisReportes(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Error al cargar reportes del usuario:", err);
    } finally {
      setLoadingMisReportes(false);
    }
  }, []);

  // Cargar admin reportes y stats
  const cargarAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingAdmin(true);
    try {
      const params = new URLSearchParams();
      if (filtroEstado !== "todos") params.append("estado", filtroEstado);
      if (filtroTipo !== "todos") params.append("tipo", filtroTipo);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const [resList, resStats] = await Promise.all([
        apiFetch(`/feedback/admin/list/?${params.toString()}`),
        apiFetch("/feedback/admin/stats/"),
      ]);

      if (resList.ok) {
        const data = await resList.json();
        setAdminReportes(Array.isArray(data) ? data : data.results || []);
      }
      if (resStats.ok) {
        const statsData = await resStats.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Error al cargar datos de admin:", err);
    } finally {
      setLoadingAdmin(false);
    }
  }, [isAdmin, filtroEstado, filtroTipo, searchQuery]);

  useEffect(() => {
    if (activeTab === "mis_reportes") {
      cargarMisReportes();
    } else if (activeTab === "admin" && isAdmin) {
      cargarAdminData();
    }
  }, [activeTab, isAdmin, cargarMisReportes, cargarAdminData]);

  // Guardar respuesta o cambio de estado de admin
  const handleGuardarAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReporte) return;

    setGuardandoRespuesta(true);
    try {
      const res = await apiFetch(`/feedback/admin/${selectedReporte.id}/update/`, {
        method: "PATCH",
        body: JSON.stringify({
          estado: nuevoEstadoAdmin,
          respuesta_admin: respuestaAdminTexto,
        }),
      });

      if (res.ok) {
        setNotifGuardado(true);
        setTimeout(() => setNotifGuardado(false), 2000);
        await cargarAdminData();
        // Actualizar reporte seleccionado en vista
        setSelectedReporte((prev) =>
          prev
            ? {
                ...prev,
                estado: nuevoEstadoAdmin,
                respuesta_admin: respuestaAdminTexto,
              }
            : null
        );
      }
    } catch (err) {
      console.error("Error al guardar actualización admin:", err);
    } finally {
      setGuardandoRespuesta(false);
    }
  };

  const abrirModalAdmin = (reporte: FeedbackReport) => {
    setSelectedReporte(reporte);
    setNuevoEstadoAdmin(reporte.estado);
    setRespuestaAdminTexto(reporte.respuesta_admin || "");
  };

  const getTipoIcon = (tipo: FeedbackTipo) => {
    switch (tipo) {
      case "error":
        return <Bug className="h-4 w-4 text-rose-500" />;
      case "mejora":
        return <Lightbulb className="h-4 w-4 text-amber-500" />;
      case "felicitacion":
        return <Heart className="h-4 w-4 text-emerald-500" />;
      case "consulta":
        return <HelpCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getEstadoBadge = (estado: FeedbackEstado) => {
    switch (estado) {
      case "nuevo":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Nuevo
          </span>
        );
      case "en_revision":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Clock className="h-3 w-3" />
            En revisión
          </span>
        );
      case "resuelto":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Resuelto
          </span>
        );
      case "descartado":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            Descartado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header de la sección */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Atención y Mejora Continua</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Feedback y Reportes de Errores
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tus sugerencias y reportes nos permiten evolucionar Psiconex cada semana.
          </p>
        </div>

        {/* Tabs de navegación */}
        <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/80 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("nuevo")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "nuevo"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>Enviar Feedback</span>
          </button>
          <button
            onClick={() => setActiveTab("mis_reportes")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "mis_reportes"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Inbox className="h-3.5 w-3.5" />
            <span>Mis Reportes</span>
            {misReportes.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                {misReportes.length}
              </span>
            )}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "admin"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Gestión (Admin)</span>
              {stats && stats.nuevos > 0 && (
                <span className="ml-1 rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[10px] font-bold">
                  {stats.nuevos}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* PESTAÑA 1: NUEVO FEEDBACK */}
      {activeTab === "nuevo" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <FeedbackForm
              onSuccess={() => {
                // Actualizar la lista en background
                cargarMisReportes();
              }}
            />
          </div>

          {/* Lateral informativo */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500" />
                Tu opinión hace crecer Psiconex
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Psiconex está diseñado por y para profesionales de la salud mental.
                Leemos cada mensaje recibido y priorizamos las actualizaciones según
                las necesidades reales de tu consulta.
              </p>

              <div className="border-t border-border pt-3 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 mt-0.5">
                    <Bug className="h-3 w-3" />
                  </div>
                  <div className="text-xs">
                    <strong className="text-foreground">¿Detectaste un error?</strong>
                    <p className="text-muted-foreground">
                      Adjunta una captura con <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Ctrl+V</kbd> para ayudarnos a resolverlo más rápido.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 mt-0.5">
                    <Lightbulb className="h-3 w-3" />
                  </div>
                  <div className="text-xs">
                    <strong className="text-foreground">¿Tienes una idea?</strong>
                    <p className="text-muted-foreground">
                      Cuéntanos cómo te gustaría que funcionara esa herramienta en tu práctica clínica.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
              <span className="font-semibold text-primary block mb-1">
                ¿Necesitas asistencia inmediata?
              </span>
              Escríbenos directamente a{" "}
              <a
                href="mailto:psiconex@datnexia.com"
                className="font-medium text-primary underline"
              >
                psiconex@datnexia.com
              </a>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: MIS REPORTES */}
      {activeTab === "mis_reportes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Historial de reportes enviados
            </h2>
            <button
              onClick={cargarMisReportes}
              disabled={loadingMisReportes}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingMisReportes ? "animate-spin" : ""}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {loadingMisReportes ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Cargando tus reportes...</p>
            </div>
          ) : misReportes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border bg-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                <Inbox className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Aún no has enviado ningún feedback o reporte
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Cuando nos envíes una sugerencia o reportes un problema, podrás ver aquí el avance y las respuestas del equipo técnico.
              </p>
              <button
                onClick={() => setActiveTab("nuevo")}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
              >
                Enviar mi primer reporte
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {misReportes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-border/80 space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-muted/60">
                        {getTipoIcon(item.tipo)}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-foreground">
                          {item.tipo_display}
                        </span>
                        <span className="mx-2 text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">
                          Módulo: <strong>{item.modulo_display}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("es-CL", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {getEstadoBadge(item.estado)}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {item.titulo}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                      {item.descripcion}
                    </p>
                  </div>

                  {item.pasos_reproducir && (
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs">
                      <strong className="text-foreground block mb-1">Pasos para reproducir:</strong>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {item.pasos_reproducir}
                      </p>
                    </div>
                  )}

                  {item.archivo_adjunto && (
                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={item.archivo_adjunto}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/15"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>Ver captura o archivo adjunto</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {/* Respuesta del Administrador */}
                  {item.respuesta_admin && (
                    <div className="mt-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                        <MessageCircle className="h-4 w-4" />
                        <span>Respuesta del Equipo Psiconex:</span>
                      </div>
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed pt-1">
                        {item.respuesta_admin}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: GESTIÓN ADMIN (Solo Administradores) */}
      {isAdmin && activeTab === "admin" && (
        <div className="space-y-6">
          {/* Métricas / KPIs */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Total Reportes
                </span>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {stats.total}
                </p>
              </div>
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-sm">
                <span className="text-xs font-semibold text-blue-600 uppercase flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  Nuevos
                </span>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                  {stats.nuevos}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-sm">
                <span className="text-xs font-semibold text-rose-600 uppercase flex items-center gap-1.5">
                  <Bug className="h-3.5 w-3.5" />
                  Errores Abiertos
                </span>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">
                  {stats.errores_abiertos}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
                <span className="text-xs font-semibold text-emerald-600 uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Resueltos
                </span>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                  {stats.resueltos}
                </p>
              </div>
            </div>
          )}

          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por usuario, título o descripción..."
                className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="todos">Todos los Estados</option>
                <option value="nuevo">Nuevos</option>
                <option value="en_revision">En revisión</option>
                <option value="resuelto">Resueltos</option>
                <option value="descartado">Descartados</option>
              </select>

              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="todos">Todos los Tipos</option>
                <option value="error">Errores</option>
                <option value="mejora">Mejoras</option>
                <option value="felicitacion">Felicitaciones</option>
                <option value="consulta">Consultas</option>
              </select>

              <button
                onClick={cargarAdminData}
                disabled={loadingAdmin}
                className="p-2 rounded-lg border border-border hover:bg-accent text-muted-foreground transition disabled:opacity-50"
                title="Refrescar lista"
              >
                <RefreshCw className={`h-4 w-4 ${loadingAdmin ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Lista de Reportes para Administrador */}
          {loadingAdmin ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Cargando reportes para administración...</p>
            </div>
          ) : adminReportes.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card text-muted-foreground text-xs">
              No se encontraron reportes con los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-3">
              {adminReportes.map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-muted/60">
                        {getTipoIcon(rep.tipo)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground">
                          #{rep.id} {rep.tipo_display}
                        </span>
                        <span className="mx-2 text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">
                          {rep.usuario_nombre} ({rep.usuario_email || rep.usuario_username})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {getEstadoBadge(rep.estado)}
                      <button
                        onClick={() => abrirModalAdmin(rep)}
                        className="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 text-xs font-semibold transition"
                      >
                        Gestionar / Responder
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {rep.titulo}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {rep.descripcion}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/80 pt-1">
                    <span>Módulo: <strong>{rep.modulo_display}</strong></span>
                    <span>·</span>
                    <span>Severidad: <strong>{rep.severidad_display}</strong></span>
                    <span>·</span>
                    <span>
                      Fecha:{" "}
                      {new Date(rep.created_at).toLocaleDateString("es-CL", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {rep.archivo_adjunto && (
                      <>
                        <span>·</span>
                        <span className="text-primary font-medium flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> Tiene adjunto
                        </span>
                      </>
                    )}
                    {rep.respuesta_admin && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" /> Respondido
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MODAL DE GESTIÓN Y RESPUESTA ADMIN */}
          {selectedReporte && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div
                className="fixed inset-0"
                onClick={() => setSelectedReporte(null)}
              />
              <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        Gestionar Reporte #{selectedReporte.id}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        De {selectedReporte.usuario_nombre} ({selectedReporte.usuario_email})
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedReporte(null)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5 max-h-[calc(90vh-140px)]">
                  {/* Detalle original */}
                  <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        {selectedReporte.titulo}
                      </span>
                      {getEstadoBadge(selectedReporte.estado)}
                    </div>
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap">
                      {selectedReporte.descripcion}
                    </p>
                    {selectedReporte.pasos_reproducir && (
                      <div className="border-t border-border/50 pt-2 text-xs">
                        <strong className="text-foreground">Pasos para reproducir:</strong>
                        <p className="text-muted-foreground whitespace-pre-wrap mt-0.5">
                          {selectedReporte.pasos_reproducir}
                        </p>
                      </div>
                    )}
                    {selectedReporte.archivo_adjunto && (
                      <div className="border-t border-border/50 pt-2">
                        <a
                          href={selectedReporte.archivo_adjunto}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          <span>Ver archivo o captura adjunta</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Metadata técnica */}
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/40 text-[11px] text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <strong>URL origen:</strong> {selectedReporte.url_origen || "N/A"}
                    </div>
                    <div>
                      <strong>Resolución:</strong> {selectedReporte.resolucion_pantalla || "N/A"}
                    </div>
                    <div className="sm:col-span-2 truncate">
                      <strong>Navegador/SO:</strong> {selectedReporte.user_agent || "N/A"}
                    </div>
                  </div>

                  {/* Formulario de Estado y Respuesta */}
                  <form onSubmit={handleGuardarAdmin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Cambiar Estado de Atención
                      </label>
                      <select
                        value={nuevoEstadoAdmin}
                        onChange={(e) => setNuevoEstadoAdmin(e.target.value as FeedbackEstado)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="nuevo">Nuevo</option>
                        <option value="en_revision">En revisión</option>
                        <option value="resuelto">Resuelto</option>
                        <option value="descartado">Descartado</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>Respuesta al Usuario (Visible en su panel y por email)</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Se enviará notificación automática
                        </span>
                      </label>
                      <textarea
                        rows={4}
                        value={respuestaAdminTexto}
                        onChange={(e) => setRespuestaAdminTexto(e.target.value)}
                        placeholder="Escribe una respuesta para el usuario sobre este reporte o resolución..."
                        className="w-full rounded-lg border border-input bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>

                    {notifGuardado && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>¡Reporte actualizado y respuesta enviada correctamente!</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedReporte(null)}
                        className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition"
                      >
                        Cerrar
                      </button>
                      <button
                        type="submit"
                        disabled={guardandoRespuesta}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
                      >
                        {guardandoRespuesta ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Guardando...</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" />
                            <span>Guardar y Notificar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
