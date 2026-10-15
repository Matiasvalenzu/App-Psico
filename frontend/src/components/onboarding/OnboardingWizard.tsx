"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  CircleDashed,
  FileText,
  Loader2,
  Mic,
  PlayCircle,
  Stethoscope,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { formatRut, isValidRut } from "@/lib/rut";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ImportarPacientes from "@/components/pacientes/ImportarPacientes";
import { useTutorial } from "@/context/TutorialContext";
import {
  EVENTO_ONBOARDING,
  PASOS_ONBOARDING,
  type EstadoPaso,
  type PasoOnboarding,
} from "@/lib/onboarding";

type Paso = PasoOnboarding | "listo";
type Modalidad = "PRESENCIAL" | "ONLINE" | "HIBRIDA";

const ICONOS: Record<Paso, typeof UserRound> = {
  datos: UserRound,
  voz: Mic,
  calendario: CalendarDays,
  consulta: Stethoscope,
  pacientes: Users,
  boletas: FileText,
  listo: Check,
};

function Campo({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export default function OnboardingWizard() {
  const router = useRouter();
  const { openTutorial } = useTutorial();
  const [mounted, setMounted] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [boletas, setBoletas] = useState(false);
  const [indice, setIndice] = useState(0);
  const [estados, setEstados] = useState<Partial<Record<PasoOnboarding, EstadoPaso>>>({});
  const [guardando, setGuardando] = useState(false);

  const [datos, setDatos] = useState({
    first_name: "",
    last_name: "",
    rut_profesional: "",
    registro_profesional: "",
    especialidad_clinica: "",
  });
  const [modalidad, setModalidad] = useState<Modalidad>("HIBRIDA");
  const [direccion, setDireccion] = useState("");
  const [vozLista, setVozLista] = useState(false);
  const [google, setGoogle] = useState<{ configured?: boolean; connected?: boolean } | null>(null);
  const [conectando, setConectando] = useState(false);

  const pasos: Paso[] = useMemo(() => {
    const base: Paso[] = ["datos", "voz", "calendario", "consulta", "pacientes"];
    if (boletas) base.push("boletas");
    base.push("listo");
    return base;
  }, [boletas]);
  const paso = pasos[Math.min(indice, pasos.length - 1)];

  useEffect(() => {
    setMounted(true);
    let activo = true;
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!activo || user.onboarding_completado !== false) return;
        setBoletas(Boolean(user.boletas_habilitadas));
        const previos = (user.onboarding_pasos || {}) as Partial<Record<PasoOnboarding, EstadoPaso>>;
        setEstados(previos);
        const res = await apiFetch("/cuenta/perfil/");
        if (res.ok) {
          const perfil = await res.json();
          if (!activo) return;
          setDatos({
            first_name: perfil.first_name || "",
            last_name: perfil.last_name || "",
            rut_profesional: perfil.rut_profesional || "",
            registro_profesional: perfil.registro_profesional || "",
            especialidad_clinica: perfil.especialidad_clinica || "",
          });
          setModalidad(perfil.modalidad_atencion || "HIBRIDA");
          setDireccion(perfil.direccion_consulta || "");
        }
        // Retoma donde quedó (por ejemplo, al volver de conectar Google Calendar).
        const orden: Paso[] = ["datos", "voz", "calendario", "consulta", "pacientes", ...(user.boletas_habilitadas ? ["boletas" as Paso] : []), "listo"];
        const siguiente = orden.findIndex((p) => p === "listo" || !previos[p as PasoOnboarding]);
        setIndice(Math.max(0, siguiente));
        setAbierto(true);
      } catch {
        // Sin sesión o sin red: el onboarding puede esperar al próximo ingreso.
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    if (paso === "voz") {
      apiFetch("/voz/")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const lista = d ? d.results || d : [];
          setVozLista(Array.isArray(lista) && lista.length > 0);
        })
        .catch(() => setVozLista(false));
    }
    if (paso === "calendario") {
      apiFetch("/agenda/google/status/")
        .then((r) => (r.ok ? r.json() : null))
        .then(setGoogle)
        .catch(() => setGoogle(null));
    }
  }, [abierto, paso]);

  async function guardar(cambios: Record<string, unknown>) {
    const res = await apiFetch("/cuenta/perfil/", { method: "PATCH", body: JSON.stringify(cambios) });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const primero = data && typeof data === "object" ? Object.values(data)[0] : null;
      throw new Error(Array.isArray(primero) ? String(primero[0]) : "No pudimos guardar. Intenta de nuevo.");
    }
    return data;
  }

  async function marcar(id: PasoOnboarding, estado: EstadoPaso, extra: Record<string, unknown> = {}) {
    setGuardando(true);
    try {
      await guardar({ ...extra, onboarding_pasos: { [id]: estado } });
      setEstados((prev) => ({ ...prev, [id]: estado }));
      setIndice((i) => Math.min(i + 1, pasos.length - 1));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function terminar(destino?: string, video = false) {
    // Lo que quedó sin responder (al cerrar antes) cuenta como pendiente.
    const pendientes: Record<string, EstadoPaso> = {};
    for (const p of pasos) {
      if (p !== "listo" && !estados[p]) pendientes[p] = "omitido";
    }
    try {
      await guardar({ onboarding_completado: true, onboarding_pasos: pendientes });
    } catch {
      // Si falla, se vuelve a ofrecer en el próximo ingreso.
    }
    setEstados((prev) => ({ ...prev, ...pendientes }));
    setAbierto(false);
    window.dispatchEvent(new Event(EVENTO_ONBOARDING));
    if (video) openTutorial("bienvenida");
    if (destino) router.push(destino);
  }

  async function guardarDatos() {
    if (!datos.first_name.trim()) {
      toast.error("Cuéntanos al menos tu nombre.");
      return;
    }
    if (datos.rut_profesional && !isValidRut(datos.rut_profesional)) {
      toast.error("Revisa el RUT: el dígito verificador no calza.");
      return;
    }
    await marcar("datos", "hecho", datos);
  }

  async function conectarGoogle() {
    setConectando(true);
    try {
      // Se guarda antes de salir: al volver de Google, el asistente sigue en el paso siguiente.
      await guardar({ onboarding_pasos: { calendario: "hecho" } });
      const res = await apiFetch("/agenda/google/connect/");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.auth_url) throw new Error(data?.detail || "No pudimos abrir Google Calendar.");
      window.location.href = data.auth_url;
    } catch (err) {
      await guardar({ onboarding_pasos: { calendario: "omitido" } }).catch(() => null);
      toast.error(err instanceof Error ? err.message : "No pudimos abrir Google Calendar.");
      setConectando(false);
    }
  }

  if (!mounted || !abierto) return null;

  const total = pasos.length;
  const progreso = Math.round(((indice + 1) / total) * 100);
  const Icono = ICONOS[paso];
  const titulo = paso === "listo" ? "¡Listo!" : PASOS_ONBOARDING.find((p) => p.id === paso)!.titulo;

  const omitir = paso !== "datos" && paso !== "listo" && (
    <div className="mt-6 border-t border-border pt-4 text-center">
      <button
        type="button"
        disabled={guardando}
        onClick={() => marcar(paso, "omitido")}
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Omitir, lo configuro después
      </button>
      <p className="mt-1 text-xs text-muted-foreground">Puedes configurarlo cuando quieras desde tu panel.</p>
    </div>
  );

  const contenido = (() => {
    switch (paso) {
      case "datos":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Así aparecerás en tus fichas e informes. Solo el nombre es obligatorio; el resto lo puedes completar después en Mi perfil.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Nombres *">
                <Input value={datos.first_name} onChange={(e) => setDatos({ ...datos, first_name: e.target.value })} autoFocus />
              </Campo>
              <Campo label="Apellidos">
                <Input value={datos.last_name} onChange={(e) => setDatos({ ...datos, last_name: e.target.value })} />
              </Campo>
              <Campo label="RUT profesional">
                <Input
                  value={datos.rut_profesional}
                  placeholder="12.345.678-5"
                  onChange={(e) => setDatos({ ...datos, rut_profesional: formatRut(e.target.value) })}
                />
              </Campo>
              <Campo label="Registro profesional">
                <Input value={datos.registro_profesional} onChange={(e) => setDatos({ ...datos, registro_profesional: e.target.value })} />
              </Campo>
            </div>
            <Campo label="Especialidad clínica">
              <Input
                value={datos.especialidad_clinica}
                placeholder="Ej.: Psicología clínica infanto-juvenil"
                onChange={(e) => setDatos({ ...datos, especialidad_clinica: e.target.value })}
              />
            </Campo>
            <div className="flex justify-end">
              <Button onClick={guardarDatos} disabled={guardando}>
                {guardando && <Loader2 className="animate-spin" />}Continuar
              </Button>
            </div>
          </div>
        );
      case "voz":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Graba unos segundos de tu voz para que, en las transcripciones de tus sesiones, Psiconex distinga lo que dices tú de lo que dice tu paciente. El reconocimiento de voz lo hace Deepgram.
            </p>
            {vozLista ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" /> Ya tienes tu voz registrada.
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {vozLista ? (
                <Button onClick={() => marcar("voz", "hecho")} disabled={guardando}>Continuar</Button>
              ) : (
                <Button
                  disabled={guardando}
                  onClick={async () => {
                    await guardar({ onboarding_pasos: { voz: "hecho" } }).catch(() => null);
                    setEstados((p) => ({ ...p, voz: "hecho" }));
                    setIndice((i) => i + 1);
                    // Se oculta mientras graba; al volver a entrar retoma en el paso siguiente.
                    setAbierto(false);
                    router.push("/dashboard/voz");
                  }}
                >
                  <Mic /> Grabar mi voz
                </Button>
              )}
            </div>
          </div>
        );
      case "calendario":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecta tu Google Calendar y tus citas de Psiconex se sincronizan con tu calendario.
            </p>
            {google?.connected && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" /> Tu Google Calendar ya está conectado.
              </div>
            )}
            {google && google.configured === false && (
              <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                La conexión con Google Calendar no está disponible en este momento.
              </p>
            )}
            <div className="flex justify-end">
              {google?.connected ? (
                <Button onClick={() => marcar("calendario", "hecho")} disabled={guardando}>Continuar</Button>
              ) : (
                <Button onClick={conectarGoogle} disabled={conectando || google?.configured === false}>
                  {conectando ? <Loader2 className="animate-spin" /> : <CalendarDays />} Conectar Google Calendar
                </Button>
              )}
            </div>
          </div>
        );
      case "consulta":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">¿Cómo atiendes a tus pacientes?</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ["PRESENCIAL", "Presencial"],
                ["ONLINE", "Online"],
                ["HIBRIDA", "Ambas"],
              ] as [Modalidad, string][]).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setModalidad(valor)}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                    modalidad === valor ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            {modalidad !== "ONLINE" && (
              <Campo label="Dirección de tu consulta" hint="Opcional.">
                <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              </Campo>
            )}
            <div className="flex justify-end">
              <Button
                disabled={guardando}
                onClick={() => marcar("consulta", "hecho", { modalidad_atencion: modalidad, direccion_consulta: direccion })}
              >
                Guardar y seguir
              </Button>
            </div>
          </div>
        );
      case "pacientes":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Ya tienes una lista de pacientes en Excel? Impórtala y revisa cada fila antes de guardar. Si prefieres, parte de cero y los agregas a medida que los atiendes.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <ImportarPacientes onDone={() => marcar("pacientes", "hecho")} />
              <Button variant="secondary" disabled={guardando} onClick={() => marcar("pacientes", "hecho")}>
                Empezar de cero
              </Button>
            </div>
          </div>
        );
      case "boletas":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Con tu plan puedes emitir boletas de honorarios desde Psiconex. Para eso, más adelante autorizas a Psiconex ante el Servicio de Impuestos Internos desde Cobros. No necesitas hacerlo ahora.
            </p>
            <div className="flex justify-end">
              <Button disabled={guardando} onClick={() => marcar("boletas", "omitido")}>Entendido</Button>
            </div>
          </div>
        );
      case "listo": {
        const items = PASOS_ONBOARDING.filter((p) => pasos.includes(p.id));
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Tu cuenta está lista para tu primera sesión. Esto es lo que dejaste configurado:</p>
            <ul className="space-y-2">
              {items.map((p) => {
                const hecho = estados[p.id] === "hecho" && p.id !== "boletas";
                return (
                  <li key={p.id} className="flex items-center gap-2.5 text-sm">
                    {hecho ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" /></span>
                    ) : (
                      <CircleDashed className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={hecho ? "text-foreground" : "text-muted-foreground"}>{p.titulo}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{hecho ? "Listo" : "Pendiente"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">Lo pendiente te queda en la tarjeta “Completa tu configuración” de tu panel.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => terminar(undefined, true)}>
                <PlayCircle /> Ver video de bienvenida
              </Button>
              <Button onClick={() => terminar("/dashboard")}>Ir a mi panel</Button>
            </div>
          </div>
        );
      }
    }
  })();

  return createPortal(
    <div className="fixed inset-0 z-40 flex w-full max-w-[100dvw] items-end justify-center overflow-x-hidden bg-black/30 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="onboarding-titulo">
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-background p-6 shadow-2xl sm:rounded-2xl">
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Paso {indice + 1} de {total}</span>
            {paso !== "listo" && (
              <button type="button" onClick={() => terminar()} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground" aria-label="Cerrar y seguir después">
                Seguir después <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progreso}%` }} />
          </div>
        </div>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icono className="h-5 w-5" />
          </span>
          <div>
            <h2 id="onboarding-titulo" className="text-lg font-semibold tracking-tight text-foreground">{titulo}</h2>
            {indice === 0 && <p className="text-xs text-muted-foreground">Te damos la bienvenida a Psiconex. Son pocos pasos.</p>}
          </div>
        </div>
        {contenido}
        {omitir}
      </div>
    </div>,
    document.body
  );
}
