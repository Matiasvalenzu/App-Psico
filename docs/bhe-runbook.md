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
- Hoy el sistema hace dos búsquedas automáticas en el SII (a los 2 y a los 10 minutos). Si no la encuentra, la deja en **revisión manual** y avisa por correo: «Boleta por confirmar a mano (emisión #N)».

> **Importante (prueba real del 2026-10):** desde la sesión de la cuenta de Psiconex, los informes de boletas del SII salieron **«Sin Datos»**, aunque la boleta (folio 77) sí se emitió. Es probable que el robot **no pueda** confirmar buscando por RUT, fecha y monto. Hasta que la T7 demuestre lo contrario, cuenta con que **todo DESCONOCIDO termina en revisión manual**. **No uses el informe de la cuenta de Psiconex para concluir que «no está».**

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

Si «Resolver» responde «Ese folio ya está registrado en otro cobro.», ese folio ya corresponde a otra boleta: revisa con el psicólogo que te haya dado el folio correcto.

### Pendiente para la T7 (robot real)

En la T7 hay que revisar si existe **alguna consulta del portal que la cuenta autorizada sí pueda usar** para encontrar una boleta emitida. Si no existe, un `DESCONOCIDO` va **siempre** directo a revisión manual, **nunca** a una búsqueda o reintento automático, para no emitir dos veces. Actualizar este runbook cuando se decida.

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
- **Capturas del portal:** se borran solas a los **90 días** (tarea diaria a las 4:40). Solo los superusuarios las ven, desde Archivos.
- El admin nunca muestra el RUT completo del psicólogo ni el payload con los datos del receptor.

---

## 7. Antes del primer despliegue (checklist)

Nada de esto se hace sin el OK explícito de Matías.

1. El checklist legal del plan (§9) está firmado.
2. `docker compose version` en el VPS ≥ **2.24**. El compose usa `env_file` con `required: false`; con una versión anterior falla. Si no se puede actualizar, reemplazar por `env_file: [.env.bhe]` y crear el archivo antes del `up`.
3. Crear `.env.bhe` a partir de `.env.bhe.example`, con `BHE_SII_CLAVE`, y dejarlo con `chmod 600`.
4. En el `.env` principal (sin secretos): `BHE_AUTO_DISPONIBLE=False` y `BHE_BACKEND=playwright` **solo cuando el robot real (T7) esté listo**. `BHE_BACKEND=fake` está prohibido en producción (el backend no arranca). `BHE_RUT_AUTORIZADO` ya trae en el compose el RUT de la cuenta de Psiconex; solo se define en el `.env` si esa cuenta cambia. Si llega vacío, el robot se detiene con `sin_rut_autorizado` sin intentar el login.
5. Migrar y recrear los servicios (`dc up -d`). Beat lee `BHE_BACKEND` para programar el rescate y la purga.
6. Encender el worker a propósito: `dc --profile bhe up -d worker-bhe`. Sin `BHE_BACKEND` no hay que encenderlo.
7. Revisar que Configuración BHE esté **pausada** (es lo que trae por defecto). Reanudar solo cuando el piloto esté listo.
8. Piloto: solo delegaciones verificadas y marcadas «piloto». Matías revisa cada boleta en el SII durante la primera semana.
