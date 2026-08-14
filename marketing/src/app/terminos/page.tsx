import type { Metadata } from "next"
import Link from "next/link"

import { Footer } from "@/components/layout/footer"
import { Logo } from "@/components/brand/logo"

export const metadata: Metadata = {
  title: "Términos del servicio",
  description: "Términos y condiciones de uso de Psiconex.",
}

export default function TermsPage() {
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
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Términos del servicio</h1>
          <p className="mt-5 text-sm text-muted-foreground">Última actualización: 14 de agosto de 2026</p>

          <div className="mt-12 space-y-10 text-base leading-7 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground">1. Identificación y aceptación</h2>
              <p className="mt-3">
                Psiconex es operado por Sociedad de Profesionales Informática y Tecnología Limitada, RUT 77.781.977-1, con domicilio en Martín de Zamora 5375, Las Condes, Santiago de Chile. Al crear una cuenta o utilizar la plataforma, aceptas estos términos y la{" "}
                <Link className="text-primary underline underline-offset-4" href="/privacidad">Política de privacidad</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">2. Servicio</h2>
              <p className="mt-3">
                Psiconex ofrece herramientas digitales de apoyo para profesionales de la salud mental, incluyendo gestión de agenda, registro de sesiones, transcripción, búsqueda y generación de borradores de informes. La plataforma apoya el trabajo profesional, pero no reemplaza el juicio clínico, la evaluación profesional ni la relación terapéutica.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">3. Responsabilidades del usuario</h2>
              <p className="mt-3">
                El usuario debe proporcionar información veraz, proteger el acceso a su cuenta y utilizar la plataforma de forma lícita y profesional. El usuario es responsable de obtener los consentimientos, autorizaciones y bases legales aplicables antes de registrar, cargar, grabar o procesar información de pacientes y terceros.
              </p>
              <p className="mt-3">
                El usuario revisará y validará toda transcripción, resumen, informe o contenido generado antes de utilizarlo en decisiones clínicas, documentos profesionales o comunicaciones con pacientes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">4. Integración con Google Calendar</h2>
              <p className="mt-3">
                La integración con Google Calendar es opcional y requiere autorización expresa del usuario. Se utiliza para crear y sincronizar el calendario dedicado de Psiconex y sus citas. El usuario puede desconectarla en cualquier momento desde la Agenda; los datos de la integración se tratan conforme a nuestra Política de privacidad.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">5. Uso aceptable</h2>
              <p className="mt-3">
                No está permitido usar la plataforma para actividades ilícitas, vulnerar derechos de terceros, eludir controles de seguridad, compartir credenciales, introducir software malicioso ni utilizar el servicio de una forma que afecte su disponibilidad o integridad.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">6. Disponibilidad y modificaciones</h2>
              <p className="mt-3">
                Podemos actualizar, mantener, modificar o suspender funciones de la plataforma para mejorar el servicio, resolver incidencias o cumplir obligaciones aplicables. Procuraremos comunicar cambios relevantes cuando corresponda.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">7. Propiedad intelectual</h2>
              <p className="mt-3">
                Psiconex, su software, marca, diseño y contenidos son propiedad de sus respectivos titulares. El usuario conserva los derechos sobre los datos y contenidos que incorpora a la plataforma, otorgando solo las autorizaciones necesarias para prestar el servicio.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">8. Contacto, vigencia y ley aplicable</h2>
              <p className="mt-3">
                Para consultas sobre estos términos, contáctanos en{" "}
                <a className="text-primary underline underline-offset-4" href="mailto:matiasv.1992@gmail.com">matiasv.1992@gmail.com</a>. Estos términos se rigen por las leyes de la República de Chile, sin perjuicio de los derechos irrenunciables que correspondan a los usuarios.
              </p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}
