import type { Metadata } from "next"
import Link from "next/link"

import { ConsentPreferences } from "@/components/analytics/consent-preferences"
import { Footer } from "@/components/layout/footer"
import { ProvidersTable } from "@/components/sections/providers-table"
import { Logo } from "@/components/brand/logo"
import { BASE_OPEN_GRAPH } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Política de privacidad y tratamiento de datos de Psiconex.",
  alternates: { canonical: "/privacidad" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    url: "/privacidad",
    title: "Política de privacidad | Psiconex",
    description: "Política de privacidad y tratamiento de datos de Psiconex.",
  },
}

export default function PrivacyPage() {
  return (
    <>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6 lg:px-8">
          <Link href="/" aria-label="Inicio Psiconex" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-16 lg:px-8 lg:py-24">
          <p className="text-sm font-medium text-primary">Información legal</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Política de privacidad</h1>
          <p className="mt-5 text-sm text-muted-foreground">Última actualización: 11 de octubre de 2026</p>

          <div className="mt-12 space-y-10 text-base leading-7 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground">1. Responsable del tratamiento</h2>
              <p className="mt-3">
                Psiconex es operado por Sociedad de Profesionales Informática y Tecnología Limitada, RUT 77.781.977-1, con domicilio en Martín de Zamora 5375, Las Condes, Santiago de Chile. Para consultas sobre esta política o el tratamiento de datos, escríbenos a{" "}
                <a className="text-primary underline underline-offset-4" href="mailto:matias@datnexia.com">matias@datnexia.com</a>.
              </p>
            </section>

            {/* TODO(revisión legal): secciones 2, 4, 6 y 7 actualizadas el 11-10-2026 para reflejar la app (audio efímero, proveedores, exportación, eliminación, cifrado). Revisar con abogado antes de publicar. */}
            <section>
              <h2 className="text-xl font-semibold text-foreground">2. Datos que tratamos</h2>
              <p className="mt-3">
                Tratamos los datos necesarios para crear y administrar la cuenta, prestar las funciones contratadas y brindar soporte. Esto puede incluir datos de identificación y contacto del profesional, datos de agenda, fichas y notas clínicas, audios, transcripciones, documentos, resultados de evaluaciones y perfiles de voz que el usuario incorpore voluntariamente a la plataforma.
              </p>
              <p className="mt-3">
                El audio de las sesiones se usa solo para generar la transcripción: se elimina en cuanto termina. Si el procesamiento falla, lo conservamos hasta 7 días para reintentarlo y luego se elimina. Para separar las voces, el audio se envía a Deepgram por una conexión cifrada. Cuando usas el chat, los informes o la observación de tests con IA, enviamos a DeepSeek el texto necesario con el nombre del paciente reemplazado y la ficha sin nombre.
              </p>
              <p className="mt-3">
                El profesional es responsable de contar con la base legal y los consentimientos que correspondan antes de incorporar datos de pacientes o de terceros. Psiconex ofrece una plantilla de consentimiento informado editable que nombra a los proveedores que intervienen, y avisa cuando un paciente no tiene un consentimiento registrado.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">3. Datos de Google y Google Calendar</h2>
              <p className="mt-3">
                La conexión con Google es opcional. Si el usuario la autoriza, solicitamos el perfil básico para autenticar la cuenta y el acceso a Google Calendar para crear y sincronizar el calendario dedicado de Psiconex y sus citas.
              </p>
              <p className="mt-3">
                Almacenamos cifrados los tokens de acceso y actualización de OAuth, el identificador del calendario dedicado y de los eventos sincronizados, y el nombre y correo electrónico asociados a la cuenta. No almacenamos correos electrónicos de Gmail, ni el contenido de calendarios personales ajenos a la integración de Psiconex.
              </p>
              <p className="mt-3">
                Usamos los datos obtenidos de las APIs de Google exclusivamente para autenticar al profesional y proporcionar la sincronización solicitada. No los vendemos, no los usamos para publicidad y no los transferimos a terceros salvo cuando sea necesario para prestar la integración solicitada o exista una obligación legal.
              </p>
              <p className="mt-3">
                Los datos obtenidos mediante las APIs de Google, incluidos los de Google Calendar, nunca se comparten ni se envían a servicios externos de inteligencia artificial. La integración solo administra el calendario dedicado creado por Psiconex.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">4. Finalidades y proveedores</h2>
              <p className="mt-3">
                Utilizamos los datos para operar la plataforma, gestionar cuentas y suscripciones, procesar sesiones y registros clínicos solicitados por el usuario, sincronizar citas, enviar recordatorios y avisos por correo, responder solicitudes de soporte y proteger la seguridad e integridad del servicio.
              </p>
              <p className="mt-3">
                Para prestar el servicio trabajamos con los siguientes proveedores. Esta es la lista completa de quién recibe qué:
              </p>
              <div className="mt-5 text-base">
                <ProvidersTable />
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">5. Desconexión y eliminación de Google Calendar</h2>
              <p className="mt-3">
                El usuario puede desconectar Google Calendar desde la Agenda. Al hacerlo, eliminamos de forma inmediata e irreversible de la base de datos activa los tokens de OAuth y los identificadores locales usados para sincronizar el calendario y sus eventos. El usuario también puede revocar el acceso desde la{" "}
                <a className="text-primary underline underline-offset-4" href="https://myaccount.google.com/permissions">página de permisos de su Cuenta de Google</a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">6. Exportación, eliminación de cuentas y retención</h2>
              <p className="mt-3">
                El usuario puede descargar en cualquier momento todos sus datos (fichas, consentimientos, transcripciones, tests, informes y agenda) en un archivo ZIP, desde Configuración &gt; Privacidad.
              </p>
              <p className="mt-3">
                También puede eliminar su cuenta y todos sus datos desde Configuración &gt; Privacidad, de forma inmediata, o solicitarlo escribiendo a{" "}
                <a className="text-primary underline underline-offset-4" href="mailto:matias@datnexia.com?subject=Solicitud%20de%20Eliminaci%C3%B3n%20de%20Cuenta%20y%20Datos">matias@datnexia.com</a> con el asunto &ldquo;Solicitud de Eliminación de Cuenta y Datos&rdquo;. Procesamos las solicitudes verificadas a la brevedad.
              </p>
              <p className="mt-3">
                Al completar la eliminación, se purgan permanentemente los datos de la cuenta, incluidos perfiles, configuraciones, tokens de OAuth, citas, fichas y registros clínicos asociados.
              </p>
              <p className="mt-3">
                Si la suscripción se cancela o vence, la cuenta queda en modo de solo lectura durante 30 días: puedes consultar y exportar tus datos, pero no agregar nuevos. Te avisamos por correo 7 días y 1 día antes del plazo. Al cumplirse, la cuenta y sus datos se eliminan de forma permanente, salvo que reactives la suscripción.
              </p>
              {/* TODO(revisión legal/backups): mantener solo si el backup cifrado diario con rotación de 30 días está activo en el servidor y se borraron las copias antiguas. */}
              <p className="mt-3">
                Los datos eliminados pueden permanecer en copias de seguridad cifradas hasta que estas se eliminen, en un plazo máximo de 30 días naturales.
              </p>
              <p className="mt-3">
                El registro de accesos a datos clínicos se conserva durante 12 meses.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">7. Seguridad y derechos</h2>
              <p className="mt-3">
                Aplicamos medidas técnicas y organizativas razonables para proteger los datos contra acceso no autorizado, pérdida o alteración. Toda la comunicación con la plataforma va cifrada (HTTPS). En la base de datos guardamos cifrados el diagnóstico, la medicación, las notas privadas y de sesión, la derivación, los objetivos de intervención, las firmas de consentimiento y los tokens de Google. Cada acceso a datos clínicos queda registrado y puedes revisarlo en Configuración &gt; Privacidad.
              </p>
              <p className="mt-3">
                Puedes solicitar acceso, rectificación o eliminación de tus datos a través del correo de contacto indicado en esta política, o ejercerlos directamente desde la plataforma con la exportación y la eliminación de cuenta.
              </p>
            </section>

            {/* TODO: un abogado debe revisar esta sección (Ley 19.628 / Ley 21.719) antes de activar el píxel y la etiqueta de Google Ads en producción. No es asesoría legal. */}
            <section id="meta-pixel">
              <h2 className="text-xl font-semibold text-foreground">8. Cookies y medición publicitaria (Meta Pixel y Google Ads)</h2>
              <p className="mt-3">
                Para saber si nuestra publicidad funciona, y solo si tú lo aceptas, usamos el Meta Pixel de Meta Platforms y la etiqueta de Google Ads (gtag.js) de Google en las páginas públicas de Psiconex (psiconex.cl) y en la pantalla de acceso y registro y de confirmación de suscripción de la aplicación (app.psiconex.cl). Un solo aviso cubre ambas herramientas. Si lo rechazas, o no eliges, no se cargan y no se envía nada a Meta ni a Google.
              </p>
              <p className="mt-3">
                Qué medimos: la visita a esas páginas (Meta), el clic en los botones &ldquo;Probar gratis&rdquo;, el registro completado y la contratación de la suscripción (con el monto del plan, $4.990 CLP, y un identificador técnico de la suscripción). Meta y Google también reciben de forma estándar la dirección de la página, el navegador, la dirección IP y cookies propias de cada herramienta (en Meta, _fbp y _fbc; en Google Ads, cookies de medición de conversiones como _gcl_aw).
              </p>
              <p className="mt-3">
                Cómo configuramos Google Ads: usamos la etiqueta solo para medir conversiones de nuestros anuncios. Mientras no aceptes, el consentimiento para almacenamiento publicitario y datos de usuario permanece denegado; al aceptar concedemos solo esos dos permisos de medición, y no activamos la personalización de anuncios ni Google Analytics.
              </p>
              <p className="mt-3">
                Qué no enviamos: nunca enviamos datos clínicos ni de pacientes, ni nombres, correos o teléfonos en los eventos. Ni el Meta Pixel ni la etiqueta de Google Ads funcionan dentro de la plataforma (agenda, fichas, sesiones, informes ni ninguna pantalla de trabajo clínico).
              </p>
              <p className="mt-3">
                Finalidad: medir y mejorar nuestras campañas publicitarias. Meta y Google pueden tratar estos datos en el extranjero según sus propias políticas.
              </p>
              <p className="mt-3">
                Cómo rechazar o cambiar tu elección: puedes hacerlo en cualquier momento con los botones de abajo, desde el aviso que aparece al entrar, o escribiéndonos a{" "}
                <a className="text-primary underline underline-offset-4" href="mailto:matias@datnexia.com">matias@datnexia.com</a>. También puedes borrar las cookies de tu navegador.
              </p>
              <ConsentPreferences />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">9. Cambios a esta política</h2>
              <p className="mt-3">
                Podemos actualizar esta política cuando cambien el servicio, las integraciones o las obligaciones aplicables. Publicaremos la fecha de actualización en esta página.
              </p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}
