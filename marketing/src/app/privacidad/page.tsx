import type { Metadata } from "next"
import Link from "next/link"

import { Footer } from "@/components/layout/footer"
import { Logo } from "@/components/brand/logo"

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Política de privacidad y tratamiento de datos de Psiconex.",
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
          <p className="mt-5 text-sm text-muted-foreground">Última actualización: 14 de agosto de 2026</p>

          <div className="mt-12 space-y-10 text-base leading-7 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground">1. Responsable del tratamiento</h2>
              <p className="mt-3">
                Psiconex es operado por Sociedad de Profesionales Informática y Tecnología Limitada, RUT 77.781.977-1, con domicilio en Martín de Zamora 5375, Las Condes, Santiago de Chile. Para consultas sobre esta política o el tratamiento de datos, escríbenos a{" "}
                <a className="text-primary underline underline-offset-4" href="mailto:matiasv.1992@gmail.com">matiasv.1992@gmail.com</a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">2. Datos que tratamos</h2>
              <p className="mt-3">
                Tratamos los datos necesarios para crear y administrar la cuenta, prestar las funciones contratadas y brindar soporte. Esto puede incluir datos de identificación y contacto del profesional, datos de agenda, fichas y notas clínicas, audios, transcripciones, documentos, resultados de evaluaciones y perfiles de voz que el usuario incorpore voluntariamente a la plataforma.
              </p>
              <p className="mt-3">
                El profesional es responsable de contar con la base legal y los consentimientos que correspondan antes de incorporar datos de pacientes o de terceros.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">3. Datos de Google y Google Calendar</h2>
              <p className="mt-3">
                La conexión con Google es opcional. Si el usuario la autoriza, solicitamos el perfil básico para autenticar la cuenta y el acceso a Google Calendar para crear y sincronizar el calendario dedicado de Psiconex y sus citas.
              </p>
              <p className="mt-3">
                Almacenamos los tokens de acceso y actualización de OAuth, el identificador del calendario dedicado y de los eventos sincronizados, y el nombre y correo electrónico asociados a la cuenta. No almacenamos correos electrónicos de Gmail, ni el contenido de calendarios personales ajenos a la integración de Psiconex.
              </p>
              <p className="mt-3">
                Usamos los datos obtenidos de las APIs de Google exclusivamente para autenticar al profesional y proporcionar la sincronización solicitada. No los vendemos, no los usamos para publicidad y no los transferimos a terceros salvo cuando sea necesario para prestar la integración solicitada o exista una obligación legal.
              </p>
              <p className="mt-3">
                Los datos obtenidos mediante las APIs de Google, incluidos los de Google Calendar, nunca se envían a DeepSeek ni a otros servicios de inteligencia artificial. La integración solo administra el calendario dedicado creado por Psiconex.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">4. Finalidades</h2>
              <p className="mt-3">
                Utilizamos los datos para operar la plataforma, gestionar cuentas y suscripciones, procesar sesiones y registros clínicos solicitados por el usuario, sincronizar citas, responder solicitudes de soporte y proteger la seguridad e integridad del servicio.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">5. Desconexión y eliminación de Google Calendar</h2>
              <p className="mt-3">
                El usuario puede desconectar Google Calendar desde la Agenda. Al hacerlo, eliminamos de forma inmediata e irreversible de la base de datos activa los tokens de OAuth y los identificadores locales usados para sincronizar el calendario y sus eventos. El usuario también puede revocar el acceso desde la{" "}
                <a className="text-primary underline underline-offset-4" href="https://myaccount.google.com/permissions">página de permisos de su Cuenta de Google</a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">6. Eliminación de cuentas y retención</h2>
              <p className="mt-3">
                El usuario puede solicitar la eliminación total de su cuenta y sus datos escribiendo a{" "}
                <a className="text-primary underline underline-offset-4" href="mailto:matiasv.1992@gmail.com?subject=Solicitud%20de%20Eliminaci%C3%B3n%20de%20Cuenta%20y%20Datos">matiasv.1992@gmail.com</a> con el asunto &ldquo;Solicitud de Eliminación de Cuenta y Datos&rdquo;. Procesamos las solicitudes verificadas en un plazo máximo de 48 horas hábiles.
              </p>
              <p className="mt-3">
                Al completar la eliminación, se purgan permanentemente los datos de la cuenta, incluidos perfiles, configuraciones, tokens de OAuth, citas, fichas y registros clínicos asociados. Las copias de seguridad automatizadas se sobrescriben y eliminan dentro de un plazo máximo de 30 días naturales.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">7. Seguridad y derechos</h2>
              <p className="mt-3">
                Aplicamos medidas técnicas y organizativas razonables para proteger los datos contra acceso no autorizado, pérdida o alteración. Puedes solicitar acceso, rectificación o eliminación de tus datos a través del correo de contacto indicado en esta política.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">8. Cambios a esta política</h2>
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
