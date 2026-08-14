import { cn } from "@/lib/utils"
import Image from "next/image"

interface LogoProps {
  className?: string
  withWordmark?: boolean
}

export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <Image
      src={withWordmark ? "/logo-psiconex.png" : "/logo-psiconex-icon.png"}
      alt="Psiconex"
      width={withWordmark ? 1951 : 281}
      height={withWordmark ? 393 : 282}
      className={cn(
        withWordmark ? "h-10 w-auto object-contain" : "h-9 w-9 object-contain",
        className
      )}
    />
  )
}
