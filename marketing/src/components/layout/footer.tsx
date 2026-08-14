import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { ROUTES } from "@/lib/config"

const COLUMNS = [
  {
    title: "Producto",
    links: [
      { href: "#producto", label: "Funciones" },
      { href: "#como-funciona", label: "Cómo funciona" },
      { href: "#precios", label: "Precios" },
      { href: "#seguridad", label: "Seguridad" },
    ],
  },
  {
    title: "Acceder",
    links: [
      { href: ROUTES.login, label: "Iniciar sesión" },
      { href: ROUTES.register, label: "Probar gratis" },
      { href: "#faq", label: "Preguntas frecuentes" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "mailto:matiasv.1992@gmail.com", label: "Contacto" },
      { href: "/privacidad", label: "Privacidad" },
      { href: "/terminos", label: "Términos" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2 max-w-sm">
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground">
              La herramienta clínica que devuelve tiempo a tu consulta.
              Transcripción, informes y RAG clínico para psicólogos.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-foreground">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 md:flex-row md:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Psiconex. Hecho en Chile para psicólogos.
          </p>
          <p className="text-xs text-muted-foreground">
            Psiconex no reemplaza el juicio clínico. Apoya tu trabajo, no lo sustituye.
          </p>
        </div>
      </div>
    </footer>
  )
}
