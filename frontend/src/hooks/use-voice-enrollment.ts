"use client";

// Grabación y registro del perfil de voz. Lo usan la página /dashboard/voz y el
// paso "Tu voz" del onboarding, con la misma API (/voz/enroll/).

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export function getAudioMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export function getAudioExtension(mime: string) {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

export // Textos variados de temática terapéutica y reflexiva (~22 a 26 palabras, aprox. 10 a 12 segundos de lectura)
const SAMPLE_TEXTS = [
  "Durante el proceso terapéutico, es fundamental construir un espacio seguro donde la escucha activa y la empatía permitan explorar emociones sin juicios.",
  "El bienestar emocional se construye día a día reconociendo nuestras fortalezas, aceptando las dificultades y trabajando en estrategias que nos den serenidad.",
  "Cada sesión clínica nos invita a comprender la singularidad del paciente, acompañando sus reflexiones y descubriendo nuevas perspectivas para su desarrollo personal.",
  "La respiración pausada y la atención plena nos ayudan a regular los pensamientos cotidianos, favoreciendo una mente más tranquila y enfocada en el presente.",
  "Establecer metas claras en la terapia permite evaluar los avances del tratamiento, fortaleciendo el compromiso mutuo entre terapeuta y consultante en cada encuentro.",
  "A veces los cambios más significativos surgen de conversaciones sencillas, donde poner en palabras lo que sentimos abre caminos hacia la comprensión y el alivio.",
  "La alianza terapéutica es la base del cambio positivo; escuchar con calidez y prestar atención a los detalles marca la diferencia en cada sesión.",
  "Reconocer y validar las emociones difíciles es el primer paso para procesarlas, permitiéndonos responder con mayor claridad ante los desafíos de la vida cotidiana.",
  "En este espacio trabajamos juntos para identificar patrones de pensamiento y desarrollar herramientas prácticas que mejoren tu bienestar y calidad de vida.",
  "Aprender a tratarnos con amabilidad y autocompasión frente al error es una de las habilidades más valiosas que podemos cultivar en nuestro día a día.",
];

export function useVoiceEnrollment({ onEnrolled }: { onEnrolled?: () => Promise<void> | void } = {}) {
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [samples, setSamples] = useState<Blob[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [saving, setSaving] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Elegir un texto inicial al azar
    setCurrentTextIndex(Math.floor(Math.random() * SAMPLE_TEXTS.length));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function shuffleText() {
    setCurrentTextIndex((prev) => {
      let next = Math.floor(Math.random() * SAMPLE_TEXTS.length);
      if (next === prev) next = (next + 1) % SAMPLE_TEXTS.length;
      return next;
    });
  }

  async function startRecording() {
    try {
      setMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getAudioMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = rec;
      chunksRef.current = [];
      setRecordingSeconds(0);

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setSamples((prev) => [...prev, blob].slice(0, 5));
        setRecording(false);
        // Avanzar automáticamente al siguiente texto para la próxima muestra
        setCurrentTextIndex((prev) => (prev + 1) % SAMPLE_TEXTS.length);
      };

      rec.start(1000);
      setRecording(true);

      // Iniciar cronómetro de la muestra
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setMessageType("error");
      setMessage("No se pudo acceder al micrófono. Verifica los permisos de tu navegador.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }

  async function enroll() {
    if (samples.length < 3) {
      setMessageType("error");
      setMessage("Graba al menos 3 muestras de voz (idealmente 5) antes de guardar.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const formData = new FormData();
      samples.forEach((s, i) =>
        formData.append("samples", s, `muestra-${i + 1}.${getAudioExtension(s.type)}`)
      );
      const res = await apiFetch("/voz/enroll/", { method: "POST", body: formData });
      if (!res.ok) {
        let detail = "No se pudo guardar el perfil.";
        try {
          const d = await res.json();
          detail = d.error || d.detail || detail;
        } catch {}
        setMessageType("error");
        setMessage(detail);
        return;
      }
      setSamples([]);
      await onEnrolled?.();
      setMessageType("success");
      setMessage("¡Perfil de voz guardado correctamente! Ya está listo para identificar tu voz en las sesiones.");
    } catch {
      setMessageType("error");
      setMessage("No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  function removeSample(index: number) {
    setSamples((prev) => prev.filter((_, i) => i !== index));
  }

  return {
    recording,
    recordingSeconds,
    samples,
    setSamples,
    message,
    setMessage,
    messageType,
    setMessageType,
    saving,
    currentTextIndex,
    shuffleText,
    startRecording,
    stopRecording,
    enroll,
    removeSample,
  };
}
