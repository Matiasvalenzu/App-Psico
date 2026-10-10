"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"

import {
  META_PIXEL_ID,
  META_PIXEL_READY_EVENT,
  isMetaPixelEnabled,
  isPixelPath,
  trackPageView,
} from "@/lib/metaPixel"

/**
 * Carga el Meta Pixel (fbevents.js) solo si hay NEXT_PUBLIC_META_PIXEL_ID y la
 * ruta está en la allowlist, y dispara PageView en cada cambio de ruta.
 * autoConfig=false: sin clics automáticos, microdata ni Advanced Matching.
 */
export function MetaPixel() {
  const pathname = usePathname()
  const allowed = isMetaPixelEnabled && isPixelPath(pathname)

  useEffect(() => {
    if (allowed) trackPageView(pathname)
  }, [allowed, pathname])

  if (!allowed) return null

  const id = JSON.stringify(META_PIXEL_ID)
  const code = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('set','autoConfig',false,${id});
fbq('init',${id});
window.dispatchEvent(new Event(${JSON.stringify(META_PIXEL_READY_EVENT)}));`

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {code}
    </Script>
  )
}
