"use client";

import React, { useState } from "react";
import { ArrowDownRight, Eye, EyeOff, Flame, Info, Sparkles, Target } from "lucide-react";

export interface RuedaDimension {
  id: number;
  name: string;
  phrase?: string;
  belief?: string;
  actual: number;
  deseado: number;
  brecha: number;
  level: string;
  label?: string;
}

interface RuedaCreenciasChartProps {
  dimensions: RuedaDimension[];
  promedioActual?: number;
  cargaTotal?: number;
  className?: string;
}

export default function RuedaCreenciasChart({
  dimensions,
  promedioActual,
  cargaTotal,
  className = "",
}: RuedaCreenciasChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showMeta, setShowMeta] = useState<boolean>(true);

  // SVG Geometry constants
  const size = 620;
  const center = size / 2;
  const maxRadius = 210;
  const totalVertices = dimensions.length || 10;
  const angleStep = 360 / totalVertices;

  // Degrees to Cartesian coordinates (0 degrees = 12 o'clock / top)
  function getPoint(radius: number, index: number) {
    const angleInDegrees = index * angleStep - 90;
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: center + radius * Math.cos(angleInRadians),
      y: center + radius * Math.sin(angleInRadians),
    };
  }

  // Generate path string for polygon given a list of radii
  function getPolygonPath(radii: number[]) {
    return radii
      .map((r, i) => {
        const pt = getPoint(r, i);
        return `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
      })
      .concat("Z")
      .join(" ");
  }

  // Decagon grid levels from 1 to 10
  const gridLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Radii for actual and deseado
  const actualRadii = dimensions.map((d) => (Math.max(1, Math.min(10, d.actual)) / 10) * maxRadius);
  const deseadoRadii = dimensions.map((d) => (Math.max(1, Math.min(10, d.deseado)) / 10) * maxRadius);

  const actualPath = getPolygonPath(actualRadii);
  const deseadoPath = getPolygonPath(deseadoRadii);

  const activeDim = hoveredIndex !== null ? dimensions[hoveredIndex] : null;

  return (
    <div className={`rounded-2xl border border-border/60 bg-card p-6 shadow-card ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              Perfil Visual: Gráfico de Radar de Creencias
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
              <Sparkles className="h-3 w-3" />
              10 Ejes TREC
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Diagrama poligonal de telaraña: polígono cian de Presencia Actual (1-10) contrastado con la Meta Deseada.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle meta visibility */}
          <button
            type="button"
            onClick={() => setShowMeta(!showMeta)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent cursor-pointer"
          >
            {showMeta ? <Eye className="h-3.5 w-3.5 text-indigo-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
            {showMeta ? "Ocultar Meta" : "Ver Meta"}
          </button>

          {promedioActual !== undefined && (
            <div className="rounded-xl border border-border/80 bg-muted/30 px-3.5 py-1.5 text-right">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Promedio
              </span>
              <span className="text-sm font-bold text-foreground">
                {promedioActual} <span className="text-[10px] font-normal text-muted-foreground">/ 10</span>
              </span>
            </div>
          )}
          {cargaTotal !== undefined && (
            <div className="rounded-xl border border-border/80 bg-muted/30 px-3.5 py-1.5 text-right">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Carga Global
              </span>
              <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                {cargaTotal} <span className="text-[10px] font-normal text-muted-foreground">/ 100</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid items-center gap-8 lg:grid-cols-[1fr_320px]">
        {/* Radar SVG Diagram */}
        <div className="relative mx-auto flex w-full max-w-[620px] items-center justify-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full max-w-[580px] select-none transition-all duration-300 drop-shadow-xs"
          >
            <defs>
              {/* Cyan gradient fill for actual polygon */}
              <linearGradient id="cyanRadarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.30" />
              </linearGradient>

              {/* Indigo gradient fill for target polygon */}
              <linearGradient id="indigoRadarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.08" />
              </linearGradient>
            </defs>

            {/* Concentric Decagon Grid Rings (1 to 10) */}
            {gridLevels.map((lvl) => {
              const r = (lvl / 10) * maxRadius;
              const decagonPath = getPolygonPath(new Array(totalVertices).fill(r));
              const isMajor = lvl === 5 || lvl === 10;
              return (
                <g key={`grid-lvl-${lvl}`}>
                  <path
                    d={decagonPath}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={isMajor ? 0.22 : 0.10}
                    strokeWidth={isMajor ? "1.3" : "0.9"}
                    className="text-foreground"
                  />
                  {/* Axis scale number on top vertical spoke */}
                  <text
                    x={center + 3}
                    y={center - r + 9}
                    fontSize="9.5"
                    fill="currentColor"
                    opacity={lvl % 2 === 0 || lvl === 5 ? "0.45" : "0.25"}
                    textAnchor="start"
                    className="font-mono font-medium select-none text-[9.5px]"
                  >
                    {lvl}
                  </text>
                </g>
              );
            })}

            {/* Radial Spokes (10 axes from center to perimeter) */}
            {dimensions.map((dim, i) => {
              const ptEnd = getPoint(maxRadius + 4, i);
              const isHovered = hoveredIndex === i;
              return (
                <line
                  key={`spoke-${dim.id}`}
                  x1={center}
                  y1={center}
                  x2={ptEnd.x}
                  y2={ptEnd.y}
                  stroke="currentColor"
                  strokeOpacity={isHovered ? 0.45 : 0.18}
                  strokeWidth={isHovered ? "1.8" : "1"}
                  className="text-foreground transition-all duration-150"
                />
              );
            })}

            {/* Target Polygon (Meta Deseada) - Superimposed */}
            {showMeta && (
              <g className="transition-all duration-300">
                <path
                  d={deseadoPath}
                  fill="url(#indigoRadarGradient)"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  className="drop-shadow-xs"
                />
                {dimensions.map((dim, i) => {
                  const pt = getPoint(deseadoRadii[i], i);
                  return (
                    <circle
                      key={`pt-des-${dim.id}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      fill="#6366f1"
                      stroke="#ffffff"
                      strokeWidth="1.2"
                      className="transition-all"
                    />
                  );
                })}
              </g>
            )}

            {/* Actual Polygon (Presencia Actual) - The Star Figure in Cyan */}
            <path
              d={actualPath}
              fill="url(#cyanRadarGradient)"
              stroke="#0891b2"
              strokeWidth="2.8"
              strokeLinejoin="round"
              className="drop-shadow-md transition-all duration-200"
            />

            {/* Actual Vertex Points and Numeric Float Badges (e.g. 8.00, 7.00, 5.00) */}
            {dimensions.map((dim, i) => {
              const pt = getPoint(actualRadii[i], i);
              const isHovered = hoveredIndex === i;
              const formattedVal = `${dim.actual}.00`;

              // Offset for value label near the vertex
              const angleDeg = i * angleStep - 90;
              const angleRad = (angleDeg * Math.PI) / 180;
              const labelDist = 13;
              const valX = pt.x + labelDist * Math.cos(angleRad);
              const valY = pt.y + labelDist * Math.sin(angleRad) + 3;

              return (
                <g
                  key={`pt-act-${dim.id}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Outer glow ring on hover */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="9"
                      fill="#06b6d4"
                      fillOpacity="0.3"
                      className="animate-pulse"
                    />
                  )}

                  {/* Dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? "5.5" : "4.5"}
                    fill="#0891b2"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    className="transition-all duration-150"
                  />

                  {/* Value label like in the photo: 8.00, 7.00 */}
                  <text
                    x={valX}
                    y={valY}
                    fontSize="9.5"
                    fontWeight="700"
                    fill="#0e7490"
                    textAnchor="middle"
                    className="dark:fill-cyan-300 font-mono select-none drop-shadow-xs"
                  >
                    {formattedVal}
                  </text>
                </g>
              );
            })}

            {/* Outer Dimension Labels (10 Belief Names) */}
            {dimensions.map((dim, i) => {
              const labelRadius = maxRadius + 32;
              const pt = getPoint(labelRadius, i);
              const isHovered = hoveredIndex === i;

              // Anchor text alignment depending on X coordinate
              const textAnchor =
                Math.abs(pt.x - center) < 18
                  ? "middle"
                  : pt.x > center
                  ? "start"
                  : "end";

              return (
                <g
                  key={`label-${dim.id}`}
                  className="cursor-pointer transition-all"
                  onClick={() => setHoveredIndex(i)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <text
                    x={pt.x}
                    y={pt.y}
                    fontSize={isHovered ? "11.5" : "10"}
                    fontWeight={isHovered ? "800" : "600"}
                    textAnchor={textAnchor}
                    className={`transition-colors duration-150 select-none ${
                      isHovered ? "fill-primary font-bold" : "fill-foreground/80"
                    }`}
                  >
                    {dim.name}
                  </text>
                </g>
              );
            })}

            {/* Center circle origin hub */}
            <circle
              cx={center}
              cy={center}
              r="4"
              fill="currentColor"
              opacity="0.35"
            />
          </svg>
        </div>

        {/* Side Panel: Selected Belief & Clinical Highlights */}
        <div className="flex flex-col justify-center space-y-4">
          {activeDim ? (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 shadow-sm transition-all duration-200">
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                  Eje #{activeDim.id}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    activeDim.actual >= 8
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                      : activeDim.actual >= 5
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}
                >
                  {activeDim.level}
                </span>
              </div>

              <h4 className="mt-2 text-base font-bold text-foreground">{activeDim.name}</h4>

              {activeDim.phrase && (
                <p className="mt-1.5 text-xs italic text-muted-foreground bg-background/60 p-2.5 rounded-lg border border-border/50">
                  &ldquo;{activeDim.phrase}&rdquo;
                </p>
              )}

              <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-lg border border-border/80 bg-card p-2 text-center shadow-xs">
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-cyan-700 dark:text-cyan-400">
                    Actual
                  </span>
                  <span className="text-base font-bold text-cyan-700 dark:text-cyan-400">
                    {activeDim.actual}.00
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-indigo-600 dark:text-indigo-400">
                    Meta
                  </span>
                  <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                    {activeDim.deseado}.00
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                    Brecha
                  </span>
                  <span className="flex items-center justify-center gap-0.5 text-base font-bold text-foreground">
                    {activeDim.brecha > 0 && <ArrowDownRight className="h-3 w-3 text-rose-500" />}
                    {activeDim.brecha}
                  </span>
                </div>
              </div>

              {activeDim.belief && (
                <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Núcleo cognitivo:</strong> {activeDim.belief}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 text-center text-muted-foreground">
              <Info className="mx-auto h-6 w-6 opacity-60 text-cyan-500" />
              <p className="mt-2 text-xs font-medium">
                Pasa el cursor por cualquier vértice o nombre del radar para ver los detalles de esa creencia.
              </p>
            </div>
          )}

          {/* Radar Legend */}
          <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 text-xs space-y-2.5">
            <p className="font-semibold text-foreground">Elementos del gráfico de telaraña:</p>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-cyan-500 flex-shrink-0" />
                <span className="text-muted-foreground">
                  <strong className="text-cyan-700 dark:text-cyan-400">Figura Cian Sombreada:</strong> Presencia Actual en el paciente (1 al 10)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-4 border-t-2 border-dashed border-indigo-500 flex-shrink-0" />
                <span className="text-muted-foreground">
                  <strong className="text-indigo-600 dark:text-indigo-400">Silueta Punteada Índigo:</strong> Meta terapéutica deseada
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                <span className="font-mono text-[10px] font-bold text-muted-foreground px-1 border rounded bg-muted/40">
                  X.00
                </span>
                <span className="text-muted-foreground text-[11px]">
                  Puntaje en escala del 1 al 10 sobre cada eje radial
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
