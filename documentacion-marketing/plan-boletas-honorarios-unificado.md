# Plan de boletas de honorarios electrónicas para Psiconex

**Estado:** BORRADOR unificado para decisión de Matías. No es asesoría legal ni tributaria.
**Fecha de lectura de fuentes:** 11-oct-2026 (America/Santiago).
**Fuentes base:** plan técnico de Troy (`plan-boletas-honorarios-tecnico.md`, repo `vps/main` = 69e31dc), investigación de competidores de Nova (`investigacion-competidores-boletas.md`) y lectura solo-lectura de Omega del repo local de Matías (rama `main` 68307f2, con trabajo sin commitear).

**Leyenda de verificación**
- **[HV]** hecho verificado: la fuente citada fue leída el 11-oct-2026.
- **[NV]** no verificado: inferencia, búsqueda negativa ("no lo encontré" no es "no existe") o dicho por terceros.
- **[OBS]** observado por Omega en el PC de Matías (solo nombres de archivo y estructura, lectura sin modificar nada).
- **[NV-código]** afirmación de Troy sobre el prototipo local de Matías que **no está verificada en el código de Matías** (Troy no tiene acceso a ese código; son conclusiones desde el plan técnico y la descripción de Omega).

> **Nota operativa obligatoria:** hacer `git pull` antes de editar cualquier cosa del repo. **No tocar el trabajo sin commitear** (prototipo de facturación, `backend/agenda`, frontend) sin una decisión explícita de Matías. **Antes de operar** (emitir, cobrar o anunciar algo relacionado con boletas) debe haber **revisión por un contador y/o abogado tributario**.

---

## 1. Resumen ejecutivo y recomendación

1. Hoy Psiconex **no emite boletas de honorarios** ni las prepara en producción: en `vps/main` no hay módulo de pagos, cobros ni boletas [HV Troy]. Existe un **prototipo simulado** de facturación solo en el PC de Matías, sin commitear [OBS].
2. El SII tiene un web service oficial de emisión de BHE, pero **solo para emisores masivos** (300 o más BHE al mes por contribuyente, certificación previa y Formulario 2117, Res. Ex. N°64/2021). Un psicólogo individual no califica [HV].
3. No encontré API, web service ni certificado digital del SII para BHE individual; la emisión individual oficial es el portal. Es una búsqueda negativa [NV].
4. Existe una vía oficial de delegación, el **"usuario autorizado"**: el psicólogo autoriza a un tercero con Clave Tributaria propia, por 1 año y revocable; no es una API [HV]. AgendaPro la usa [HV, según su ayuda].
5. Retención 2026: **15,25 %** (16 % en 2027, 17 % en 2028) [HV].
6. El prototipo local modela la boleta de honorarios como documento con folios CAF (tipo 69) y usa LibreDTE (sistema de DTE). Eso **no calza** con lo hallado sobre BHE [NV-código]. **No activar nada del prototipo.**
7. **Recomendación:** Fase 1 "preparar datos": registro de cobros, borrador de boleta con botones "Copiar", enlace al SII y marcar "emitida" con folio. El psicólogo emite en el SII. **Sin guardar clave tributaria, sin scraping, sin prometer certificación del SII.**
8. Fase 2: piloto de "usuario autorizado" con 3 a 5 psicólogos voluntarios (o un integrador), con revisión legal previa. Fase 3: emisión propia solo si hay demanda medida y revisión legal.
9. **No se anuncia nada de boletas hasta que funcione.** Evitar "100 % seguro" y "certificado por el SII".
10. Primero: que Matías suba el prototipo a una rama del remoto `vps` para revisión a fondo, y que un contador valide las reglas.

---

## 2. Qué sabemos del SII

### 2.1 Vías para emitir BHE y nivel de verificación

| Vía | Qué es | Aplica a Psiconex | Verificación | Fuente (leída 11-oct-2026) |
|---|---|---|---|---|
| **Portal / app del SII** | Emisión individual oficial. Autenticación con Clave Tributaria, Clave Única o Certificado Digital. El SII mantiene "una aplicación computacional" en sii.cl para emitir BHE. | Es donde el psicólogo emite en Fase 1. | HV | Res. Ex. SII N°64 (24-jun-2021), considerando 3°: https://www.sii.cl/normativa_legislacion/resoluciones/2021/reso64.pdf ; guía "Emitir BHE sin datos del receptor" (F1352, jun-2025): https://www.sii.cl/servicios_online/guia_bhe_sin_datos_del_receptor.pdf |
| **Web service oficial para emisión masiva** | Solo emisores masivos: 300 o más BHE al mes (promedio de los 6 meses anteriores). Exige certificar el sistema, Formulario 2117 (materia "Boleta de Honorarios en forma masiva"); el SII publica nómina mensual de autorizados; sanción art. 97 N°10 CT. | **No aplica**: ningún psicólogo individual llega a 300 BHE/mes. | HV (resolución). Que la autorización sea por contribuyente y que Psiconex no la "herede": inferencia razonable, NV si el SII aceptara un caso especial (habría que preguntarle). | Res. Ex. N°64/2021, resuelvos 1° a 5° (mismo PDF) |
| **API o web service para BHE individual** | No encontré documentación técnica pública. La documentación técnica del SII para webservices es de DTE (facturas, boletas de venta y servicios), no de BHE. | No existe, según lo encontrado. | NV (búsqueda negativa) | https://www.sii.cl/factura_electronica/doc_emp_aut.htm (solo extracto de búsqueda); https://www.sii.cl/factura_electronica/factura_mercado/Instructivo_Emision_Boleta_Elect.pdf (boleta electrónica de venta, no BHE; solo extracto) |
| **Usuario autorizado (delegación oficial)** | El psicólogo autoriza a otra persona con **Clave Tributaria propia** a emitir BHE a su nombre. Ruta: sii.cl > Servicios online > Boletas de honorarios electrónicas > Emisor > "Delegar emisión a un usuario autorizado" > "Autorizar o revocar a un usuario autorizado". Vigencia **1 año** desde la autorización; revocable. El autorizado **no usa la clave del contribuyente** y solo puede emitir BHE (no ve su situación tributaria). | Posible Fase 2, pero **no hay API**: el tercero opera el portal. Queda abierto si una empresa como Psiconex puede ser ese tercero y cómo se renueva cada año. | HV | FAQ 001.120.0608 (act. 26-05-2025): https://www.sii.cl/preguntas_frecuentes/boleta_honorario_electr/001_120_0608.htm ; FAQ 001.120.1040 (act. 23-04-2025): https://www.sii.cl/preguntas_frecuentes/boleta_honorario_electr/001_120_1040.htm ; FAQ 001.120.0609 (act. 11-12-2024): https://www.sii.cl/preguntas_frecuentes/boleta_honorario_electr/001_120_0609.htm |
| **Integradores / APIs de terceros** | BaseAPI, SimpleAPI, BHExpress, API Gateway, Redcumbre y otros. Dicen operar sobre el portal (automatización), con clave tributaria o certificado del psicólogo o de un usuario autorizado. Reservo usa el integrador DTemite. | Posible en Fase 2 o 3; traslada el riesgo de credenciales a un tercero y cuesta dinero. | NV (declaraciones de empresas comerciales) | https://baseapi.cl/servicios/bhe-emisor ; https://www.simpleapi.cl/Productos/SimpleBoletaHonorarios ; https://www.apigateway.cl/products/sii/bhe ; https://www.bhexpress.cl/docs/api.pdf ; https://docs.redcumbre.cl/guias/boletas-honorarios/ |
| **Aplicaciones especiales (plataformas digitales, Ley 21.431)** | Régimen especial con "Boleta de Prestación de Servicios de Terceros Electrónica (BTE)", descrito como excepción a la BHE. | No se leyó nada que diga que aplique a una agenda de psicólogos; **no se supone**. | HV (existencia del régimen); aplicabilidad NV | https://www.sii.cl/preguntas_frecuentes/boleta_honorario_electr/001_120_8262.htm ; .../001_120_8263.htm ; https://www.sii.cl/normativa_legislacion/resoluciones/2024/reso101.pdf |

### 2.2 Certificación o homologación del SII: qué aplica a qué
- **Certificación de emisor DTE** (set de pruebas, firma XMLDSIG, gestión de CAF y folios, registro como emisor electrónico, Res. Ex. N°80/2014): aplica a **DTE** (facturas, boletas electrónicas de venta y servicios). **No es el proceso de las BHE** [HV]. Fuente: https://www.sii.cl/servicios_online/1039-proceso_certificacion-1184.html. Los requisitos de postulación detallados se vieron solo por búsqueda sobre https://maullin.sii.cl/cvc/dte/pe_condiciones.html [NV].
- **Certificación para el web service de BHE masiva:** única certificación específica de BHE; solo emisores masivos [HV, Res. 64/2021].
- **Conclusión [inferencia]:** ser "emisor DTE certificado" no habilita a emitir BHE por API; las BHE de un psicólogo (2ª categoría, art. 42 N°2 LIR) son otro documento.
- **NO ENCONTRADO** por Nova: un programa de certificación o registro de software de terceros para BHE. Tampoco un pronunciamiento del SII sobre apps como Encuadrado ni una página que diga si guardar o usar la clave tributaria de un contribuyente por un tercero está permitido o prohibido [NV, búsqueda negativa].
- No se verificó si los términos de uso del SII prohíben la automatización del portal (robots o scraping) [NV]. Consultar a abogado tributario.

### 2.3 La clave tributaria
El SII declara la clave como personal; quien la comparte asume el riesgo y lo hecho con ella se presume hecho por su titular [HV]. Fuentes: https://www.sii.cl/destacados/clave_tributaria/ ; https://www.sii.cl/preguntas_frecuentes/inf_general/001_023_8674.htm ; https://www2.sii.cl/admin-cntr/noauthz/recuperar-clave-tributaria

### 2.4 Datos de una BHE
- Receptor: nombre completo, RUT y domicilio con comuna (modalidad "con datos del receptor"). La FAQ 001.120.2135 (act. 26-05-2025) describe la boleta de terceros, no la BHE del profesional: no extrapolar sin cuidado [HV con esa salvedad]. La guía de emisión BHE habla de "identificación del cliente, descripción del servicio y monto".
- Fecha, glosa o detalle de la prestación, valor, porcentaje de retención, monto retenido y total líquido [HV, FAQ 001.120.2135 y ejemplos SII]. La fecha de la boleta es la del pago, abono o puesta a disposición del honorario [HV en la boleta de terceros; confirmar en BHE propia].
- Se puede emitir **sin identificar al receptor** cuando el emisor asume el PPM: se ingresan fecha, detalle y valores (hasta 4 prestaciones por pantalla) [HV, guía F1352].
- Requisitos del emisor: inicio de actividades de 2ª categoría, actividad gravada art. 42 N°2 (o art. 48), sin anotaciones que restrinjan la emisión, y clave tributaria, Clave Única o certificado [HV]. La guía https://www.sii.cl/como_se_hace_para/boletas/guia_emitir_bhe.htm conserva un texto desactualizado de "10 %": no usarla para la tasa.

---

## 3. Estado actual del código

### 3.1 `vps/main` (commit 69e31dc, lectura de Troy) [HV]
- **No hay módulo de pagos, cobros ni boletas.** Solo: categoría de feedback "Facturación / Boletas SII" y textos de la suscripción de Psiconex (Mercado Pago, que es el cobro de Psiconex a sus usuarios, no a pacientes).
- Hay RUT del paciente validado en backend (`validar_rut`, `pacientes/documentos.py`), con dirección y comuna; y RUT del psicólogo (`rut_profesional`, DV validado, puede quedar vacío).
- **Faltan:** giro o "inicio de actividades 2ª categoría" del psicólogo; cifrado de campos (no hay cifrado de campo en la app; `cryptography` figura en `requirements.txt` pero no se usa en código de app).
- Sesiones y citas **no tienen monto ni estado de pago**.
- Migración `backend/agenda/migrations/0005_agendacita_boleta_emitida_agendacita_boleta_folio_and_more.py` (commit a3057f8, 02-sep-2026): en `vps/main` tiene `operations = []`; los campos `boleta_emitida` y `boleta_folio` no existen en el modelo.
- Documento interno `Informes/informe-brechas-y-oportunidades-app-psicologos.md` §5.14: no se observó módulo de pagos; Lina registra pagos y boletas a mano.

### 3.2 Prototipo local de Matías (sin commitear, rama `main` 68307f2) [OBS]
Omega lo leyó en modo solo lectura. **Nada de esto está en `vps/main`.**

| Parte | Contenido observado [OBS] |
|---|---|
| `backend/facturacion/models` | `SIICredential` (`rut_emisor`, `delegacion_activa`, `fecha_vencimiento`); `FolioCAF` (tipos 33/69/39, XML CAF cifrado con Fernet); `DocumentoTributario` (estado PENDIENTE/ENVIADO/ACEPTADO/RECHAZADO, `track_id`, `xml`, `pdf_url`) |
| `backend/facturacion/` | `api/views`, `serializers`, `urls`; migraciones 0001 a 0003; `services/libredte_client.py` y `services/libredte_mock.py` |
| `backend/agenda/services/sii_integration.py` | `SIIService` simulado: `register_emitter` y `emit_boleta` devuelven token, folio y PDF falsos |
| `docker/libredte/index.php` | Servicio LibreDTE |
| Frontend | `dashboard/facturacion/` (`page.tsx`, `BoletaHistoryTable`, `EmitirBoletaModal`, `SIISettingsCard`) y `dashboard/configuracion/sii/page.tsx` |
| Cambios sin commitear en `backend/agenda` | admin, models, urls, views y migración 0005 con campos de boleta emitida y folio; además `frontend/.../reservar/[slug]/page.tsx` |
| Documento de contexto | `Reuniones/plan_evaluacion_encuadrado.md` (evaluación de ideas de Encuadrado; boletas en Fase 4; contexto CAF/Arzobispado) |

Es un prototipo **simulado**: emite datos falsos.

### 3.3 Incoherencias a señalar
Todas **por verificar**; las de los puntos A y B vienen de Omega [OBS] y las de C a E son análisis de Troy: **[NV-código]**, no verificadas en el código de Matías.

- **A. [OBS] `libredte_client.py` aún referencia `credential.clave_sii` y `certificado_p12`, que la migración 0002 eliminó.** Si es así, el código está desfasado y fallaría al activarse.
- **B. [OBS] El modelo trata la boleta de honorarios (tipo 69) como documento con folios CAF.** Eso no calza con lo hallado: las BHE se emiten en el portal del SII, y el web service es solo para emisores masivos; la delegación es "usuario autorizado".
- **C. [NV-código] CAF y firma con certificado digital pertenecen al sistema de DTE** (facturas, boletas de venta y servicios, notas de crédito). La boleta de honorarios se emite en el portal del SII y no usa folios CAF, así que modelarla como CAF tipo 69 no calza. **No se confirmó qué código de documento le corresponde.**
- **D. [NV-código] LibreDTE sirve a ese otro régimen (DTE).** Un psicólogo que emite boletas de honorarios normalmente no es emisor de ese sistema. Pasarlo a DTE implicaría otra situación tributaria, que **debe confirmar un contador**.
- **E. [NV-código] Si la migración 0002 quitó `clave_sii` y P12 y el cliente LibreDTE aún los usa, el código está desfasado** (misma observación que A, desde el lado del análisis).
- **F. Migración 0005 de agenda:** en `vps/main` está vacía; localmente (sin commitear) trae campos de boleta emitida y folio [OBS]. Si en alguna base ya se aplicó una versión distinta, hay riesgo de divergencia: no reutilizar el nombre ni el número sin revisar (por verificar).
- **G. Commits distintos:** Troy leyó `vps/main` = 69e31dc; el repo local está en `main` 68307f2. Hay que hacer `git pull` y reconciliar antes de diseñar.

### 3.4 Qué reutilizar y qué descartar
**Recomendación de Troy [NV-código]: no activar nada del prototipo; la Fase 1 solo prepara datos.**

| Elemento | Decisión propuesta | Motivo |
|---|---|---|
| `delegacion_activa` y `fecha_vencimiento` (SIICredential) | **Reutilizar** (concepto) | Calzan con "usuario autorizado" (vigencia 1 año, revocable). Solo útiles en Fase 2; en Fase 1 no se necesitan. |
| Campos de boleta en `agenda` (emitida, folio) | **Reutilizar** (idea) | Equivalen a `estado_boleta` y `boleta_folio` del modelo de Cobro propuesto. Reconciliar con la migración 0005 de `vps/main`. |
| UI `dashboard/facturacion` (tabla de historial, tarjeta de ajustes) | **Reutilizar como base visual** tras revisión | Útil para "Boletas pendientes" y borrador con "Copiar"; `EmitirBoletaModal` hoy simula emisión y habría que reemplazarlo. |
| `FolioCAF`, XML CAF con Fernet, tipos 33/69/39 | **Descartar para BHE** | CAF es del sistema DTE; no aplica a BHE. |
| `DocumentoTributario` con `track_id`, XML | **Descartar para BHE** (revisar si se quiere conservar para DTE futuro) | Modelo de DTE. |
| `libredte_client.py`, `libredte_mock.py`, `docker/libredte` | **No activar / descartar** | Régimen DTE; cliente desfasado respecto de la migración 0002. |
| `SIIService` mock (`sii_integration.py`) | **Descartar** | Devuelve token, folio y PDF falsos; riesgo de que alguien lo confunda con emisión real. |
| `clave_sii` y `certificado_p12` | **No volver a introducir** | Regla: no guardar clave tributaria ni certificado. |

**Pendiente:** revisión a fondo del prototipo por Troy. Matías debe subirlo a una **rama del remoto `vps`** (ver sección 9).

---

## 4. Opciones, pros, contras y riesgos

| Opción | Descripción | Pros | Contras | Riesgos legales y de seguridad |
|---|---|---|---|---|
| **1. Preparar datos + enlace al SII (sin credenciales)** | Psiconex registra cobro, calcula retención, arma el borrador (receptor, glosa, monto, modo) con botón "Copiar" por campo; el psicólogo emite en el SII y vuelve a marcar "emitida" con folio (y opcionalmente sube el PDF). | Riesgo mínimo; costo bajo; evita errores de cálculo y boletas olvidadas; sin custodia de credenciales. | Quedan pasos manuales; es más modesto que lo que ofrecen Encuadrado y AgendaPro. | Mínimos. Psiconex calcula pero no asesora: aviso "revisa con tu contador". |
| **2. Asistente con copiado y prellenado** | Opción 1 más CSV, guía paso a paso con capturas, plantilla de glosa, recordatorios (plazo de anulación, F29/PPM como resumen informativo). Posible extensión de navegador que rellene el formulario del SII en el navegador del propio psicólogo. | Más valor sin tocar credenciales. | La extensión depende de la estructura del portal y de sus términos. | Extensión [NV]: viable técnicamente pero no verificada; evaluar después de Fase 1. |
| **3a. Robot con clave tributaria del psicólogo** | Psiconex guarda la clave. | Experiencia "un clic". | Custodia de un acceso con efectos tributarios. | **No recomendado.** Sin cifrado de campo ni KMS hoy; el SII dice que lo hecho con la clave se presume hecho por su titular. |
| **3b. Psiconex como "usuario autorizado" + robot** | El psicólogo autoriza el RUT de Psiconex (1 año, revocable, sin entregar su clave); un robot con la clave **de Psiconex** opera el portal. | No guarda claves de psicólogos; camino que usa AgendaPro. | Sin API oficial: scraping frágil; renovación anual por psicólogo; la autorización puede romperse si el psicólogo cambia datos en el SII (según Encuadrado, NV); necesita RUT con clave tributaria propia. | **Llave maestra:** la clave de Psiconex tendría permiso sobre todos los psicólogos que autoricen; un incidente implica emitir en nombre de muchos. Términos de uso del SII sobre automatización: NV. Responsabilidad por errores tributarios. **No empezar por aquí.** |
| **4. Integrador de pago** | (a) APIs tipo BaseAPI/SimpleAPI; (b) proveedor de boletas/DTE (p. ej. DTemite que usa Reservo; Sovos que usa Encuadrado para DTE; para BHE no se sabe qué usan, NV). | Traslada el mantenimiento del robot. | Cuesta dinero (Matías quiere evitarlo); a menudo piden clave o certificado del psicólogo, es decir más terceros con credenciales. | Delegar custodia de credenciales a un tercero; requiere revisión legal y de datos personales. |
| **5. Vía oficial masiva** | Web service de BHE masivo. | n/a | No aplica (300 o más BHE/mes por contribuyente + certificación). | Solo por completitud. |

**Riesgos transversales**
1. **Credenciales SII:** guardar clave convierte a Psiconex en custodio de un acceso con efectos tributarios y de datos personales. Si algún día se hiciera: cifrado de campo, KMS o secret manager, auditoría, revocación, consentimiento expreso y revisión legal. Encuadrado publicó un aviso de privacidad específico para esto (v1, 31-ago-2026).
2. **No prometer certificación:** no existe, según lo encontrado, un programa de certificación del SII para software de BHE de terceros. No decir "certificado por el SII", "oficial del SII" ni "aprobado por el SII".
3. **Responsabilidad tributaria:** la tasa cambia cada año; un error de PPM lo asume el psicólogo ante el SII. Psiconex no asesora.
4. **Datos personales:** RUT, nombre, monto y glosa de un paciente de psicología es dato personal y la glosa puede revelar atención de salud mental. Ley 19.628 vigente; la Ley 21.719 (datos de salud = sensibles) entra en vigencia el **1-dic-2026** según artículos leídos (https://araya.cl/ley-de-proteccion-de-datos-se-postergara-su-entrada-en-vigencia/); NV si se posterga. Hay una contradicción detectada en la cláusula de consentimiento sobre terceros (`verificacion-recomendaciones-2.md`): no agregar flujos hacia terceros sin actualizarla.
5. **Minimización:** el módulo de boletas no toca ficha clínica, notas ni transcripciones; la glosa por defecto es genérica ("Atención psicológica" o la que defina el psicólogo). Nunca copiar datos clínicos a la glosa.
6. **Retención y respaldo:** los cobros y PDFs se respaldan junto a `/data`. Los documentos tributarios se conservan 6 años según Encuadrado (su política, NV como regla general); definir retención propia con abogado. Hoy el repo deja audios huérfanos al borrar pacientes: no repetir ese patrón con PDFs.
7. **Eliminación de pacientes:** `Cobro.paciente` con `SET_NULL` y snapshot del receptor para no perder el respaldo tributario.
8. **Menores y extranjeros:** el receptor puede ser el tutor; sin RUT, evaluar "sin datos del receptor" (existe esa opción cuando el emisor asume el PPM).
9. **Cuenta de Psiconex:** si fuera "usuario autorizado" necesita RUT propio con clave tributaria (¿persona natural de Matías o sociedad?).

---

## 5. Plan por fases

### Fase 0 (1 a 2 días, sin código)
- Reconciliar repos: `git pull`, subir el prototipo a una rama del remoto `vps` y que Troy lo revise a fondo.
- Con un contador: (a) si, con pacientes personas naturales, el emisor paga PPM; (b) qué glosa necesitan las Isapres para reembolso; (c) pacientes sin RUT (extranjeros) y menores; (d) si el enfoque del prototipo (DTE/LibreDTE) tiene algún sentido para alguien.
- **Criterio de salida:** decisión de Matías sobre las preguntas abiertas críticas y sobre el destino del prototipo.

### Fase 1: preparar datos y que el psicólogo emita
**Modelo de datos mínimo** (todos con FK `psicologo`; montos en CLP enteros).

`cuentas.PerfilPsicologo` (agregar): `bhe_modo_default` (EMISOR_PPM | RECEPTOR_RETIENE), `bhe_glosa_default` (texto corto, validado sin datos clínicos), `bhe_inicio_actividades_confirmado` (bool, autodeclarado). `rut_profesional` ya existe; exigir que no esté vacío para habilitar el módulo.

`facturacion.Cobro` (app nueva o reescrita; ver 3.4):
- `psicologo` FK, `paciente` FK (SET_NULL), `sesion` FK null, `agenda_cita` FK null.
- `fecha_pago` (date, fecha de la boleta), `monto_bruto` (int), `medio_pago` (efectivo/transferencia/otro), `estado_pago` (PENDIENTE/PAGADO).
- Snapshot del receptor: `receptor_tipo_doc`, `receptor_rut`, `receptor_nombre`, `receptor_direccion`, `receptor_comuna`, `receptor_email` (copiados del paciente, editables; el receptor puede ser el tutor).
- `glosa`, `bhe_modo` (EMISOR_PPM | RECEPTOR_RETIENE | SIN_DATOS_RECEPTOR).
- `tasa_retencion` (decimal, snapshot: 15,25 en 2026), `monto_retencion`, `monto_liquido` (calculados; redondeo al peso más cercano, regla oficial NV).
- `estado_boleta` (PENDIENTE | PREPARADA | EMITIDA | ANULADA | NO_APLICA), `boleta_folio` (str), `boleta_fecha_emision`, `boleta_anulada_at`, `boleta_pdf` (opcional), `notas`, timestamps.

**Tasas:** constante o tabla versionada `TASA_RETENCION_BHE = {2026: 15.25, 2027: 16.0, 2028: 17.0}`, según el año de `fecha_pago`; revisar cada diciembre.

> **Pendiente de mantención:** la tabla implementada en `backend/facturacion/services.py` llega solo hasta 2028. La ley fija 17 % desde 2028 en adelante, pero hay que agregar 2029 (y siguientes) **antes del 1-ene-2029**; sin la fila del año, registrar un cobro falla con un error de validación.
**Regla:** no guardar clave tributaria, certificado ni Clave Única.

**Endpoints (DRF, bajo `/api/facturacion/`)**
- `GET/POST /cobros/` y `GET/PATCH/DELETE /cobros/{id}/` (filtros: `estado_boleta`, `paciente`, `desde`, `hasta`).
- `POST /cobros/{id}/preparar-boleta/`: calcula retención y líquido; devuelve el borrador (campos para copiar y `url_sii` a `https://www.sii.cl/servicios_online/` con la ruta de menú en texto; no enlazar rutas internas del portal).
- `POST /cobros/{id}/marcar-emitida/` (`boleta_folio`, `fecha_emision`, `pdf` opcional) y `POST /cobros/{id}/marcar-anulada/`.
- `GET /resumen/?mes=YYYY-MM`: bruto, PPM sugerido, pendientes (informativo; no sustituye al F29).
- `GET /cobros/exportar.csv`.
- Permisos y filtrado por `request.user`, como `PacienteViewSet`. Validaciones: RUT con `validar_rut`, monto > 0, glosa sin palabras clínicas básicas, tasa por año.

**Frontend:** pestaña "Cobros" en la ficha del paciente, vista "Boletas pendientes", tarjeta de borrador con botones "Copiar", aviso "revisa con tu contador".

**Tareas**
1. Decidir destino del prototipo y de la migración 0005 de agenda.
2. Modelo, migraciones, serializers y endpoints de `Cobro` con tests de cálculo (usar los ejemplos oficiales del SII, sección 6).
3. UI de cobros, borrador y marcado de emitida/anulada.
4. Texto de ayuda y aviso legal revisado por contador/abogado.
5. Recordatorio del plazo de anulación fácil (día 10 del mes siguiente).

**Criterios de salida de Fase 1:** un psicólogo puede registrar un cobro, ver el borrador con retención calculada, emitir en el SII y marcar el folio; cero credenciales guardadas; cálculo coincide con los ejemplos oficiales; contador validó reglas y glosa; datos aislados por usuario; no se menciona nada en la landing.

### Fase 2: resumen y piloto de usuario autorizado (o integrador)
- **2a (ayuda):** resumen mensual (bruto, PPM sugerido, líquido), recordatorios, importación manual de PDF y folio.
- **2b (piloto):** medir cuántas boletas emiten los usuarios. Si hay demanda, piloto de "usuario autorizado" con **3 a 5 psicólogos voluntarios**, con revisión legal y plan de contingencia (renovación anual, revocación, qué ve el psicólogo al vencer), **o** contratar un integrador. Nunca guardar la clave del psicólogo.
- **Tareas del piloto:** definir RUT y titular de la cuenta autorizada; consentimiento por escrito; registro de autorizaciones con `delegacion_activa` y `fecha_vencimiento` (reutilizados); alertas de vencimiento; revisión de términos del SII sobre automatización.
- **Criterios de salida:** el piloto emite sin incidentes de seguridad; revisión legal favorable; renovación probada; los voluntarios aprueban continuar; costo y mantenimiento aceptables.
- Con permiso escrito de los voluntarios, el piloto puede dar las primeras citas reales para la landing (hoy no hay testimonios reales).

### Fase 3: emisión propia, solo si procede
- Evaluar emisión propia (opción 3b a escala) o integrador definitivo según datos, costo y riesgo.
- Prerrequisitos: cifrado de campo + KMS/secret manager, auditoría, política de retención, aviso de privacidad específico, revisión legal, plan de contingencia ante cambios del portal.
- Criterios de salida: revisión legal y de seguridad aprobadas; plan de soporte; decisión explícita de Matías.

---

## 6. Retención 2026 a 2028 y anulaciones (según el plan de Troy)

**Retención / PPM**
- **2026: 15,25 % sobre el monto bruto** desde 01-01-2026 (14,5 % en 2025) [HV]: https://www.sii.cl/preguntas_frecuentes/declaracion_renta/001_140_8398.htm (act. 03-08-2026); https://www.sii.cl/noticias/2025/261225noti01smn.htm (Ley 21.133). **2027: 16 %. 2028: 17 %.**
- Dos alternativas al emitir: (1) el receptor retiene (agente retenedor: empresa o persona jurídica, instituciones, primera categoría con contabilidad); (2) el emisor paga el PPM en el **Formulario 29** [HV]: https://www.sii.cl/preguntas_frecuentes/boleta_honorario_electr/001_120_0889.htm . Para pacientes personas naturales lo habitual sería la opción 2 [NV: es inferencia; confirmar con contador].
- Ejemplos oficiales de redondeo [HV]: 555.555 × 15,25 % → retención 84.722, total boleta 470.833; 250.000 → 38.125 / 211.875; PPM sobre 150.000 → 22.875. Fuente: https://www.sii.cl/destacados/boletas_honorarios/ejemplos_bh.html . La regla exacta de redondeo es NV.
- Qué cifras muestra el documento cuando el emisor asume el PPM (si el total de la boleta es el bruto): NV. **Psiconex no debe prometer "monto líquido" sin confirmarlo.**

**Anulación** [HV]
- Hasta el **día 10 del mes siguiente** a la fecha de la boleta: anulación inmediata en el portal; se avisa al receptor por email.
- Entre el **día 11 y el 1° de marzo** del año siguiente: queda "vigente con solicitud de anulación pendiente" y requiere **confirmación del receptor con su clave**; si no confirma, pasa a vigente y siguen debiéndose PPM o retención.
- Después del 1° de marzo: petición administrativa con **Formulario 2117**.
- Fuentes: https://www.sii.cl/preguntas_frecuentes/boleta_honorario_electr/001_120_1838.htm ; .../001_120_3083.htm ; .../001_120_6019.htm ; .../001_120_3085.htm ; https://www.sii.cl/servicios_online/guia_anular_bhe.pdf
- **Implicación:** Psiconex guarda el estado "anulada", la fecha límite de anulación fácil y avisa al psicólogo.

---

## 7. Competencia, precios y posicionamiento

Investigación de Nova, 11-oct-2026, solo lectura. Lo atribuido a una URL es lo que esa página declara; no es verificación de cómo operan en la práctica.

| | Encuadrado | AgendaPro | Reservo | BHExpress |
|---|---|---|---|---|
| Qué hace | Emite la BHE al recibir el pago o con un clic ("Boletas automáticas"), a nombre del profesional | Emite al registrar un pago; previsualiza o emite automático; desde el RUT del profesional | Emite al pagar la cita; integración con DTemite | Emite, guarda y anula en el SII (web, masivo, API); servicio de boletas, no agenda clínica |
| Mecanismo SII (según ellos) | Ayuda: "autorizar a Encuadrado como emisor directo"; clave tributaria o Clave Única | Usuario autorizado: RUT 76.233.336-8 (Gunei Investment SpA) | DTemite; clave tributaria; certificado .pfx para boleta de empresa; ~2 semanas de trámite ante el SII | "Directo en el sitio web del SII utilizando la clave tributaria del emisor"; la almacena (según sus términos) |
| Precio (declarado) | Plan Profesional $43.511 (1 UF + IVA/mes) incluye boletas; Esencial $26.107 (0,6 UF + IVA) no; Avanzado $141.218 (3 UF + IVA) | Add-on desde 1 UF + IVA/mes por RUT; planes base desde $15.900/mes | Incluida en Plan Individual (precio del plan no leído); RUT adicional de honorarios 10.000 + IVA/mes; boleta de empresa $20.000 + IVA/mes por RUT adicional (texto de 2023) | Alfa $20.000/mes + IVA (hasta 500 boletas); Beta $40.000; Gamma $80.000 |
| Fuente | https://www.encuadrado.com/funcionalidades/boletas ; https://www.encuadrado.com/ | https://agendapro.com/cl/boleta-honorarios ; https://agendapro.com/cl/planes | https://intercom.help/reservo/es/articles/5676628-boleta-de-honorarios-electronica-bhe ; .../8117373-integracion-de-boleta-electronica-dtemite-chile | https://www.bhexpress.cl/ |

**Hallazgos clave**
- **Contradicción en Encuadrado:** su web comercial dice "es 100% seguro, ya que no operaremos con tu clave"; su guía de ayuda (17-jun-2026) pide clave tributaria o Clave Única; y su Aviso de Privacidad de Facturación SII (v1, 31-ago-2026, https://encuadrado.com/privacidad/sii/aviso-de-privacidad) dice que emite "con la clave tributaria del profesional" y que la almacena con cifrado en reposo y a nivel de campo. Cómo opera en la práctica: no se sabe (no se probó la plataforma).
- **Encuadrado es el competidor más cercano:** tiene transcriptor con IA, ficha clínica y, según su home, certificación CENS y de telemedicina FONASA. Psiconex no se diferencia solo por "IA".
- AgendaPro aclara que no da asesoría contable o tributaria y que se puede seguir usando el SII gratis.
- API Gateway afirma ser "una pasarela para interactuar con el sitio web del SII", no relacionada con el SII (afirmación de ellos).
- **No cubierto:** Calenda (error 500), Doctoralia/Docplanner Chile, Bsale, Facto, Cliniko y Nubox (sin datos de BHE); respuestas de FAQ de AgendaPro y página de precios de Reservo no leídas.

**Posicionamiento**
- El mercado dice "ahorra tiempo" y "reembolso Isapre"; nadie lo une a **privacidad clínica**. El hueco: claridad sobre qué permiso se le da a Psiconex y cómo se revoca, y profundidad clínica (informe, evolución, apoyo entre sesiones).
- Psiconex no debe competir en "agenda + cobro + boleta".

**Mensajes permitidos según fase** (condición: el mensaje debe coincidir con lo que hace el sistema)

| Escenario | Mensaje posible | Condición |
|---|---|---|
| Hoy (sin boleta) | "Tu sesión, tu ficha y tu informe en un solo lugar. Tú revisas, tú firmas." No hablar de boletas. | Ninguna nueva. |
| Fase 1 (preparar datos) | "Prepara tu boleta con los datos de la sesión, y tú la emites en el SII. No pedimos tu clave." | La función existe y de verdad no pide ni guarda la clave; texto revisado por alguien que conozca el flujo del SII. No presentarlo como equivalente a quienes emiten por el psicólogo. |
| Fase 2 (usuario autorizado) | "Autorizas a Psiconex desde tu cuenta del SII y puedes revocarlo cuando quieras." | Implementado, con RUT y clave tributaria propios de Psiconex, y revisión legal. |
| Integrador | Nombrar al integrador y decir que guarda la clave si es así. | Solo si se elige; va contra el deseo de no pagar servicios externos. |
| Cualquiera | Explicación breve y honesta de qué permiso se da y cómo se revoca. | Coincide con lo que hace el sistema. |

**Regla:** no se anuncia nada de boletas (landing, redes, anuncios) hasta que funcione. **Evitar:** "100 % seguro", "certificado/aprobado por el SII", "boleta automática" mientras no exista, "igual que Encuadrado" y mencionar a competidores por nombre en el copy.

---

## 8. Preguntas abiertas para Matías
Unificadas: 10 de Troy (T) y 8 de Nova (N), sin duplicar.

**Prototipo y código**
1. ¿Qué es y para qué se hizo el prototipo local de facturación (`backend/facturacion`, LibreDTE, CAF, SII mock)? ¿Qué fue el intento `boleta_emitida` / `boleta_folio` de la migración 0005 de agenda? ¿Se aplicó en alguna base? (T1)
2. ¿Subes el prototipo a una rama del remoto `vps` para que Troy lo revise, y decides qué se descarta? (nuevo)

**Alcance y negocio**
3. ¿Los pacientes de Lina y de los demás psicólogos son siempre personas naturales (el emisor paga PPM), o hay empresas, convenios, Isapre/Fonasa o colegios (el receptor retiene)? (T2 + N6)
4. ¿Qué glosa exigen las Isapres para reembolso? ¿Puede decir "psicoterapia" o debe ser genérica? (T3)
5. ¿Cuántas boletas al mes emite un psicólogo típico? Define si vale la pena automatizar. (T4)
6. ¿Aceptas empezar con la Fase 1 (sin automatizar) aunque no sea "un clic"? (T6)
7. ¿Registrará Psiconex también los pagos (transferencias) o solo prepara la boleta? (T9)
8. ¿Se cobrará por esta función (como AgendaPro, ~1 UF por RUT, o incluida, como Encuadrado en su plan Profesional) o va incluida? Hoy el documento de planes no menciona facturación. (T8 + N7)

**Usuario autorizado, credenciales y SII**
9. ¿Psiconex tendría un RUT con Clave Tributaria propia (persona natural o sociedad) para ser "usuario autorizado"? ¿Aceptas el riesgo concentrado? ¿El esquema es aplicable a una empresa como Psiconex? (T5 + N2)
10. ¿Cómo se manejaría la renovación anual de la autorización de cada psicólogo y qué ve el psicólogo cuando vence? (N3)
11. ¿Existe un pronunciamiento o canal del SII sobre software de terceros que emite BHE con credenciales? No lo encontramos; preguntar al SII o a un abogado. (N4)
12. Si alguna vez se guardara una clave de tercero, ¿qué dice o diría la política de datos de Psiconex y cómo se cifraría? (N5)

**Legal y datos**
13. ¿Quién valida con un contador o abogado tributario las reglas de PPM, retención y glosa? (T7)
14. Retención de PDFs y datos de cobro: ¿cuánto tiempo y quién los elimina al cancelar la cuenta? (T10)

**Investigación pendiente (no es decisión de Matías)**
15. ¿Cómo opera Encuadrado realmente con la clave (web vs ayuda vs aviso de privacidad)? No se puede saber sin probar la plataforma. (N1)
16. Competidores sin cubrir: Doctoralia Chile, Calenda, Bsale, Facto, Cliniko, si interesan. (N8)

---

## 9. Próximos pasos y responsables

| # | Paso | Responsable |
|---|---|---|
| 1 | `git pull` en el repo local antes de editar; **no tocar el trabajo sin commitear** sin decisión de Matías | Matías (y cualquier agente que edite) |
| 2 | **Subir el prototipo a una rama del remoto `vps`** (sin `.env` ni secretos) para revisión a fondo | Matías |
| 3 | Revisar a fondo el prototipo: confirmar incoherencias (libredte_client vs migración 0002; tipo 69/CAF), qué se reutiliza o descarta, y reconciliar la migración 0005 de agenda | Troy |
| 4 | Responder las preguntas abiertas críticas (3, 6, 8, 9 y 13 de la sección 8) y decidir Fase 1 | Matías |
| 5 | Consultar a un contador o abogado tributario: PPM/retención con pacientes personas naturales, glosa para Isapre, extranjeros y menores, uso de usuario autorizado por una empresa, términos del SII sobre automatización, y si el enfoque DTE/LibreDTE tiene sentido para algún caso | Matías (contratar) con apoyo de Troy y Omega para preparar las preguntas |
| 6 | Diseñar e implementar Fase 1 (modelo `Cobro`, endpoints, UI de borrador) tras los pasos 2 a 5; despliegue solo con confirmación explícita de Matías | Troy coordina; OpenCode implementa |
| 7 | Cambios en la landing o contenido: ninguno hasta que funcione; preparar mensajes por fase para cuando corresponda; coordinar piloto y permiso escrito para testimonios | Nova |
| 8 | Mantener este documento unificado y copiarlo a `Herramienta-Psicologo/documentacion-marketing/` | Omega |
| 9 | Definir y reclutar 3 a 5 psicólogos voluntarios para el piloto (Fase 2), solo con revisión legal previa | Matías con Nova |

---

## Anexo: fuentes leídas el 11-oct-2026
- **SII:** reso64.pdf; FAQ 001_140_8398 (retención 2026); noticia 261225noti01smn; FAQ 001_120_0608, 0609, 1040, 1767 (usuario autorizado); 001_120_0889 (PPM/retención); 001_120_1838, 3083, 3085, 6019 y guia_anular_bhe.pdf (anulación); 001_120_2135; 001_120_8262 y 8263; reso101.pdf; guia_emitir_bhe.htm; guia_bhe_sin_datos_del_receptor.pdf; ejemplos_bh.html; clave_tributaria; 001_023_8674; recuperar-clave-tributaria; 1039-proceso_certificacion-1184.html; Instructivo_Emision_Boleta_Elect.pdf y doc_emp_aut.htm (solo extractos de búsqueda); faqs_boleta_honorario_electr.htm.
- **Mercado:** Encuadrado (artículos de ayuda, página de boletas, precios, aviso de privacidad SII); AgendaPro (manual 21-jul-2026, planes); Reservo (20-jul-2023; DTemite 08-sep-2025); BHExpress; BaseAPI; SimpleAPI; API Gateway; Redcumbre; Sovos y TPC (secundarias, contexto de Res. 64).
- **Repo local de Matías [OBS]:** estructura de `backend/facturacion/`, `backend/agenda/services/sii_integration.py`, `docker/libredte/`, `frontend/src/app/dashboard/facturacion/`, `dashboard/configuracion/sii/`, `Reuniones/plan_evaluacion_encuadrado.md`; solo nombres y estructura, sin modificar nada.
