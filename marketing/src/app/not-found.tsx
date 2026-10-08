import type { Metadata } from "next"
import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false },
}

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <Link
        href="/"
        aria-label="Inicio Psiconex"
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Logo />
      </Link>
      <p className="mt-10 text-sm font-semibold tracking-wide text-primary">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Página no encontrada
      </h1>
      <p className="mt-4 max-w-md text-base text-muted-foreground">
        La dirección no existe o ya no está disponible.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  )
}
