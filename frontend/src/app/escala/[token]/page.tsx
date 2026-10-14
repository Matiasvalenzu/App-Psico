"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Phone } from "lucide-react";
import { publicApiFetch } from "@/lib/api";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import CuestionarioLikert from "@/components/seguimiento/CuestionarioLikert";
import { API_SEG, LINEAS_AYUDA, type Opcion, type Pregunta } from "@/lib/seguimiento";

type Datos = {
  estado: string;
  paciente_nombre: string;
  profesional: string;
  cuestionario: { instrucciones: string; opciones: Opcion[]; preguntas: Pregunta[]; duracion_min: number; pregunta_funcional?: { id: number; texto: string; opciones: Opcion[] } | null };
};

const MENSAJES: Record<string, [string, string]> = {
  RESPONDIDA: ["Este cuestionario ya fue respondido", "Tus respuestas están guardadas. Si necesitas cambiar algo, coméntalo en tu próxima sesión."],
  CANCELADA: ["Este enlace ya no está disponible", "Tu profesional anuló este cuestionario."],
  VENCIDA: ["Este enlace ya no está disponible", "El plazo para responder terminó. Si crees que es un error, escríbele directamente a tu profesional."],
  INVALIDO: ["Enlace no válido", "Revisa que hayas abierto el enlace completo desde el mensaje."],
};

function Ayuda() {
  return (
    <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <p>{LINEAS_AYUDA}</p>
      <Button onClick={() => (window.location.href = "tel:*4141")}><Phone /> Llamar al *4141</Button>
    </div>
  );
}

// Cuestionario de seguimiento para el paciente: no muestra el nombre del instrumento ni puntajes.
export default function EscalaPublicaPage() {
  const { token } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [estado, setEstado] = useState<string>("CARGANDO");
  const [iniciado, setIniciado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [riesgo, setRiesgo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    publicApiFetch(`${API_SEG}/escalas/publica/${token}/`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        setEstado(d.estado ?? (r.ok ? "DISPONIBLE" : "INVALIDO"));
        if (r.ok) setDatos(d);
      })
      .catch(() => setEstado("INVALIDO"));
  }, [token]);

  async function enviar(respuestas: Record<string, number>) {
    setEnviando(true);
    setError("");
    try {
      const r = await publicApiFetch(`${API_SEG}/escalas/publica/${token}/`, { method: "POST", body: JSON.stringify({ respuestas }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "No se pudieron enviar tus respuestas.");
      setRiesgo(Boolean(d.riesgo));
      setEstado("ENVIADA");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron enviar tus respuestas.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <Logo className="h-8" />
        <div className="rounded-2xl border bg-background p-5 shadow-sm">
          {estado === "CARGANDO" && <p className="text-sm text-muted-foreground">Cargando tu cuestionario…</p>}
          {MENSAJES[estado] && (
            <div className="space-y-2"><h1 className="text-lg font-semibold">{MENSAJES[estado][0]}</h1><p className="text-sm text-muted-foreground">{MENSAJES[estado][1]}</p></div>
          )}
          {estado === "DISPONIBLE" && datos && !iniciado && (
            <div className="space-y-4">
              <h1 className="text-xl font-semibold">Hola {datos.paciente_nombre}</h1>
              <p className="text-sm">{datos.profesional} te invita a responder un breve cuestionario de seguimiento: {datos.cuestionario.preguntas.length} preguntas, unos {datos.cuestionario.duracion_min} minutos.</p>
              <p className="text-sm text-muted-foreground">No hay respuestas correctas ni incorrectas. Tus respuestas las ve solo tu profesional y quedan en tu ficha clínica.</p>
              <Button size="lg" className="w-full" onClick={() => setIniciado(true)}>Comenzar</Button>
            </div>
          )}
          {estado === "DISPONIBLE" && datos && iniciado && (
            <>
              <h1 className="mb-4 text-lg font-semibold">Cuestionario de seguimiento</h1>
              <CuestionarioLikert
                instrucciones={datos.cuestionario.instrucciones}
                opciones={datos.cuestionario.opciones}
                preguntas={datos.cuestionario.preguntas}
                preguntaFuncional={datos.cuestionario.pregunta_funcional}
                enviando={enviando}
                onEnviar={enviar}
              />
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            </>
          )}
          {estado === "ENVIADA" && (
            <div className="space-y-4">
              <h1 className="text-lg font-semibold">¡Gracias! Tus respuestas fueron enviadas</h1>
              <p className="text-sm text-muted-foreground">Las revisará tu profesional. Puedes cerrar esta página.</p>
              {riesgo && <Ayuda />}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
