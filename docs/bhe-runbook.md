# Runbook · Emisión automática de boletas (BHE, usuario autorizado)

Guía para operar la emisión de boletas de honorarios que Psiconex hace en el portal del SII a nombre del psicólogo.
Psiconex entra con **su propia cuenta** (la «cuenta autorizada»), nunca con la clave del psicólogo.

Comandos de producción: en el VPS (`ssh psiconex-vps`), dentro de `/srv/psiconex-docker/current`:

```bash
dc() { docker compose -p psiconex -f docker-compose.prod.yml "$@"; }   # atajo para esta guía
```

Admin de Django: `https://app.psiconex.cl/admin/` → sección **Facturación**:

| Pantalla | Para qué |
|---|---|
| **Configuración BHE** | Pausar o reanudar la cola (una sola fila) |
| **Delegaciones SII** | Autorización de cada psicólogo: verificar, revocar, vencimiento, piloto |
| **Emisiones BHE** | Cada intento de emitir o anular: estado, folio, error, PDF y capturas, botón «Resolver» |

Ver PDF, capturas y «Resolver» exige **superusuario**.

---

## 0. Piezas y estados (lo mínimo para entender el resto)

- El psicólogo aprieta «Emitir en el SII» → se crea una **EmisionBHE** en `PENDIENTE` y se encola en la cola `bhe`.
- Un solo proceso, **worker-bhe**, la toma (`EN_CURSO`) y la emite. Solo emite si la delegación del psicólogo está vigente y la cola no está pausada.
- Estados finales: `EMITIDA` (con folio y PDF), `FALLIDA` (seguro que **no** quedó nada en el SII; el cobro vuelve a «Por emitir»), `CANCELADA` (el psicólogo la canceló mientras estaba en cola).
- **`DESCONOCIDO`**: se cortó después de enviar el formulario. **Puede que la boleta exista en el SII.** Nunca se reenvía sola (ver §3).
- Errores **antes** de enviar (portal caído, timeout): se reintenta a los 1, 5 y 15 minutos y después queda `FALLIDA`.
- Cada 10 minutos una tarea rescata emisiones que llevan más de 15 minutos en `EN_CURSO` (worker muerto): si no alcanzó a enviar, vuelven a la cola; si pudo haber enviado, pasan a `DESCONOCIDO`.
- Interruptor general: `BHE_AUTO_DISPONIBLE` en el `.env`. En `False` nadie ve la opción y el worker no emite nada.

Avisos por correo a todos los superusuarios activos: cuando el SII rechaza la clave (y la cola se pausa sola) y cuando una emisión queda en revisión manual.

---

## 1. Rotar la clave de la cuenta autorizada

La clave vive **solo** en `.env.bhe`, en el VPS, junto al compose. La lee solo `worker-bhe`; el backend nunca la tiene.

1. Pausa la cola (§2), para que nada intente entrar con la clave vieja.
2. Espera a que no queden emisiones en `EN_CURSO` (Emisiones BHE, filtro por estado).
3. Cambia la clave en el portal del SII, con la cuenta de Psiconex.
4. En el VPS, edita `.env.bhe` (variable `BHE_SII_CLAVE`) sin imprimirla en pantalla ni dejarla en el historial:
   ```bash
   nano .env.bhe
   chmod 600 .env.bhe && ls -l .env.bhe      # debe decir -rw-------
   ```
5. Recrea el worker. Un `restart` **no** relee el archivo:
   ```bash
   dc --profile bhe up -d --force-recreate worker-bhe
   dc logs --no-color --tail=30 worker-bhe   # debe quedar "ready", sin errores
   ```
6. Reanuda la cola (§2). Revisa que la siguiente emisión llegue a `EMITIDA`.

**Si el SII rechazó la clave** (correo «Emisión de boletas pausada: el SII rechazó la clave»): la cola ya quedó pausada y no se reintentó, para no bloquear la cuenta. Entra al portal a mano con la cuenta de Psiconex. Si la clave está bloqueada o vencida, desbloquéala o cámbiala y sigue desde el paso 4. Las emisiones que estaban en curso volvieron a `PENDIENTE` y salen solas al reanudar.

---

## 2. Pausar y reanudar la cola

**Pausar:** admin → Configuración BHE → marca **«pausada»**, escribe el motivo en «pausada motivo» y guarda.

Qué pasa mientras está pausada:
- El psicólogo ve «La emisión automática está pausada. Inténtalo más tarde o emite en el portal del SII.», sin botón de emitir, y los pasos para emitir a mano.
- Lo que ya estaba en cola (`PENDIENTE`) **se queda esperando**: no se emite ni se pierde.
- Lo que estaba `EN_CURSO` termina su intento (no se corta a la mitad).
- Las búsquedas automáticas de un `DESCONOCIDO` también esperan.

**Reanudar:** desmarca «pausada» y guarda. Al guardar se vuelven a encolar todas las `PENDIENTE` y las búsquedas pendientes.
Lo que está en **revisión manual no se toca**: hay que resolverlo a mano (§3).

> Antes de reanudar una cola con muchas pendientes, revisa que sigan teniendo sentido (por ejemplo, después de una pausa larga). Si el psicólogo ya emitió una a mano, pídele que la cancele desde la boleta mientras siga en cola.

**Apagado total** (más fuerte que la pausa): `BHE_AUTO_DISPONIBLE=False` en el `.env` y recrear los servicios que lo leen (`up -d` recrea solo los que cambiaron):
```bash
dc up -d && dc --profile bhe up -d worker-bhe
```

---

## 3. Resolver un DESCONOCIDO

Un `DESCONOCIDO` significa: el formulario pudo quedar enviado y **no sabemos si la boleta existe**. Reenviar a ciegas puede emitir **dos boletas por el mismo cobro**. Por eso:

- El psicólogo ve «Estamos confirmando con el SII… No la emitas a mano todavía» y no puede volver a emitir.
- Con el robot real (`BHE_BACKEND=playwright`) **no hay búsqueda automática**: queda en **revisión manual** de inmediato y avisa por correo: «Boleta por confirmar a mano (emisión #N)». (Solo el emisor de prueba `fake` simula búsquedas.)

> **Importante (T7c, 2026-10-13):** la sesión de la cuenta de Psiconex **no ve** las boletas que emite por los psicólogos: los informes anual, mensual y diario muestran solo las boletas propias de la empresa (en cero o «Sin Datos»), y «Destinatarios de últimos 30 días» y «Basarse en última boleta» salen vacíos. **No uses ningún informe de la cuenta de Psiconex para concluir que «no está».**

### Cómo confirmar

1. Admin → Emisiones BHE → abre la emisión (estado `DESCONOCIDO`). Mira «paso», «error código» y «error detalle».
2. En **Archivos** (solo superusuario) revisa, en este orden:
   - el **PDF guardado**: si existe, la boleta quedó emitida y el folio está en el PDF;
   - la captura del **paso 4** (pantalla posterior al envío): si muestra el folio o el código de la boleta, quedó emitida.
3. Si no hay PDF ni captura concluyente: **pregúntale al psicólogo**. Pídele que entre a **su propio** SII → Boletas de honorarios electrónicas → Emisor → consulta de boletas emitidas, y que te diga si aparece una boleta de esa fecha y monto, y su folio. Su sesión sí ve sus boletas; la de Psiconex no.
4. Con la respuesta, en la emisión aprieta **«Resolver»**:
   - **«Sí, quedó hecha en el SII»** + folio (+ fecha si no es la solicitada) → el cobro queda `EMITIDA` con ese folio.
   - **«No, no está en el SII»** → la emisión queda `FALLIDA` y el cobro vuelve a «Por emitir». El psicólogo puede emitir de nuevo.
5. Si no puedes confirmar ninguna de las dos cosas, **no resuelvas**. Déjala en `DESCONOCIDO` hasta tener la respuesta del psicólogo. Un «No» equivocado abre la puerta a una segunda boleta.

Tras un «Sí» con folio, el worker intenta **una vez** bajar el PDF por la consulta de terceros (ver §6): con el código si lo anotaste, si no con RUT del emisor, folio, RUT del receptor y fecha. Por eso la fecha debe ser la que imprime la boleta.

Si «Resolver» responde «Ese folio ya está registrado en otro cobro.», ese folio ya corresponde a otra boleta: revisa con el psicólogo que te haya dado el folio correcto.

### Decisión tras la T7c

No hay consulta que la cuenta autorizada pueda usar para **encontrar** una boleta sin conocer su folio. La «Consulta de boletas por terceros» (`TMBCOT_MenuConsultasTerceros.cgi`) exige sesión y pide RUT del emisor, **folio**, RUT del receptor y fecha, o el código de barras: sirve para comprobar una boleta conocida (y bajar su PDF, §6), no para buscarla. Por eso un `DESCONOCIDO` va **siempre** directo a revisión manual, **nunca** a una búsqueda o reintento automático.

---

## 4. Si el SII cambia el portal

El robot depende de las pantallas del portal. Si el SII las cambia, el robot deja de encontrar botones o campos.

**Síntomas:**
- Varias emisiones seguidas en `FALLIDA` con errores de pantalla o timeout, de distintos psicólogos.
- Emisiones en `DESCONOCIDO` sin motivo claro (el error ocurrió después de enviar).
- Correos repetidos de «Boleta por confirmar a mano».
- En los logs: `dc logs --no-color --tail=200 worker-bhe`.

**Qué hacer:**
1. **Pausa la cola** (§2) con un motivo claro («SII cambió el portal»). Los psicólogos verán el aviso y los pasos para emitir a mano.
2. Resuelve cada `DESCONOCIDO` como en §3 antes de cualquier otra cosa.
3. Mira las capturas de las emisiones fallidas (Archivos) para ver qué pantalla cambió. Entra al portal a mano con la cuenta de Psiconex y compara.
4. Avisa a los psicólogos del piloto por correo: la emisión automática está pausada y por ahora emiten en el SII como antes.
5. Pide el arreglo del robot (`facturacion/emisores/`). Antes de reanudar, prueba una emisión real controlada y su anulación.
6. Reanuda la cola y revisa las primeras emisiones una por una.

---

## 5. Revocación de la autorización

**Lo hace el psicólogo, siempre en su SII.** Psiconex no puede revocarla. La pantalla Configuración → Boletas le explica cómo: en el SII, Emisor de boleta de honorarios › **Delegar** › «Autorizar o revocar a un usuario autorizado» › **«Eliminar usuarios»** › marca a Psiconex › «Eliminar».

**El SII no le avisa a Psiconex.** Cuando el psicólogo avise que revocó (o si lo detectas porque sus emisiones fallan):
1. Admin → Delegaciones SII → su delegación → estado **«Revocada»** → guardar.
2. Desde ese momento:
   - no puede pedir emisiones nuevas; ve «Psiconex no tiene una autorización vigente…» con el enlace para revisar la autorización;
   - lo que tenía en cola termina en `FALLIDA` (`delegacion_inactiva`) sin tocar el SII; el cobro vuelve a «Por emitir» para emitirlo a mano.
3. Revisa que no le quede ningún `DESCONOCIDO` sin resolver (§3).

**Volver a autorizar:** el psicólogo repite el proceso en Configuración → Boletas. La delegación pasa a «Pendiente de verificación». Antes de marcar **«verificada»**, entra al portal con la cuenta de Psiconex → Boletas de honorarios electrónicas → Emitir → Por usuario autorizado, y confirma que su RUT y su nombre aparecen en la lista de autorizadores. Al marcarla verificada pasa a Activa. Para el piloto, además debe estar marcada **«piloto»**.

**Fecha de vencimiento:** anótala solo si el SII la muestra. Si no, déjala vacía: no hay avisos ni vencimiento automático. Con fecha, cada mañana se avisa al psicólogo a 30, 7 y 1 días, y el día del vencimiento la delegación pasa a «Vencida» (deja de emitir). Para renovar, el psicólogo vuelve a autorizar y se verifica igual que arriba.

---

## 6. Datos guardados

- **PDF de cada boleta:** en el volumen `bhe_data` (`/data/bhe`), fuera de la carpeta de medios. **No se borra** cuando el psicólogo elimina su cuenta: se conserva el plazo que defina el contador (pendiente legal). Ese volumen debe estar en el respaldo.
- **PDF que no llegó al emitir:** el robot lo baja tras el paso 4 en la misma sesión (con un reintento). Si no llega, o si la boleta se resolvió a mano con su folio (§3), el worker hace **un solo intento** más con la consulta de terceros: un login aparte, sin reintentos (`pdf_recuperacion_at` en la emisión marca que ya se intentó). No corre con la cola pausada o el flag apagado. Un rechazo de la clave pausa la cola como siempre (§1). Si falla, el log dice «no se recuperó el PDF (código)» y el psicólogo lo sube desde la ficha (se exige que sea la boleta con ese folio).
- **Capturas del portal:** se borran solas a los **90 días** (tarea diaria a las 4:40). Solo los superusuarios las ven, desde Archivos.
- El admin nunca muestra el RUT completo del psicólogo ni el payload con los datos del receptor.

---

## 7. Despliegue y activación (checklist)

Son **dos momentos con OK separados de Matías**: primero se despliega con todo apagado (A) y, después, con un OK aparte, se enciende la emisión solo para la cuenta de Matías (B). Ninguno se hace por iniciativa propia.

### A. Desplegar con los flags apagados

Se sigue el procedimiento habitual (`.agents/skills/psiconex-vps-deploy`), con estos puntos:

1. **Revisión en el VPS, solo lectura** (no se actualiza Docker): `docker compose version` debe ser **≥ 2.24** porque el compose usa `env_file` con `required: false`. Revisado el 2026-10-13: **v5.3.0**, sirve. Si alguna vez fuera menor, se cambia el compose (`env_file: [.env.bhe]` y crear el archivo vacío con `chmod 600` antes del `up`), no el Docker del VPS.
2. **Flags en el `.env` de producción** (antes de sincronizar `.env.production`, revisar solo los **nombres** de variables, nunca los valores):
   - `BHE_BACKEND` **ausente o vacío**. `fake` está prohibido: el backend no arranca. `playwright` recién en B.
   - `BHE_AUTO_DISPONIBLE` ausente o `False`.
   - `PLAN_PLUS_DISPONIBLE` ausente o `False` (hasta que el contador valide).
   - `BHE_RUT_AUTORIZADO` no se define: el compose ya trae el RUT de la cuenta de Psiconex.
   - Todavía **no** se crea `.env.bhe` en el VPS.
3. **Respaldos antes del build**, igual que en los deploys anteriores:
   - BD: `dc exec -T db pg_dump -U psicologo psicologo | gzip > /srv/psiconex-docker/backups/postgres-pre-bhe-fase2-$(date +%Y%m%d%H%M).sql.gz`, y comprobar que el archivo no pesa 0.
   - Imágenes: `for s in backend frontend celery celery-beat celery-email; do docker image tag psiconex-$s:latest psiconex-$s:rollback-pre-bhe-fase2; done`. `worker-bhe` no tiene imagen anterior: es nuevo.
4. **Migraciones nuevas**: `facturacion` 0002–0007 (agregan tablas y campos, amplían `choices` y crean la fila de Configuración BHE **pausada**; ninguna borra datos de la Fase 1). El backend las aplica al arrancar. Después, verificar con `dc exec -T backend python manage.py showmigrations facturacion` que quedaron todas aplicadas.
5. **Build y `up` sin el perfil `bhe`**: `dc up -d --build --remove-orphans`. `worker-bhe` **no** debe quedar corriendo (`dc ps` no lo lista). La imagen Playwright (`target: bhe`) solo se construye en B.
6. **Prueba de humo**:
   - la app carga, el login funciona y la ficha del paciente muestra los cobros a un usuario Plus;
   - Admin → Facturación muestra **Configuración BHE** con su única fila **pausada**, **Delegaciones SII** vacío y **Emisiones BHE** vacío;
   - un usuario Plus que intenta «Emitir en el SII» recibe «bhe_no_disponible» (no se crea ninguna emisión);
   - el borrador y «Marcar emitida» de la Fase 1 siguen funcionando igual.
7. **Rollback**: volver a etiquetar `rollback-pre-bhe-fase2` como `latest` y hacer `dc up -d`. Las tablas nuevas pueden quedar (el código anterior no las usa); el `pg_dump` del punto 3 solo se restaura si hay daño en los datos.

### B. Encender la emisión solo para la cuenta de Matías (OK aparte)

Requisitos: A desplegado y estable, el checklist legal del plan (§9) firmado, y **un OK explícito de Matías para esta etapa**. La primera boleta real desde producción la emite **Matías**, desde **su** cuenta.

1. Matías crea `.env.bhe` en el VPS **él mismo** (la clave nunca pasa por el chat ni por un commit), a partir de `.env.bhe.example`, con `chmod 600`.
2. En el `.env`: `BHE_BACKEND=playwright` y `BHE_AUTO_DISPONIBLE=True`. `dc up -d` (beat y backend leen los flags) y `dc --profile bhe up -d --build worker-bhe`.
   - El flag es global, pero solo emiten las delegaciones marcadas **piloto**. Además hay que tener Plus, y hoy nadie puede contratar Plus por su cuenta (`PLAN_PLUS_DISPONIBLE=False`).
3. Matías registra su delegación en **Configuración → Boletas** y da su consentimiento. Un superusuario la deja **verificada** y **piloto** en el admin. Ninguna otra delegación queda piloto.
4. Admin → Configuración BHE → **reanudar** la cola.
5. **Primera boleta real**: un cobro pequeño de Matías (receptor real que acepte la prueba). Se revisa el resultado en el admin (folio, código, PDF) y en el SII de Matías. Si queda `DESCONOCIDO`, **no se reintenta**: se resuelve según §3.
6. Si algo falla: **pausar** la cola (§2) y apagar el worker (`dc stop worker-bhe`). Para volver a A: `BHE_AUTO_DISPONIBLE=False` y `BHE_BACKEND` vacío.
7. Piloto: durante la primera semana Matías revisa cada boleta en su SII. Agregar otros psicólogos como piloto requiere un OK nuevo.

> La recuperación del PDF por la consulta de terceros (§6) va incluida en este despliegue; con el flag apagado no corre.
