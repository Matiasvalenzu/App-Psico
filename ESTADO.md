# ESTADO — Psiconex   (actualizado: 2026-10-09 por Master)
Producción: commit 889f4b3 · app.psiconex.cl (Next 14 + Django) · landing psiconex.cl (Next 16)
Cómo correr/verificar: curl -sI https://app.psiconex.cl · ssh psiconex-vps 'docker ps --filter name=psiconex'
Rutas clave: repo /workspace/psiconex-app (box) · VPS /srv/psiconex-docker/current · docker-compose.prod.yml · .env en /srv/psiconex-docker/shared/.env (nunca imprimir)
En curso: diarización Deepgram (rama omega/diarizacion-deepgram) · Omega · 2026-10-09
Pendiente:
1. QA landing: botón #demo sin destino; menú en /privacidad y /terminos usa #x en vez de /#x
2. Unificar correo de contacto; video hero 7,6 MB con preload=auto
3. SEO: og:image, canonical, robots.txt, sitemap.xml; cabeceras de seguridad
4. Configurar ESLint (propuesta lista)
Decisiones:
- 2026-10-09 — Psiconex se trabaja desde la box, no desde el PC — evitar aprobaciones y fallas de WSL
- 2026-10-09 — Deploy solo con pedido explícito de Matías
Problemas conocidos: SSH a GitHub bloqueado desde la box → usar remoto `vps`
