"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Calendar, FileText, LayoutList, Receipt, RefreshCw, SearchX, Sparkles, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { RemoteSessionModal } from "@/components/sesion/RemoteSessionModal";
import { ModalCrearSesionVirtual } from "@/components/sesion/ModalCrearSesionVirtual";
import { RemoteAudioAssistantModal } from "@/components/sesion/RemoteAudioAssistantModal";
import ConsentimientoInformadoModal from "@/components/pacientes/ConsentimientoInformadoModal";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTutorial } from "@/context/TutorialContext";
import AlertaClinica from "./_components/AlertaClinica";
import ChatIA from "./_components/ChatIA";
import CobroDialog from "./_components/CobroDialog";
import CobrosPaciente from "./_components/CobrosPaciente";
import DeleteSesionDialog from "./_components/DeleteSesionDialog";
import DocumentosExternos from "./_components/DocumentosExternos";
import EditPacienteDialog from "./_components/EditPacienteDialog";
import InformesIA from "./_components/InformesIA";
import PacienteHeader from "./_components/PacienteHeader";
import PacienteLateral from "./_components/PacienteLateral";
import PacienteResumen from "./_components/PacienteResumen";
import { cambiarPago, MarcarPagadoDialog } from "./_components/PagoCobro";
import type { Cobro } from "./_components/cobros";
import CobrosBloqueados from "@/components/suscripcion/CobrosBloqueados";
import SesionesLista from "./_components/SesionesLista";
import TestDialog, { type TestMode } from "./_components/TestDialog";
import { fetchAllPages, getDateTimeInputValue, tieneRiesgo, type InformeIA, type Paciente, type Sesion } from "./_components/utils";

// Elemento oculto por ahora; se conserva por si se vuelve a habilitar
const MOSTRAR_SESION_REMOTA = false;

const TABS = ["resumen", "sesiones", "documentos", "asistente", "cobros"] as const;
type Tab = (typeof TABS)[number];

function FichaSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando ficha del paciente">
      <Skeleton className="h-5 w-48" />
      <div className="flex items-center gap-4 rounded-2xl border border-border/80 bg-card p-6">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-4 w-48 max-w-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default function PacienteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openTutorial } = useTutorial();

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [informes, setInformes] = useState<InformeIA[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"notfound" | "network" | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testMode, setTestMode] = useState<TestMode>("start");
  const [consentOpen, setConsentOpen] = useState(false);
  const [sesionToDelete, setSesionToDelete] = useState<Sesion | null>(null);
  // Cobros: visibles con Plus; si bajó de plan y tiene cobros, quedan en solo lectura.
  const [boletas, setBoletas] = useState<{ habilitadas: boolean; enPrueba: boolean }>({ habilitadas: false, enPrueba: false });
  const [sesionCobro, setSesionCobro] = useState<Sesion | null>(null);
  const [cobrosRefresh, setCobrosRefresh] = useState(0);
  const [cobroPorPagar, setCobroPorPagar] = useState<number | null>(null);

  const [remoteModalOpen, setRemoteModalOpen] = useState(false);
  const [psiconexModalOpen, setPsiconexModalOpen] = useState(false);
  const [assistantModalOpen, setAssistantModalOpen] = useState(false);
  const [activeRemoteSession, setActiveRemoteSession] = useState<{ id: number; url_reunion?: string } | null>(null);

  const editQueryHandledRef = useRef(false);

  const tabParam = searchParams.get("tab");
  const tabSolicitada = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "resumen";
  // Refleja en la lista de sesiones un cobro creado o cambiado en otra parte de la ficha.
  const actualizarCobroSesion = useCallback((cobro: Cobro) => {
    const ids = new Set(cobro.sesiones ?? []);
    if (!ids.size && cobro.sesion) ids.add(cobro.sesion);
    const chip = {
      id: cobro.id,
      monto_bruto: cobro.monto_bruto,
      estado_pago: cobro.estado_pago,
      pagado_el: cobro.pagado_el,
      estado_boleta: cobro.estado_boleta,
      boleta_folio: cobro.boleta_folio,
    };
    setSesiones((prev) =>
      prev.map((s) => {
        if (ids.has(s.id)) return { ...s, cobro: chip };
        if (s.cobro?.id === cobro.id) return { ...s, cobro: null };
        return s;
      }),
    );
  }, []);

  async function volverAPendiente(sesion: Sesion) {
    if (!sesion.cobro) return;
    try {
      actualizarCobroSesion(await cambiarPago(sesion.cobro.id, null));
      setCobrosRefresh((n) => n + 1);
      toast.success("El cobro volvió a pendiente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el pago.");
    }
  }

  const [tab, setTab] = useState<Tab>(tabSolicitada);

  useEffect(() => {
    getCurrentUser()
      .then((user) =>
        setBoletas({
          habilitadas: Boolean(user.boletas_habilitadas),
          enPrueba: user.suscripcion_estado === "trial",
        })
      )
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    try {
      const pacRes = await apiFetch(`/pacientes/${id}/`);
      if (pacRes.status === 404) {
        setLoadError("notfound");
        return;
      }
      if (!pacRes.ok) throw new Error(`HTTP ${pacRes.status}`);
      const [pacData, sesData, informesData] = await Promise.all([
        pacRes.json(),
        fetchAllPages<Sesion>(`/sesiones/?paciente=${id}`),
        fetchAllPages<InformeIA>(`/chat/informes/?paciente=${id}`),
      ]);
      setPaciente(pacData);
      setSesiones(sesData);
      setInformes(informesData);
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setLoadError("network");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!paciente || editQueryHandledRef.current || searchParams.get("editar") !== "1") return;
    editQueryHandledRef.current = true;
    setEditOpen(true);
    router.replace(`/dashboard/pacientes/${id}`);
  }, [paciente, searchParams, router, id]);

  useEffect(() => {
    setTab(tabSolicitada);
  }, [tabSolicitada]);

  function changeTab(value: unknown) {
    if (typeof value !== "string" || !TABS.includes(value as Tab)) return;
    const next = value as Tab;
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "resumen") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `/dashboard/pacientes/${id}?${qs}` : `/dashboard/pacientes/${id}`, { scroll: false });
  }

  async function exportarPaciente() {
    const res = await apiFetch(`/pacientes/${id}/exportar/`).catch(() => null);
    if (!res?.ok) {
      toast.error("No se pudo exportar la ficha.");
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `psiconex-paciente-${id}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleNewSession() {
    setCreatingSession(true);
    try {
      const res = await apiFetch("/sesiones/", {
        method: "POST",
        body: JSON.stringify({ paciente: parseInt(id) }),
      });
      if (!res.ok) throw new Error();
      const sesion = await res.json();
      router.push(`/dashboard/pacientes/${id}/sesiones/${sesion.id}`);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo crear la sesión. Inténtalo nuevamente.");
      setCreatingSession(false);
    }
  }

  function openTest(mode: TestMode) {
    setTestMode(mode);
    setTestOpen(true);
  }

  if (loading) return <FichaSkeleton />;

  if (loadError || !paciente) {
    const notFound = loadError === "notfound";
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
        {notFound ? (
          <SearchX className="mb-4 h-10 w-10 text-muted-foreground/60" />
        ) : (
          <WifiOff className="mb-4 h-10 w-10 text-muted-foreground/60" />
        )}
        <h1 className="text-lg font-semibold">{notFound ? "Paciente no encontrado" : "No se pudo cargar la ficha"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {notFound
            ? "El paciente no existe o no tienes acceso a su ficha."
            : "Revisa tu conexión e inténtalo de nuevo."}
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft />
              Volver a pacientes
            </Link>
          </Button>
          {!notFound && (
            <Button
              onClick={() => {
                setLoading(true);
                loadData();
              }}
            >
              <RefreshCw />
              Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  const documentosExternos = sesiones.filter((s) => s.origen === "DOCUMENTO_EXTERNO");
  const sesionesClinicas = sesiones.filter((s) => s.origen !== "DOCUMENTO_EXTERNO");
  const ultimaSesion = sesionesClinicas.reduce<Sesion | null>(
    (acc, s) => (!acc || s.fecha_hora_inicio > acc.fecha_hora_inicio ? s : acc),
    null
  );
  const riesgo = tieneRiesgo(paciente);

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-[5] -mx-4 -mt-4 flex min-h-11 items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:top-16 md:-mx-6 md:-mt-6 md:px-6 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/dashboard">
              <ArrowLeft />
              Volver a pacientes
            </Link>
          </Button>
          <Breadcrumb
            className="min-w-0"
            items={[{ label: "Pacientes", href: "/dashboard" }, { label: paciente.nombre_completo }]}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {paciente.edad ? <span className="hidden sm:inline">{paciente.edad} años</span> : null}
          {riesgo && <Badge variant="destructive">Riesgo</Badge>}
        </div>
      </div>

      <PacienteHeader
        paciente={paciente}
        creatingSession={creatingSession}
        onNewPresencial={handleNewSession}
        onNewVirtual={() => setPsiconexModalOpen(true)}
        onTest={openTest}
        onEdit={() => setEditOpen(true)}
        onExport={exportarPaciente}
        onTutorial={() => openTutorial(3)}
      />

      <AlertaClinica paciente={paciente} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <aside className="lg:sticky lg:top-32 lg:order-last" aria-label="Resumen del paciente">
          <PacienteLateral
            paciente={paciente}
            ultimaSesion={ultimaSesion}
            onConsent={() => setConsentOpen(true)}
            onUpdated={loadData}
            onEdit={() => setEditOpen(true)}
          />
        </aside>

        <Tabs value={tab} onValueChange={changeTab} className="min-w-0">
          <TabsList aria-label="Secciones de la ficha" className="sticky top-14 z-20 bg-background md:top-16">
            <TabsTrigger value="resumen" className="gap-1.5 px-2 sm:gap-2 sm:px-3">
              <LayoutList className="hidden sm:block" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="sesiones" className="gap-1.5 px-2 sm:gap-2 sm:px-3">
              <Calendar className="hidden sm:block" />
              Sesiones
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{sesionesClinicas.length}</span>
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-1.5 px-2 sm:gap-2 sm:px-3">
              <FileText className="hidden sm:block" />
              Documentos
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
                {documentosExternos.length + informes.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="asistente" className="gap-1.5 px-2 sm:gap-2 sm:px-3">
              <Sparkles className="hidden sm:block" />
              <span className="sm:hidden">IA</span>
              <span className="hidden sm:inline">Asistente IA</span>
            </TabsTrigger>
            <TabsTrigger value="cobros" className="gap-1.5 px-2 sm:gap-2 sm:px-3">
              <Receipt className="hidden sm:block" />
              Cobros
              {!boletas.habilitadas && <span className="text-xs text-muted-foreground">Plus</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            <PacienteResumen paciente={paciente} onEdit={() => setEditOpen(true)} />
          </TabsContent>

          <TabsContent value="sesiones">
            <SesionesLista
              pacienteId={id}
              sesiones={sesionesClinicas}
              creatingSession={creatingSession}
              showRemote={MOSTRAR_SESION_REMOTA}
              onNewPresencial={handleNewSession}
              onNewVirtual={() => setPsiconexModalOpen(true)}
              onNewRemote={() => setRemoteModalOpen(true)}
              onDelete={setSesionToDelete}
              onCobro={boletas.habilitadas ? setSesionCobro : undefined}
              mostrarCobro={boletas.habilitadas}
              onMarcarPagado={boletas.habilitadas ? (s) => setCobroPorPagar(s.cobro?.id ?? null) : undefined}
              onVolverPendiente={boletas.habilitadas ? volverAPendiente : undefined}
            />
          </TabsContent>

          <TabsContent value="documentos" className="space-y-4">
            <DocumentosExternos
              pacienteId={id}
              documentos={documentosExternos}
              onUploaded={loadData}
              onDelete={setSesionToDelete}
            />
            <InformesIA
              informes={informes}
              onDeleted={(informeId) => setInformes((prev) => prev.filter((i) => i.id !== informeId))}
            />
          </TabsContent>

          <TabsContent value="asistente" keepMounted className="data-[hidden]:hidden">
            <ChatIA pacienteId={id} paciente={paciente} onInformeSaved={loadData} />
          </TabsContent>

          <TabsContent value="cobros">
            {boletas.habilitadas ? (
              <CobrosPaciente pacienteId={Number(id)} sesiones={sesionesClinicas} soloLectura={false} refreshKey={cobrosRefresh}
                onCobroChanged={actualizarCobroSesion}
                onCompletarFicha={() => setEditOpen(true)}
              />
            ) : (
              <CobrosBloqueados origen="cobros_ficha" enPrueba={boletas.enPrueba} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {boletas.habilitadas && (
        <CobroDialog
          open={Boolean(sesionCobro)}
          pacienteId={Number(id)}
          sesiones={sesionesClinicas}
          sesionId={sesionCobro?.id}
          fechaInicial={sesionCobro ? getDateTimeInputValue(new Date(sesionCobro.fecha_hora_inicio)).slice(0, 10) : undefined}
          onOpenChange={(open) => !open && setSesionCobro(null)}
          onSaved={(cobro) => {
            actualizarCobroSesion(cobro);
            toast.success("Cobro registrado. Revisa el borrador de la boleta en Cobros.");
            setCobrosRefresh((n) => n + 1);
            changeTab("cobros");
          }}
        />
      )}

      <MarcarPagadoDialog
        cobroId={cobroPorPagar}
        onClose={() => setCobroPorPagar(null)}
        onDone={(cobro) => {
          actualizarCobroSesion(cobro);
          setCobrosRefresh((n) => n + 1);
        }}
      />

      <DeleteSesionDialog
        sesion={sesionToDelete}
        onClose={() => setSesionToDelete(null)}
        onDeleted={(sesionId) => setSesiones((prev) => prev.filter((s) => s.id !== sesionId))}
      />

      <EditPacienteDialog
        open={editOpen}
        paciente={paciente}
        onOpenChange={setEditOpen}
        onSaved={(updated) => {
          setPaciente(updated);
          toast.success("Ficha actualizada.");
        }}
      />

      <TestDialog open={testOpen} initialMode={testMode} paciente={paciente} onOpenChange={setTestOpen} />

      <ConsentimientoInformadoModal
        isOpen={consentOpen}
        onClose={() => setConsentOpen(false)}
        paciente={paciente}
        onSavedToFicha={() => {
          loadData();
        }}
      />

      <RemoteSessionModal
        open={remoteModalOpen}
        onClose={() => setRemoteModalOpen(false)}
        paciente={paciente}
        onSessionCreated={async () => {
          await loadData();
        }}
        onStartAssistant={(sesion, meetUrl) => {
          setActiveRemoteSession({ id: sesion.id, url_reunion: meetUrl });
          setAssistantModalOpen(true);
          loadData();
        }}
      />

      <ModalCrearSesionVirtual
        open={psiconexModalOpen}
        onClose={() => setPsiconexModalOpen(false)}
        paciente={paciente}
        onSessionCreated={() => {
          loadData();
        }}
      />

      {activeRemoteSession && (
        <RemoteAudioAssistantModal
          open={assistantModalOpen}
          onClose={() => {
            setAssistantModalOpen(false);
            setActiveRemoteSession(null);
            loadData();
          }}
          sesionId={activeRemoteSession.id}
          pacienteId={paciente.id}
          pacienteNombre={paciente.nombre_completo}
          meetUrl={activeRemoteSession.url_reunion}
          onRecordingStarted={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}
