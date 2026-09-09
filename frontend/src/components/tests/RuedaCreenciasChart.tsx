"use client";

import React, { useState } from "react";
import { Award, Compass, Info, Sparkles, TrendingUp } from "lucide-react";

export interface RuedaDimension {
  id: number;
  name: string;
  phrase?: string;
  description?: string;
  belief?: string;
  score?: number;
  actual?: number;
  deseado?: number;
  brecha?: number;
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

  // SVG Geometry constants - expanded canvas for high visibility
  const viewWidth = 1020;
  const viewHeight = 900;
  const centerX = 510;
  const centerY = 450;
  const maxRadius = 285;
  const labelRadius = 330;
  const totalVertices = dimensions.length || 10;
  const angleStep = 360 / totalVertices;

  // Degrees to Cartesian coordinates (0 degrees = 12 o'clock / top)
  function getPoint(radius: number, index: number) {
    const angleInDegrees = index * angleStep - 90;
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
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

  // Radii for present scores (score or actual)
  const actualRadii = dimensions.map((d) => {
    const val = d.score !== undefined ? d.score : (d.actual !== undefined ? d.actual : 1);
    return (Math.max(1, Math.min(10, val)) / 10) * maxRadius;
  });

  const actualPath = getPolygonPath(actualRadii);
  const activeDim = hoveredIndex !== null ? dimensions[hoveredIndex] : null;

  // Sorted dimensions for default summary overview
  const sortedDims = [...dimensions].sort((a, b) => {
    const valA = a.score ?? a.actual ?? 1;
    const valB = b.score ?? b.actual ?? 1;
    return valB - valA;
  });
  const highestDim = sortedDims[0];
  const lowestDim = sortedDims[sortedDims.length - 1];

  return (
    <div className={`rounded-2xl border border-border/60 bg-card p-6 sm:p-7 shadow-card ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Perfil Visual: Gráfico de Radar - Rueda de la Vida
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              10 Áreas Vitales
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Diagrama interactivo de telaraña: polígono cian de Satisfacción Actual (escala del 1 al 10).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {promedioActual !== undefined && (
            <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2 text-right shadow-2xs">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Promedio Vital
              </span>
              <span className="text-base font-extrabold text-foreground">
                {promedioActual} <span className="text-[11px] font-normal text-muted-foreground">/ 10</span>
              </span>
            </div>
          )}
          {cargaTotal !== undefined && (
            <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2 text-right shadow-2xs">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Puntaje Global
              </span>
              <span className="text-base font-extrabold text-cyan-600 dark:text-cyan-400">
                {cargaTotal} <span className="text-[11px] font-normal text-muted-foreground">/ 100</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content grid: Radar Canvas (prominent) + Side Panel (stable) */}
      <div className="mt-6 flex flex-col xl:flex-row items-start justify-center gap-8">
        {/* Radar SVG Diagram */}
        <div className="relative mx-auto flex w-full max-w-[760px] items-center justify-center flex-1 overflow-visible">
          <svg
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
            className="w-full h-auto max-w-[760px] select-none"
          >
            <defs>
              {/* Cyan gradient fill for actual polygon */}
              <linearGradient id="cyanRadarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.60" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.32" />
              </linearGradient>

              {/* Area label pill shadow */}
              <filter id="labelShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodOpacity="0.08" />
              </filter>
            </defs>

            {/* Concentric Decagon Grid Rings (1 to 10) */}
            {gridLevels.map((lvl) => {
              const r = (lvl / 10) * maxRadius;
              const decagonPath = getPolygonPath(new Array(totalVertices).fill(r));
              const isMajor = lvl === 5 || lvl === 10;
              return (
                <g key={`grid-lvl-${lvl}`} pointerEvents="none">
                  <path
                    d={decagonPath}
                    fill={lvl === 10 ? "currentColor" : "none"}
                    fillOpacity={lvl === 10 ? 0.02 : 0}
                    stroke="currentColor"
                    strokeOpacity={isMajor ? 0.28 : 0.12}
                    strokeWidth={isMajor ? "1.6" : "1.0"}
                    className="text-foreground"
                  />
                  {/* Axis scale number on top vertical spoke */}
                  <text
                    x={centerX + 5}
                    y={centerY - r + 11}
                    fontSize="11"
                    fontWeight="600"
                    fill="currentColor"
                    opacity={lvl % 2 === 0 || lvl === 5 ? "0.55" : "0.30"}
                    textAnchor="start"
                    className="font-mono select-none"
                  >
                    {lvl}
                  </text>
                </g>
              );
            })}

            {/* Radial Spokes (10 axes from center to perimeter) */}
            {dimensions.map((dim, i) => {
              const ptEnd = getPoint(maxRadius + 6, i);
              const isHovered = hoveredIndex === i;
              return (
                <line
                  key={`spoke-${dim.id}`}
                  x1={centerX}
                  y1={centerY}
                  x2={ptEnd.x}
                  y2={ptEnd.y}
                  stroke={isHovered ? "#0891b2" : "currentColor"}
                  strokeOpacity={isHovered ? 0.75 : 0.20}
                  strokeWidth={isHovered ? "2.2" : "1.1"}
                  className="transition-colors duration-150"
                  pointerEvents="none"
                />
              );
            })}

            {/* Actual Polygon (Nivel Actual) - Star shape in Cyan */}
            <path
              d={actualPath}
              fill="url(#cyanRadarGradient)"
              stroke="#0891b2"
              strokeWidth="3.2"
              strokeLinejoin="round"
              pointerEvents="none"
            />

            {/* Center circle origin hub */}
            <circle
              cx={centerX}
              cy={centerY}
              r="5"
              fill="#0891b2"
              opacity="0.5"
              pointerEvents="none"
            />

            {/* Actual Vertex Points and Numeric Float Badges */}
            {dimensions.map((dim, i) => {
              const pt = getPoint(actualRadii[i], i);
              const isHovered = hoveredIndex === i;
              const valNum = dim.score !== undefined ? dim.score : (dim.actual !== undefined ? dim.actual : 1);
              const formattedVal = `${valNum}.00`;

              // Offset for vertex value badge
              const angleDeg = i * angleStep - 90;
              const angleRad = (angleDeg * Math.PI) / 180;
              const labelDist = 15;
              const valX = pt.x + labelDist * Math.cos(angleRad);
              const valY = pt.y + labelDist * Math.sin(angleRad) + 4;

              return (
                <g key={`pt-act-${dim.id}`}>
                  {/* Stable stationary glow on hover */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="12"
                      fill="#06b6d4"
                      fillOpacity="0.35"
                      pointerEvents="none"
                    />
                  )}

                  {/* Dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="5"
                    fill={isHovered ? "#0891b2" : "#0891b2"}
                    stroke="#ffffff"
                    strokeWidth="2"
                    pointerEvents="none"
                  />

                  {/* Float value text */}
                  <text
                    x={valX}
                    y={valY}
                    fontSize="11"
                    fontWeight="700"
                    fill="#0891b2"
                    textAnchor="middle"
                    className="dark:fill-cyan-300 font-mono select-none drop-shadow-xs"
                    pointerEvents="none"
                  >
                    {formattedVal}
                  </text>

                  {/* Dedicated invisible stable hit target for vertex dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="22"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                </g>
              );
            })}

            {/* Outer Dimension Labels with High-Contrast Pill Badges */}
            {dimensions.map((dim, i) => {
              const pt = getPoint(labelRadius, i);
              const isHovered = hoveredIndex === i;
              const valNum = dim.score !== undefined ? dim.score : (dim.actual !== undefined ? dim.actual : 1);
              const formattedVal = `${valNum}.00`;

              // Alignment based on X coordinate relative to center
              const textAnchor =
                Math.abs(pt.x - centerX) < 25
                  ? "middle"
                  : pt.x > centerX
                  ? "start"
                  : "end";

              // Exact fixed pill badge dimensions
              const boxW = Math.max(125, dim.name.length * 9.2 + 20);
              const boxH = 44;
              const boxX =
                textAnchor === "end"
                  ? pt.x - boxW + 6
                  : textAnchor === "middle"
                  ? pt.x - boxW / 2
                  : pt.x - 6;
              const boxY = pt.y - 18;

              return (
                <g key={`label-group-${dim.id}`}>
                  {/* Visual Pill Badge */}
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxW}
                    height={boxH}
                    rx="10"
                    filter="url(#labelShadow)"
                    className={`transition-colors duration-150 ${
                      isHovered
                        ? "fill-cyan-500/15 stroke-cyan-500 stroke-2 dark:fill-cyan-950/50"
                        : "fill-card stroke-border/70 stroke-1"
                    }`}
                    pointerEvents="none"
                  />

                  {/* Two-line text: Area Name (Bold 14.5px) + Score Pill (12.5px) */}
                  <text
                    x={pt.x}
                    y={pt.y - 1}
                    textAnchor={textAnchor}
                    className="select-none pointer-events-none"
                  >
                    <tspan
                      x={pt.x}
                      dy="0"
                      fontSize="14.5"
                      fontWeight="700"
                      className={`transition-colors duration-150 ${
                        isHovered
                          ? "fill-cyan-700 dark:fill-cyan-300 font-extrabold"
                          : "fill-foreground"
                      }`}
                    >
                      {dim.name}
                    </tspan>
                    <tspan
                      x={pt.x}
                      dy="19"
                      fontSize="12.5"
                      fontWeight="700"
                      className={
                        valNum >= 8
                          ? "fill-emerald-600 dark:fill-emerald-400"
                          : valNum >= 5
                          ? "fill-cyan-700 dark:fill-cyan-300"
                          : "fill-rose-600 dark:fill-rose-400"
                      }
                    >
                      {formattedVal} / 10
                    </tspan>
                  </text>

                  {/* Dedicated fixed invisible hit target covering the pill */}
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxW}
                    height={boxH}
                    rx="10"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Side Panel: Selected Area or General Balance Overview */}
        <div className="flex w-full xl:w-[350px] flex-col justify-start space-y-4 flex-shrink-0">
          {activeDim ? (
            <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-5 shadow-sm min-h-[300px] flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-md bg-cyan-500/20 px-2.5 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                    Área #{activeDim.id}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      (activeDim.score ?? activeDim.actual ?? 1) >= 8
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                        : (activeDim.score ?? activeDim.actual ?? 1) >= 5
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                    }`}
                  >
                    {activeDim.label || activeDim.level}
                  </span>
                </div>

                <h4 className="mt-3 text-lg font-bold tracking-tight text-foreground">
                  {activeDim.name}
                </h4>

                {activeDim.phrase && (
                  <p className="mt-2 text-xs italic text-muted-foreground bg-background/80 p-3 rounded-xl border border-border/50 leading-relaxed">
                    &ldquo;{activeDim.phrase}&rdquo;
                  </p>
                )}

                <div className="mt-3.5 rounded-xl border border-cyan-500/30 bg-card p-3.5 text-center shadow-xs">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                    Nivel de Satisfacción Actual
                  </span>
                  <span className="text-2xl font-extrabold text-cyan-700 dark:text-cyan-400">
                    {(activeDim.score ?? activeDim.actual ?? 1)}.00{" "}
                    <span className="text-xs font-normal text-muted-foreground">/ 10</span>
                  </span>
                </div>
              </div>

              {activeDim.description && (
                <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground pt-2 border-t border-cyan-500/20">
                  <strong className="text-foreground">Ámbito evaluado:</strong> {activeDim.description}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 min-h-[300px] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                  <Compass className="h-5 w-5" />
                  <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Balance General de la Rueda
                  </h4>
                </div>

                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Exploración holística en 10 dimensiones vitales. Pasa el cursor sobre cualquier vértice o nombre para ver su análisis clínico.
                </p>

                <div className="mt-4 space-y-2.5">
                  {highestDim && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <Award className="h-3.5 w-3.5" />
                        Mayor Fortaleza Vital
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">{highestDim.name}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {(highestDim.score ?? highestDim.actual ?? 1)}.00 / 10
                        </span>
                      </div>
                    </div>
                  )}

                  {lowestDim && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Área Prioritaria de Atención
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">{lowestDim.name}</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {(lowestDim.score ?? lowestDim.actual ?? 1)}.00 / 10
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground border-t border-border/60 pt-3">
                <Info className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                <span>Interacción táctil y hover habilitada sobre todo el radar.</span>
              </div>
            </div>
          )}

          {/* Radar Legend */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-xs space-y-2.5 shadow-2xs">
            <p className="font-bold text-foreground">Interpretación visual del gráfico:</p>
            <div className="grid gap-2">
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-full bg-cyan-500 flex-shrink-0 shadow-xs" />
                <span className="text-muted-foreground">
                  <strong className="text-cyan-700 dark:text-cyan-400">Polígono Cian:</strong> Nivel de satisfacción actual del paciente (1 al 10)
                </span>
              </div>
              <div className="flex items-center gap-2.5 pt-1.5 border-t border-border/50 text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px] font-bold text-foreground px-1.5 py-0.5 border rounded bg-muted/60">
                  X.00 / 10
                </span>
                <span>Puntaje numérico visible en cada uno de los 10 ejes radiales</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { RuedaCreenciasChart as RuedaVidaChart };


