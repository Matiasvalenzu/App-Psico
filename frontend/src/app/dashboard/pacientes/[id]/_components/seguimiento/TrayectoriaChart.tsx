"use client";

import { useMemo, useState } from "react";
import { colorSeveridad, fechaCorta, type Corte, type SerieTrayectoria } from "@/lib/seguimiento";

type Linea = { clave: string; nombre: string; cortes: Corte[] | null; max: number; min: number; puntos: { x: string; y: number; sev: string; etiqueta: string; alerta: boolean }[] };

const COLORES = ["#6366f1", "#0ea5e9", "#a855f7", "#14b8a6"];

// Gráfico SVG liviano (sin dependencias) con bandas de severidad y puntos de alerta en rojo.
export default function TrayectoriaChart({ series }: { series: SerieTrayectoria[] }) {
  const [slug, setSlug] = useState(series[0]?.slug ?? "");
  const serie = series.find((s) => s.slug === slug) ?? series[0];
  const [hover, setHover] = useState<string | null>(null);

  const lineas: Linea[] = useMemo(() => {
    if (!serie) return [];
    if (serie.subescalas?.length) {
      return serie.subescalas.map((sub) => ({
        clave: sub.clave,
        nombre: `${serie.nombre} · ${sub.nombre}`,
        cortes: sub.cortes,
        max: serie.max,
        min: 0,
        puntos: serie.puntos.map((p) => {
          const s = p.subescalas.find((x) => x.clave === sub.clave);
          return { x: p.fecha, y: s?.puntaje ?? 0, sev: s?.severidad ?? "", etiqueta: s?.etiqueta ?? "", alerta: p.alerta_riesgo };
        }),
      }));
    }
    return [{ clave: serie.slug, nombre: serie.nombre, cortes: serie.cortes, max: serie.max, min: serie.min ?? 0,
      puntos: serie.puntos.map((p) => ({ x: p.fecha, y: p.total ?? 0, sev: p.severidad, etiqueta: p.etiqueta, alerta: p.alerta_riesgo })) }];
  }, [serie]);

  if (!serie) return null;
  const W = 640, H = 240, PL = 36, PR = 12, PT = 12, PB = 28;
  const n = serie.puntos.length;
  const max = serie.max, min = serie.min ?? 0;
  const x = (i: number) => PL + (n <= 1 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (n - 1));
  const y = (v: number) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB);
  const bandas = lineas.length === 1 ? lineas[0].cortes ?? [] : [];

  return (
    <div className="space-y-3">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Escala a graficar">
          {series.map((s) => (
            <button key={s.slug} type="button" role="tab" aria-selected={s.slug === serie.slug} onClick={() => setSlug(s.slug)}
              className={`rounded-full border px-3 py-1 text-xs ${s.slug === serie.slug ? "border-primary bg-primary/10 font-semibold" : "border-border"}`}>
              {s.nombre} ({s.puntos.length})
            </button>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Trayectoria de puntajes de ${serie.nombre_largo}`}>
        {bandas.map((c) => (
          <rect key={c.codigo} x={PL} width={W - PL - PR} y={y(Math.min(c.hasta + 0.5, max))} height={Math.max(0, y(Math.max(c.desde - 0.5, min)) - y(Math.min(c.hasta + 0.5, max)))}
            fill={colorSeveridad(c.codigo)} opacity={0.08}>
            <title>{c.etiqueta}: {c.desde}–{c.hasta}</title>
          </rect>
        ))}
        {[min, Math.round((min + max) / 2), max].map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.1} />
            <text x={PL - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="currentColor" opacity={0.6}>{v}</text>
          </g>
        ))}
        {serie.puntos.map((p, i) => (
          <text key={p.id} x={x(i)} y={H - 8} fontSize={10} textAnchor="middle" fill="currentColor" opacity={0.6}>{fechaCorta(p.fecha).slice(0, 5)}</text>
        ))}
        {lineas.map((l, li) => {
          const color = lineas.length > 1 ? COLORES[li % COLORES.length] : "#6366f1";
          return (
            <g key={l.clave}>
              <polyline fill="none" stroke={color} strokeWidth={2} points={l.puntos.map((p, i) => `${x(i)},${y(p.y)}`).join(" ")} />
              {l.puntos.map((p, i) => {
                const k = `${l.clave}-${i}`;
                return (
                  <g key={k} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
                    {p.alerta && <circle cx={x(i)} cy={y(p.y)} r={9} fill="rgba(185,28,28,.22)" />}
                    <circle cx={x(i)} cy={y(p.y)} r={4.5} fill={colorSeveridad(p.sev)} stroke="white" strokeWidth={1.5}>
                      <title>{`${l.nombre} · ${fechaCorta(p.x)} · ${p.y} (${p.etiqueta})${p.alerta ? " · indicador de riesgo" : ""}`}</title>
                    </circle>
                    {hover === k && (
                      <text x={x(i)} y={y(p.y) - 12} fontSize={11} textAnchor="middle" fill="currentColor" fontWeight={600}>{p.y}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {lineas.length > 1 && lineas.map((l, li) => (
          <span key={l.clave} className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: COLORES[li % COLORES.length] }} />{l.nombre}</span>
        ))}
        <span>{serie.mayor_es_mejor ? "En esta escala, un puntaje más alto indica mejor autoestima." : "Un puntaje más bajo indica menor sintomatología."}</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-red-700/40" />Indicador de riesgo en esa aplicación</span>
      </div>
    </div>
  );
}
