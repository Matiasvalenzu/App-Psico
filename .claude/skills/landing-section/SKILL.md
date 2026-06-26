---
name: landing-section
description: Genera una sección completa de la landing page de Psiconex (hero, features, pricing, faq, etc.) con copy enfocado en psicólogos, componentes shadcn/Aceternity/Magic UI, paleta Psiconex y dark mode. Úsala cuando el usuario pida "crear sección X" o "/landing-section X".
---

# Skill: landing-section

Genera una sección completa de la landing page **Psiconex** lista para ensamblar en `marketing/src/app/page.tsx`.

## Cuándo invocar
- Usuario escribe `/landing-section <nombre>` (ej. `hero`, `bento`, `pricing`, `faq`, `demo`, `cta`, `security`, `how-it-works`)
- Usuario pide explícitamente "crea la sección X" en el contexto del proyecto `marketing/`

## Contrato de la skill
Para CADA sección que generes debes producir:

1. **Un archivo en `marketing/src/components/sections/<nombre>.tsx`** que exporte un componente React server-side por default (`export default function <Nombre>Section()`).
2. **Imports limpios**: solo lo que se usa. Componentes shadcn desde `@/components/ui/*`, Aceternity/Magic UI desde `@/components/ui/<componente>`, iconos desde `lucide-react`, motion desde `motion/react`.
3. **Una línea de uso** que el usuario puede pegar en `page.tsx`: `<HeroSection />`.

## Reglas duras (NO negociables)

### Diseño
- **Paleta Psiconex**: usa exclusivamente CSS vars de shadcn (`bg-background`, `text-foreground`, `bg-primary`, `text-primary`, `border-border`, `bg-muted`). NUNCA colores hex hardcoded. El primary es violeta `hsl(255 80% 56%)`.
- **Dark mode obligatorio**: cada sección debe verse impecable en light y dark. No uses clases `dark:` con colores hex — usa solo CSS vars.
- **Spacing**: secciones con `py-20 md:py-28 lg:py-32`. Contenedor `mx-auto max-w-7xl px-6 lg:px-8`. Nada de paddings inconsistentes.
- **Tipografía**: headlines con `text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight`. Sub con `text-lg text-muted-foreground`. NO uses font-bold para títulos (semibold es más premium).
- **Border radius**: usa `rounded-2xl` para cards grandes, `rounded-xl` para cards medianas, `rounded-lg` para botones.
- **Sombras**: solo `shadow-sm` o sombras custom de shadcn (`shadow-elevated` si existe). Evita `shadow-2xl` que se ve barato.

### Mobile-first
- Todo debe renderizar bien desde 375px. Usa breakpoints `sm: md: lg: xl:` en ese orden.
- Grid de bento: 1 col en mobile, 2 en md, 3 o 4 en lg.
- Headlines más chicos en mobile (`text-4xl` mobile → `text-6xl` lg).

### Accesibilidad
- Semántica correcta: `<section>`, `<header>`, `<nav>`, `<h1>` solo en hero (el resto `<h2>`/`<h3>`).
- `aria-label` en secciones sin título visible. `alt` descriptivo en imágenes.
- Contraste WCAG AA: si dudas, agrega `text-foreground` en vez de `text-muted-foreground`.
- Botones con `<Button asChild><Link href="...">` cuando sean links.

### Motion (sutil, no carnaval)
- Importa de `motion/react` (no `framer-motion`).
- Anima entrada con `whileInView` + `viewport={{ once: true, margin: "-100px" }}`.
- Duración 0.4-0.6s, easing `[0.16, 1, 0.3, 1]` (ease-out-expo).
- Stagger en listas de bullets: `transition={{ delay: i * 0.08 }}`.
- NUNCA pongas más de 2 elementos animados simultáneos en viewport.

### Componentes premium permitidos
Antes de crear desde cero, INTENTA usar (vía shadcn MCP o copy-paste manual):
- **Aceternity UI**: Spotlight, Background Beams, Bento Grid, Sparkles, Glowing Effect, Text Generate Effect
- **Magic UI**: Animated Beam, Number Ticker, Marquee, Globe, Animated Grid Pattern, Border Beam
- **shadcn blocks**: Hero blocks, pricing blocks, FAQ accordion

Si el usuario no los tiene instalados, genera versión vanilla con Tailwind + motion y deja un TODO comentado: `// TODO: reemplazar con Aceternity <Componente> cuando se instale`.

## Copy: usa la skill `psiconex-copy`
Para texto de marketing dentro de la sección, NO inventes copy. Invoca primero `/psiconex-copy <feature>` y úsalo. Si la sección es estructural (FAQ, pricing) usa los tópicos definidos en `psiconex-copy`.

## Plantilla mínima (úsala como esqueleto)

```tsx
import { Button } from "@/components/ui/button"
// ... otros imports

export default function HeroSection() {
  return (
    <section
      aria-label="Presentación de Psiconex"
      className="relative overflow-hidden py-20 md:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* contenido */}
      </div>
    </section>
  )
}
```

## Después de generar
Sugiere al usuario invocar `/verify-visual` para validar el resultado en mobile y desktop antes de seguir con la siguiente sección.
