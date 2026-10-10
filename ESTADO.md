# ESTADO — Psiconex   (actualizado: 2026-10-10 por Troy)
Producción: commit ddf57cc (+ESTADO) · desplegado 2026-10-10 · app.psiconex.cl (Next 14 + Django) · landing psiconex.cl (Next 16)
Cómo correr/verificar: curl -sI https://app.psiconex.cl · ssh psiconex-vps 'docker ps --filter name=psiconex'
Rutas clave: repo /workspace/psiconex-app (box) · VPS /srv/psiconex-docker/current · docker-compose.prod.yml · .env en /srv/psiconex-docker/shared/.env (nunca imprimir)
En curso: nada
Pendiente:
1. QA landing: botón #demo sin destino; menú en /privacidad y /terminos usa #x en vez de /#x
2. Unificar correo de contacto; video hero 7,6 MB con preload=auto
3. SEO: og:image, canonical, robots.txt, sitemap.xml; cabeceras de seguridad
4. Configurar ESLint (propuesta lista)
Decisiones:
- 2026-10-09 — Psiconex se trabaja desde la box, no desde el PC — evitar aprobaciones y fallas de WSL
- 2026-10-09 — Deploy solo con pedido explícito de Matías
Problemas conocidos: SSH a GitHub bloqueado desde la box → usar remoto `vps`
- 2026-10-10 — diarización por Deepgram desplegada; DIARIZATION_BACKEND=deepgram por defecto; pyannote queda como alternativa (falta prueba en vivo y suite completa con Postgres)
- 2026-10-10 — Píxel de Meta (ID público 1067979556235866) + banner de consentimiento + evento Subscribe + is_new_user (backend) desplegados (commit 1de384d; autorizado por Matías). Falta: prueba con Pixel Helper en producción, pago real con Mercado Pago, revisión legal de /privacidad sección 8. Rollback: imágenes psiconex-{frontend,marketing,backend}:rollback-pre-metapixel
- 2026-10-10 — Tag de Google Ads (AW-18504135969, público) con consentimiento + 3 conversiones web (Registro app Web, Clic Probar gratis Web, Suscripcion pagada Web) desplegado (commit ddf57cc; autorizado por Matías; solo frontend y marketing). Falta: confirmar recepción en Google Ads, pago real, Safari/móvil; Nova pausa las 3 conversiones viejas. Rollback: imágenes psiconex-{frontend,marketing}:rollback-pre-googleads
