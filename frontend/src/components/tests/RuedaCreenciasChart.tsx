"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Award,
  Compass,
  Info,
  Maximize2,
  MousePointerClick,
  Sparkles,
  TrendingUp,
  X,
  ZoomIn,
} from "lucide-react";

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
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  // Prevent background body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isModalOpen]);

  // SVG Geometry constants - expanded canvas for high visibility
  const viewWidth = 1060;
  const viewHeight = 920;
  const centerX = 530;
  const centerY = 460;
  const maxRadius = 310;
  const labelRadius = 365;
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

  // Active dimension for inspection
  const activeIndex = hoveredIndex !== null ? hoveredIndex : selectedAreaIndex;
  const activeDim = activeIndex !== null ? dimensions[activeIndex] : null;

  // Sorted dimensions for default summary overview
  const sortedDims = [...dimensions].sort((a, b) => {
    const valA = a.score ?? a.actual ?? 1;
    const valB = b.score ?? b.actual ?? 1;
    return valB - valA;
  });
  const highestDim = sortedDims[0];
  const lowestDim = sortedDims[sortedDims.length - 1];

  // Reusable Radar SVG rendering function
  const renderRadarSvg = (interactive = true) => (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      className="w-full h-auto select-none"
    >
      <defs>
        {/* Cyan gradient fill for actual polygon */}
        <linearGradient id="cyanRadarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.35" />
        </linearGradient>

        {/* Area label pill shadow */}
        <filter id="labelShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodOpacity="0.10" />
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
        const isHovered = activeIndex === i;
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
        r="5.5"
        fill="#0891b2"
        opacity="0.5"
        pointerEvents="none"
      />

      {/* Actual Vertex Points and Numeric Float Badges */}
      {dimensions.map((dim, i) => {
        const pt = getPoint(actualRadii[i], i);
        const isHovered = activeIndex === i;
        const valNum = dim.score !== undefined ? dim.score : (dim.actual !== undefined ? dim.actual : 1);
        const formattedVal = `${valNum}.00`;

        // Offset for vertex value badge
        const angleDeg = i * angleStep - 90;
        const angleRad = (angleDeg * Math.PI) / 180;
        const labelDist = 16;
        const valX = pt.x + labelDist * Math.cos(angleRad);
        const valY = pt.y + labelDist * Math.sin(angleRad) + 4;

        return (
          <g key={`pt-act-${dim.id}`}>
            {/* Stable stationary glow on hover */}
            {isHovered && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r="13"
                fill="#06b6d4"
                fillOpacity="0.38"
                pointerEvents="none"
              />
            )}

            {/* Dot */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r="5.5"
              fill="#0891b2"
              stroke="#ffffff"
              strokeWidth="2"
              pointerEvents="none"
            />

            {/* Float value text */}
            <text
              x={valX}
              y={valY}
              fontSize="11.5"
              fontWeight="700"
              fill="#0891b2"
              textAnchor="middle"
              className="dark:fill-cyan-300 font-mono select-none drop-shadow-xs"
              pointerEvents="none"
            >
              {formattedVal}
            </text>

            {/* Dedicated invisible stable hit target for vertex dot */}
            {interactive && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r="24"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAreaIndex(i === selectedAreaIndex ? null : i);
                }}
              />
            )}
          </g>
        );
      })}

      {/* Outer Dimension Labels with High-Contrast Pill Badges */}
      {dimensions.map((dim, i) => {
        const pt = getPoint(labelRadius, i);
        const isHovered = activeIndex === i;
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
        const boxW = Math.max(130, dim.name.length * 9.4 + 22);
        const boxH = 46;
        const boxX =
          textAnchor === "end"
            ? pt.x - boxW + 6
            : textAnchor === "middle"
            ? pt.x - boxW / 2
            : pt.x - 6;
        const boxY = pt.y - 19;

        return (
          <g key={`label-group-${dim.id}`}>
            {/* Visual Pill Badge */}
            <rect
              x={boxX}
              y={boxY}
              width={boxW}
              height={boxH}
              rx="11"
              filter="url(#labelShadow)"
              className={`transition-colors duration-150 ${
                isHovered
                  ? "fill-cyan-500/15 stroke-cyan-500 stroke-2 dark:fill-cyan-950/60"
                  : "fill-card stroke-border/70 stroke-1"
              }`}
              pointerEvents="none"
            />

            {/* Two-line text: Area Name (Bold 14.5px) + Score Pill (12.5px) */}
            <text
              x={pt.x}
              y={pt.y}
              textAnchor={textAnchor}
              className="select-none pointer-events-none"
            >
              <tspan
                x={pt.x}
                dy="0"
                fontSize="15"
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
                dy="20"
                fontSize="13"
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
            {interactive && (
              <rect
                x={boxX}
                y={boxY}
                width={boxW}
                height={boxH}
                rx="11"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAreaIndex(i === selectedAreaIndex ? null : i);
                }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );

  return (
    <div className={`rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-card ${className}`}>
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
            Diagrama interactivo de telaraña: polígono cian de Satisfacción Actual (escala del 1 al 10). Haz clic en el gráfico para ampliarlo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          {/* Expand Modal Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer shadow-xs"
            title="Ampliar gráfico en pantalla completa"
          >
            <Maximize2 className="h-4 w-4" />
            <span>Ampliar gráfico</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Radar Chart Container */}
      <div className="mt-6 flex flex-col items-center justify-center">
        <div
          onClick={() => setIsModalOpen(true)}
          className="group relative flex w-full max-w-[880px] items-center justify-center rounded-3xl border border-border/40 bg-gradient-to-b from-muted/10 to-muted/30 p-2 sm:p-6 transition-all hover:border-cyan-500/40 hover:shadow-lg cursor-zoom-in overflow-visible"
        >
          {/* Subtle expand cue badge */}
          <div className="absolute top-3 right-3 z-10 hidden sm:flex items-center gap-1.5 rounded-full border border-border/80 bg-card/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur-xs opacity-75 group-hover:opacity-100 group-hover:border-cyan-500/50 group-hover:text-cyan-600 transition-all pointer-events-none">
            <ZoomIn className="h-3.5 w-3.5" />
            <span>Haz clic para ampliar</span>
          </div>

          {/* Render the large interactive Radar SVG */}
          {renderRadarSvg(true)}
        </div>
      </div>

      {/* Bottom Grid: Balance General + Detalle de Área + Leyenda */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 border-t border-border/60 pt-6">
        {/* Card 1: Balance General de la Rueda */}
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
              <Compass className="h-5 w-5 flex-shrink-0" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Balance General de la Rueda
              </h4>
            </div>

            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Exploración holística en 10 dimensiones vitales. Pasa el cursor o pulsa sobre cualquier área para examinar su análisis clínico.
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

        {/* Card 2: Detalle Clínico del Área */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 flex flex-col justify-between shadow-2xs">
          {activeDim ? (
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
                <p className="mt-2 text-xs italic text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/50 leading-relaxed">
                  &ldquo;{activeDim.phrase}&rdquo;
                </p>
              )}

              <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                  Nivel de Satisfacción Actual
                </span>
                <span className="text-2xl font-extrabold text-cyan-700 dark:text-cyan-400">
                  {(activeDim.score ?? activeDim.actual ?? 1)}.00{" "}
                  <span className="text-xs font-normal text-muted-foreground">/ 10</span>
                </span>
              </div>

              {activeDim.description && (
                <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground pt-2 border-t border-border/60">
                  <strong className="text-foreground">Ámbito evaluado:</strong> {activeDim.description}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-full min-h-[180px] p-4">
              <MousePointerClick className="h-8 w-8 text-cyan-500/70 mb-2 animate-pulse" />
              <h5 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Inspección de Área
              </h5>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-[220px]">
                Pasa el cursor o pulsa sobre cualquier vértice o nombre del radar para ver su análisis clínico detallado.
              </p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-3">
            <span>{activeDim ? "Área seleccionada" : "Sin selección activa"}</span>
            {activeDim && (
              <button
                type="button"
                onClick={() => {
                  setHoveredIndex(null);
                  setSelectedAreaIndex(null);
                }}
                className="text-[10px] font-semibold text-cyan-600 hover:underline cursor-pointer"
              >
                Limpiar selección
              </button>
            )}
          </div>
        </div>

        {/* Card 3: Interpretación Visual & Opciones */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Interpretación visual del gráfico
            </h4>

            <div className="mt-3.5 space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 h-3.5 w-3.5 rounded-full bg-cyan-500 flex-shrink-0 shadow-xs" />
                <span className="text-muted-foreground leading-relaxed">
                  <strong className="text-cyan-700 dark:text-cyan-400">Polígono Cian:</strong> Nivel de satisfacción actual del paciente reportado del 1 al 10.
                </span>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px] font-bold text-foreground px-1.5 py-0.5 border rounded bg-muted/60 flex-shrink-0">
                  X.00 / 10
                </span>
                <span className="leading-relaxed">
                  Puntaje numérico visible en cada uno de los 10 ejes radiales.
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" />
              <span>Ver en ventana ampliada</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal / Lightbox (React Portal to document.body) */}
      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          {/* Backdrop click dismiss */}
          <div
            className="fixed inset-0 cursor-pointer"
            onClick={() => setIsModalOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Dialog Card */}
          <div className="relative z-10 w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-6 py-4 bg-muted/40 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-500/20 p-2 text-cyan-600 dark:text-cyan-400">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                    Rueda de la Vida — Vista Ampliada en Alta Resolución
                    <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                      10 Áreas
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Gráfico interactivo de telaraña con detalle clínico por vértice.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {promedioActual !== undefined && (
                  <div className="hidden sm:block rounded-xl border border-border/80 bg-card px-3 py-1.5 text-right text-xs">
                    <span className="text-muted-foreground mr-1.5">Promedio:</span>
                    <strong className="text-foreground">{promedioActual} / 10</strong>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
                  title="Cerrar ventana (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="flex flex-col lg:flex-row items-start justify-center gap-8">
                {/* Huge Radar SVG inside modal */}
                <div className="relative mx-auto flex w-full max-w-[780px] items-center justify-center flex-1 rounded-3xl border border-border/40 bg-gradient-to-b from-muted/10 to-muted/30 p-2 sm:p-4">
                  {renderRadarSvg(true)}
                </div>

                {/* Side Inspection Panel inside modal */}
                <div className="flex w-full lg:w-[360px] flex-col justify-start space-y-4 flex-shrink-0">
                  {activeDim ? (
                    <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-5 shadow-sm">
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

                      <h4 className="mt-3 text-xl font-bold tracking-tight text-foreground">
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
                        <span className="text-3xl font-extrabold text-cyan-700 dark:text-cyan-400">
                          {(activeDim.score ?? activeDim.actual ?? 1)}.00{" "}
                          <span className="text-xs font-normal text-muted-foreground">/ 10</span>
                        </span>
                      </div>

                      {activeDim.description && (
                        <div className="mt-3 text-xs leading-relaxed text-muted-foreground pt-2 border-t border-cyan-500/20">
                          <strong className="text-foreground">Ámbito evaluado:</strong> {activeDim.description}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 min-h-[260px] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                          <Compass className="h-5 w-5" />
                          <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">
                            Balance General
                          </h4>
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                          Pasa el cursor sobre cualquier vértice o nombre del radar para ver su análisis clínico.
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
                        <span>Pasa el cursor por cualquier punto para inspeccionar.</span>
                      </div>
                    </div>
                  )}

                  {/* Legend inside modal */}
                  <div className="rounded-2xl border border-border/60 bg-card p-4 text-xs space-y-2.5 shadow-2xs">
                    <p className="font-bold text-foreground">Interpretación visual:</p>
                    <div className="grid gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="h-3.5 w-3.5 rounded-full bg-cyan-500 flex-shrink-0 shadow-xs" />
                        <span className="text-muted-foreground">
                          <strong className="text-cyan-700 dark:text-cyan-400">Polígono Cian:</strong> Satisfacción actual del paciente (1 al 10).
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 pt-1.5 border-t border-border/50 text-[11px] text-muted-foreground">
                        <span className="font-mono text-[10px] font-bold text-foreground px-1.5 py-0.5 border rounded bg-muted/60">
                          X.00 / 10
                        </span>
                        <span>Puntaje numérico visible en cada eje radial.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/80 px-6 py-3.5 bg-muted/30 flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                Presiona <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-mono bg-muted">Esc</kbd> o haz clic fuera para cerrar.
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 transition-opacity cursor-pointer"
              >
                Cerrar vista ampliada
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export { RuedaCreenciasChart as RuedaVidaChart };
