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
    q: "¿Mis pacientes saben que se está grabando?",
    a: "Sí, y deben firmar consentimiento informado. Psiconex incluye una plantilla editable que cumple con la Ley 19.628 chilena y con los lineamientos del Colegio de Psicólogos.",
  },
  {
    q: "¿Qué tan precisa es la transcripción?",
    a: "Whisper alcanza ~95% de precisión en español chileno con audio de calidad clínica. La diarización (separar voces) llega a ~92% cuando el psicólogo entrena su perfil de voz una vez.",
  },
  {
    q: "¿Los datos van a OpenAI o a servidores en EE.UU.?",
    a: "No. Whisper corre en infraestructura chilena, los resúmenes con DeepSeek pasan por una API que no entrena con tus datos, y el audio nunca sale del país. Detallamos arquitectura en el DPA.",
  },
  {
    q: "¿Puedo migrar mis fichas actuales?",
    a: "Sí. Aceptamos importación de PDF, Word, Google Docs y exportaciones de Doctoralia o Calenda. El equipo de onboarding hace la migración por ti en planes Práctica y Clínica.",
  },
  {
    q: "¿Funciona en sesiones por Meet o Zoom?",
    a: "Sí. Hay una extensión opcional que graba localmente la videollamada y la sube cifrada. El paciente solo ve el aviso estándar de grabación.",
  },
  {
    q: "¿Qué pasa si cancelo? ¿Me llevo mis datos?",
    a: "Toda la información es tuya. Exportas la base completa (audios, transcripciones, informes) en JSON + PDF en un click. Al cancelar borramos todo a los 30 días, o de inmediato si lo pides.",
  },
  {
    q: "¿Reemplaza al psicólogo?",
    a: "No. Psiconex es un asistente administrativo y de análisis. El juicio clínico, la relación terapéutica y las decisiones de tratamiento son tuyas, siempre.",
  },
]

export function FAQSection() {
  return (
    <section
      id="faq"
      aria-label="Preguntas frecuentes"
      className="section-perf py-20 md:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Preguntas"
          title="Lo que más nos preguntan"
          description="Y si tienes una distinta, escríbenos. Respondemos en menos de 24 horas hábiles."
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-12"
        >
          <Accordion className="w-full space-y-3">
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
