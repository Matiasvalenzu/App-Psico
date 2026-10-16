"use client";

// Procesa la cámara en el navegador: segmenta a la persona (MediaPipe selfie segmenter,
// servido desde /mediapipe en el mismo origen) y dibuja en un canvas cuyo captureStream()
// es la pista de video que se envía. Nada sale del dispositivo.

import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import { cubrir, tamanoSalida, type FondoEfecto } from "./fondo-videollamada";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/selfie_segmenter.tflite";
const FPS = 24;
const SEG_W = 256; // la segmentación se hace sobre una copia pequeña
const LENTO_MS = 70; // promedio por cuadro sobre el que se considera "muy lento" (~14 fps)

let segmenterPromise: Promise<ImageSegmenter> | null = null;

async function crearSegmenter(): Promise<ImageSegmenter> {
  const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const base = { runningMode: "VIDEO" as const, outputConfidenceMasks: true, outputCategoryMask: false };
  try {
    return await ImageSegmenter.createFromOptions(fileset, {
      ...base,
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    });
  } catch {
    return ImageSegmenter.createFromOptions(fileset, {
      ...base,
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
    });
  }
}

function obtenerSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = crearSegmenter().catch((e) => {
      segmenterPromise = null;
      throw e;
    });
  }
  return segmenterPromise;
}

export function fondosSoportados(): boolean {
  if (typeof window === "undefined") return false;
  const c = document.createElement("canvas");
  return (
    typeof WebAssembly === "object" &&
    typeof (c as HTMLCanvasElement).captureStream === "function" &&
    typeof Worker !== "undefined" &&
    Boolean(c.getContext("2d"))
  );
}

// Temporizador en un Worker: requestAnimationFrame y setTimeout se frenan con la pestaña
// en segundo plano, y eso congelaría el video que recibe la otra persona.
function crearTicker(fps: number, cb: () => void) {
  const code = `let t=null;onmessage=e=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}`;
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  const w = new Worker(url);
  URL.revokeObjectURL(url);
  w.onmessage = cb;
  w.postMessage(Math.round(1000 / fps));
  return () => {
    w.postMessage(0);
    w.terminate();
  };
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("No se pudo cargar el fondo"));
    im.src = src;
  });
}

export interface ProcesadorFondo {
  track: MediaStreamTrack;
  setEfecto: (efecto: FondoEfecto) => Promise<void>;
  stop: () => void;
}

export async function crearProcesadorFondo(
  rawTrack: MediaStreamTrack,
  efectoInicial: FondoEfecto,
  onLento: () => void
): Promise<ProcesadorFondo> {
  const segmenter = await obtenerSegmenter();

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([rawTrack]);
  await video.play();
  if (!video.videoWidth) await new Promise((r) => video.addEventListener("loadedmetadata", r, { once: true }));

  const { width, height } = tamanoSalida(video.videoWidth, video.videoHeight);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;

  const segH = Math.max(2, Math.round((SEG_W * height) / width));
  const small = document.createElement("canvas");
  small.width = SEG_W;
  small.height = segH;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = SEG_W;
  maskCanvas.height = segH;
  const mctx = maskCanvas.getContext("2d")!;
  const maskData = mctx.createImageData(SEG_W, segH);

  // Difuminado por reducción y ampliación: funciona en todos los navegadores (incluido Safari
  // sin ctx.filter) y es mucho más barato que un blur real.
  const blurCanvas = document.createElement("canvas");
  const bctx = blurCanvas.getContext("2d")!;

  let efecto = efectoInicial;
  let fondoImg: HTMLImageElement | null = null;
  if (efecto.tipo === "imagen") fondoImg = await cargarImagen(efecto.src);

  const stream = out.captureStream(FPS);
  const track = stream.getVideoTracks()[0];
  track.enabled = rawTrack.enabled;

  let ocupado = false;
  let ultimoTs = 0;
  let suma = 0;
  let cuadros = 0;
  let avisado = false;

  const dibujar = () => {
    if (ocupado || video.readyState < 2) return;
    if (!rawTrack.enabled || rawTrack.readyState !== "live") return; // cámara apagada: no gastar CPU
    ocupado = true;
    const t0 = performance.now();
    try {
      sctx.drawImage(video, 0, 0, SEG_W, segH);
      const ts = Math.max(ultimoTs + 1, Math.round(t0));
      ultimoTs = ts;
      const result = segmenter.segmentForVideo(small, ts);
      const conf = result.confidenceMasks?.[0]?.getAsFloat32Array();
      if (conf) {
        const d = maskData.data;
        for (let i = 0, j = 3; i < conf.length; i++, j += 4) d[j] = conf[i] * 255;
        mctx.putImageData(maskData, 0, 0);
      }
      result.close();

      ctx.save();
      ctx.globalCompositeOperation = "copy";
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(maskCanvas, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-in";
      ctx.drawImage(video, 0, 0, width, height);
      ctx.globalCompositeOperation = "destination-over";
      if (efecto.tipo === "imagen" && fondoImg) {
        const c = cubrir(fondoImg.naturalWidth, fondoImg.naturalHeight, width, height);
        ctx.drawImage(fondoImg, c.sx, c.sy, c.sw, c.sh, 0, 0, width, height);
      } else if (efecto.tipo === "difuminar") {
        const f = efecto.intensidad === "fuerte" ? 20 : 9;
        const bw = Math.max(2, Math.round(width / f));
        const bh = Math.max(2, Math.round(height / f));
        if (blurCanvas.width !== bw || blurCanvas.height !== bh) {
          blurCanvas.width = bw;
          blurCanvas.height = bh;
        }
        bctx.drawImage(video, 0, 0, bw, bh);
        ctx.drawImage(blurCanvas, 0, 0, width, height);
      } else {
        ctx.drawImage(video, 0, 0, width, height);
      }
      ctx.restore();
    } catch {
      // un cuadro fallido no corta la llamada
    } finally {
      ocupado = false;
    }
    const dt = performance.now() - t0;
    if (cuadros >= 15) {
      // ignorar los primeros cuadros (calentamiento de wasm/GPU)
      suma += dt;
      if (cuadros >= 75 && !avisado) {
        if (suma / (cuadros - 15) > LENTO_MS) {
          avisado = true;
          onLento();
        }
        suma = 0;
        cuadros = 15;
      }
    }
    cuadros++;
  };

  const pararTicker = crearTicker(FPS, dibujar);

  return {
    track,
    async setEfecto(nuevo) {
      if (nuevo.tipo === "imagen") fondoImg = await cargarImagen(nuevo.src);
      efecto = nuevo;
    },
    stop() {
      pararTicker();
      track.stop();
      video.pause();
      video.srcObject = null;
    },
  };
}
