"use client"

import { cn } from "@/lib/utils"

export function HeroVideoPreview({ className }: { className?: string }) {
  return (
    <div id="demo" className={cn("scroll-mt-20 lg:h-full", className)}>
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/hero-product-demo-poster.jpg"
        aria-label="Demostración de funcionalidades de Psiconex"
        className="aspect-video w-full rounded-2xl object-cover shadow-lg shadow-primary/15 lg:aspect-auto lg:h-full"
        src="/hero-product-demo.mp4"
      />
    </div>
  )
}
