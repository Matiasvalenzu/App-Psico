"use client"

import { cn } from "@/lib/utils"

export function HeroVideoPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10",
        className
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-destructive/70" />
          <span className="h-3 w-3 rounded-full bg-warning/70" />
          <span className="h-3 w-3 rounded-full bg-success/70" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Psiconex en acción
        </div>
        <span className="text-xs font-mono text-muted-foreground">Demo</span>
      </div>

      {/* Video Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted/20">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-label="Demostración de funcionalidades de Psiconex"
          className="h-full w-full object-cover"
          src="/hero-product-demo.mp4"
        />
      </div>
    </div>
  )
}
