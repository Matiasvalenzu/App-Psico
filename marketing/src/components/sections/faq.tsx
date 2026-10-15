"use client"

import { motion } from "motion/react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { SectionHeading } from "@/components/sections/section-heading"

const FAQS = [
  {
    q: "¿Sirve si atiendo solo, en consulta particular?",
    a: "Sí, está pensado para eso. El plan Estándar ($4.990 al mes) trae lo clínico: transcripción, chat con IA para resúmenes e informes, agenda y videollamada propia. Si además quieres llevar tus cobros y emitir tus boletas de honorarios, el plan Plus ($9.990 al mes) los suma. No se cobra por paciente.",
  },
  {
    q: "¿Necesito tarjeta para probar?",
    a: "No. La prueba de 14 días incluye todo el Plan Plus y solo pide nombre, correo y contraseña. Antes de que termine eliges Estándar o Plus; si registras tu tarjeta durante la prueba, el primer cobro llega cuando termina. Para emitir boletas durante la prueba igual debes autorizar a Psiconex en el Servicio de Impuestos Internos. Si la prueba termina y no te suscribes, tu cuenta queda en solo lectura.",
  },
  {
    q: "¿Necesito el consentimiento de mis pacientes?",
    a: "Sí. Grabar o transcribir una sesión requiere el consentimiento informado del paciente. Psiconex incluye una plantilla de consentimiento editable, que puedes ajustar a tu práctica y que el paciente firma de forma electrónica mediante un enlace. Si un paciente aún no tiene consentimiento registrado, te lo advertimos. Revisa con tu marco ético y legal que el texto sirva a tu caso.",
  },
  {
    q: "¿Qué tan precisa es la transcripción?",
    a: "Ninguna transcripción automática es perfecta. La precisión depende de la calidad del audio, el ruido, los acentos y la cantidad de voces. Por eso la transcripción es editable: la revisas y corriges antes de usarla. Separamos las voces cuando el audio y la configuración lo permiten.",
  },
  {
    q: "¿Los textos que genera la IA quedan como definitivos?",
    a: "No. La transcripción la revisas y corriges. Los resúmenes y borradores de informe que pides en el chat con IA son una propuesta: un informe solo queda guardado si tú lo guardas, y lo descargas en PDF o Word para editarlo y firmarlo.",
  },
  {
    q: "¿Qué servicios externos reciben mis datos?",
    a: "La transcripción la hace nuestro servidor, y el audio se elimina en cuanto termina. Para separar las voces, el audio se envía a Deepgram por una conexión cifrada, indicándole que no lo use para mejorar sus modelos. Cuando usas el chat, los informes o la observación de tests con IA, el texto se envía a DeepSeek sin el nombre del paciente. Los datos de Google Calendar nunca se envían a la IA. En la sección de seguridad detallamos cada proveedor y qué recibe.",
  },
  {
    q: "¿Me puedo cambiar desde otra plataforma sin perder a mis pacientes?",
    a: "Sí. Si tienes a tus pacientes en una planilla Excel o CSV, impórtala: Psiconex reconoce las columnas, te muestra lo que va a crear antes de confirmar y puedes deshacer la importación durante 24 horas. Se importan solo datos de contacto y administrativos. Tus documentos en PDF, Word o TXT los subes a la ficha de cada paciente. Si necesitas ayuda, escríbenos.",
  },
  {
    q: "¿Puedo hacer sesiones online?",
    a: "Sí. La vía principal es la videollamada propia de Psiconex: creas la sala, compartes el enlace y el paciente se une desde el navegador, sin crear cuenta ni instalar nada. La llamada graba cada voz en una pista aparte y, al cerrarla, el audio se transcribe y queda en el historial. Se graba solo el audio, sin video. Recuerda informar al paciente y contar con su consentimiento.",
  },
  {
    q: "¿Qué pasa si cancelo? ¿Me llevo mis datos?",
    a: "Tus datos son tuyos. Desde la sección Privacidad de la app descargas cuando quieras un ZIP con fichas, consentimientos, sesiones, transcripciones, tests, informes y agenda, en JSON y PDF. Si cancelas, tu cuenta queda 30 días en solo lectura para que exportes lo que necesites; te avisamos por correo 7 días y 1 día antes, y luego eliminamos tus datos. También puedes eliminar tu cuenta de inmediato desde la app.",
  },
  {
    q: "¿Necesito entregar mi clave del Servicio de Impuestos Internos?",
    a: "No. Autorizas a Psiconex una vez desde tu propio Servicio de Impuestos Internos y puedes revocar ese permiso cuando quieras. Psiconex nunca pide ni guarda tu clave.",
  },
  {
    q: "¿Puedo anular una boleta?",
    a: "Sí. La anulas en tu Servicio de Impuestos Internos siguiendo la guía de la app y la marcas como anulada en Psiconex, que actualiza su estado.",
  },
  {
    q: "¿Qué escalas clínicas incluye?",
    a: "PHQ-9 (depresión), GAD-7 (ansiedad), DASS-21 (depresión, ansiedad y estrés) y la Escala de Autoestima de Rosenberg, en versiones en español con puntos de corte publicados. Las aplicas en consulta o compartes un enlace para que el paciente responda desde su celular, y ves la evolución en un gráfico.",
  },
  {
    q: "¿Qué pasa si un paciente marca ideación suicida en una escala?",
    a: "Psiconex muestra una alerta en la ficha aunque el puntaje total sea bajo y, si respondió desde el enlace, te avisa por correo sin incluir datos clínicos. Al paciente se le muestran líneas de ayuda. La evaluación y las decisiones siguen siendo tuyas.",
  },
  {
    q: "¿Los informes para colegio o tribunal reemplazan mi firma?",
    a: "No. Son borradores (disponibles en el Plan Plus) que marcan con [COMPLETAR] lo que falta. Tú los revisas, los corriges, los marcas como finales y los exportas a PDF o Word para firmarlos.",
  },
  {
    q: "¿Mi paciente ve mis notas si le doy el enlace de seguimiento?",
    a: "No. Con ese enlace solo ve sus tareas y su registro de ánimo.",
  },
  {
    q: "¿Reemplaza al psicólogo?",
    a: "No. Psiconex es un asistente administrativo y de análisis. El juicio clínico, la relación terapéutica y las decisiones de tratamiento son tuyas, siempre.",
  },
]

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
}

export function FAQSection() {
  return (
    <section
      id="faq"
      aria-label="Preguntas frecuentes"
      className="section-perf py-20 md:py-28 lg:py-32"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Preguntas"
          title="Lo que más nos preguntan"
          description="Y si tienes una distinta, escríbenos."
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-12"
        >
          <Accordion keepMounted className="w-full space-y-3">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="rounded-xl border border-border bg-card px-5 transition-colors hover:border-primary/30 data-[state=open]:border-primary/40 data-[state=open]:shadow-md data-[state=open]:shadow-primary/5"
              >
                <AccordionTrigger className="py-5 text-left text-base font-medium text-foreground hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
