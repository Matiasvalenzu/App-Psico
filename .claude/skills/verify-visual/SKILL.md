---
name: verify-visual
description: Verifica visualmente una sección o página de la landing de Psiconex usando Chrome DevTools MCP. Levanta dev server si no está corriendo, toma screenshots en mobile (375px) y desktop (1440px), corre Lighthouse, y reporta contraste WCAG, CLS, peso de assets y heurísticas de jerarquía visual. Úsala después de generar/editar cualquier sección.
---

# Skill: verify-visual

Cierra el loop **edita → verifica → itera** sin que el usuario tenga que abrir el navegador. Es la skill que evita que las secciones "se vean bien en mi cabeza" y resulten rotas en producción.

## Cuándo invocar
- Usuario escribe `/verify-visual <ruta>` (ej. `/`, `/pricing`)
- Inmediatamente después de generar una sección con `landing-section`
- Antes de hacer commit / deploy
- Cuando el usuario reporta que "algo se ve raro"

## Prerrequisito: Chrome DevTools MCP debe estar instalado
Verifica con `claude mcp list`. Si no aparece `chrome-devtools`, instala con:
```bash
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```
Si no está disponible, fallback: usa `curl` para verificar que el server responde + reporta HTML estructural sin captura visual, y avisa al usuario que recomiendas instalar el MCP.

## Flujo

### 1. Asegurar que el dev server corre
```bash
cd marketing && (curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || (npm run dev > /tmp/marketing-dev.log 2>&1 &))
```
Espera hasta 15s a que responda 200. Si tras 15s no responde, lee `/tmp/marketing-dev.log` y reporta el error de build.

### 2. Tomar screenshots (vía Chrome DevTools MCP)
- **Mobile**: viewport 375×812 (iPhone SE/13 mini), URL `http://localhost:3000<ruta>`
- **Desktop**: viewport 1440×900 (laptop standard)
- Captura **full page**, no solo above the fold.

Guarda las imágenes en `/tmp/psiconex-verify/<timestamp>/mobile.png` y `desktop.png`.

### 3. Auditoría Lighthouse
Corre Lighthouse desktop + mobile via Chrome DevTools MCP. Objetivos mínimos:
- Performance: ≥ 90 desktop, ≥ 85 mobile
- Accessibility: ≥ 95
- Best Practices: ≥ 95
- SEO: ≥ 95

### 4. Checklist heurística (sobre los screenshots)
Reporta CADA punto con ✅ o ⚠️:

**Jerarquía visual**
- [ ] Hay UN headline dominante (no compite con otros)
- [ ] CTA primario destaca por color/tamaño sobre secundario
- [ ] Las secciones tienen separación clara (whitespace ≥ 80px entre ellas)

**Tipografía**
- [ ] Headlines en `font-semibold` (no `font-bold`)
- [ ] No hay más de 2 weights distintos en la misma sección
- [ ] Tracking apretado en títulos grandes (`tracking-tight`)

**Color y contraste**
- [ ] Texto sobre fondos respeta WCAG AA (4.5:1 cuerpo, 3:1 títulos)
- [ ] No hay colores hex hardcoded (todo via CSS vars)
- [ ] Dark mode toggleado: verificar tomando otra captura con dark

**Spacing y alineación**
- [ ] Padding consistente entre secciones (`py-20/28/32`)
- [ ] Grid alineado (no hay cards desalineadas)
- [ ] Contenedor centrado con `max-w-7xl`

**Mobile**
- [ ] Nada se sale del viewport (no scroll horizontal)
- [ ] Touch targets ≥ 44×44px
- [ ] Texto legible sin zoom (≥ 16px body)

**Motion**
- [ ] Animaciones se sienten sutiles (no carnaval)
- [ ] No hay CLS por elementos animados al cargar

**Assets**
- [ ] Imágenes con `next/image` (no `<img>`)
- [ ] Sin recursos > 200KB sin justificación
- [ ] Fuentes vía `next/font` (sin FOIT/FOUT)

### 5. Reporte final
Estructura el output así:

```
## Verificación visual: <ruta>

### Screenshots
- Mobile: /tmp/psiconex-verify/<ts>/mobile.png
- Desktop: /tmp/psiconex-verify/<ts>/desktop.png

### Lighthouse
| Métrica | Mobile | Desktop | Objetivo |
|---|---|---|---|
| Performance | X | Y | ≥85/90 |
| Accessibility | X | Y | ≥95 |
...

### Heurística (resumen)
✅ N pasa / ⚠️ M observaciones

### Issues bloqueantes
1. <issue concreta con file:line> — <propuesta de fix>
2. ...

### Issues menores (no bloqueantes)
1. ...

### Próximo paso recomendado
<una sola acción concreta>
```

## Reglas duras
- NUNCA digas "se ve bien" sin haber tomado el screenshot
- NUNCA reportes Lighthouse score sin haberlo corrido
- Si Chrome DevTools MCP no está disponible, dilo explícitamente arriba del reporte
- Si encuentras issues bloqueantes (CLS > 0.1, contraste < AA, scroll horizontal en mobile), márcalos en rojo y ofrece fix concreto, no genérico
- No edites archivos durante la verificación — solo reporta. El usuario decide qué arreglar.

## Costo y latencia
Esta skill toma ~30-60s. Si el usuario está iterando rápido, sugiérele agrupar 2-3 cambios antes de verificar, en vez de verificar tras cada edit.
