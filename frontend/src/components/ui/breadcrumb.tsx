import * as React from "react"
import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type BreadcrumbItem = { label: string; href?: string }

function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[]
  className?: string
}) {
  return (
    <nav aria-label="Ruta de navegación" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className={cn("flex items-center gap-1.5", last && "min-w-0")}>
              {item.href && !last ? (
                <Link href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn("truncate", last && "font-medium text-foreground")}
                >
                  {item.label}
                </span>
              )}
              {!last && <ChevronRightIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Breadcrumb }
