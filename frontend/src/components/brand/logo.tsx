import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  withWordmark?: boolean
}

export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex h-9 w-9 items-center justify-center">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-[hsl(280_75%_64%)] opacity-90" />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="relative z-10 h-5 w-5 text-primary-foreground"
          aria-hidden="true"
        >
          <path
            d="M3 12h2m14 0h2M5.5 8v8M8.5 5v14M12 7v10M15.5 5v14M18.5 8v8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {withWordmark && (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Psiconex
        </span>
      )}
    </div>
  )
}
