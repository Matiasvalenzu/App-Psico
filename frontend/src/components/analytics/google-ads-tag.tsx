"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"

import { useMetaConsent } from "@/lib/metaConsent"
import { isPixelPath, isUpsellMeasurementPath } from "@/lib/metaPixel"
import {
  GOOGLE_ADS_ID,
  GOOGLE_ADS_READY_EVENT,
  isGoogleAdsEnabled,
} from "@/lib/googleAds"

const RELOAD_GUARD_KEY = "psx_gads_reload"

/**
 * Carga gtag.js (Google Ads) solo si hay NEXT_PUBLIC_GOOGLE_ADS_ID, la ruta está
 * en la allowlist y el usuario aceptó el consentimiento. Sin aceptar no se pide
 * nada a googletagmanager.com.
 *
 * Consent Mode v2: 'default' = todo denied; al cargar (ya con consentimiento) se
 * concede ad_storage y ad_user_data. ad_personalization y analytics_storage
 * quedan denied (el banner solo cubre medición de conversiones).
 * send_page_view=false y sin señales de Google: solo se envían conversiones.
 */
export function GoogleAdsTag() {
  const pathname = usePathname()
  const consent = useMetaConsent()
  const allowed =
    isGoogleAdsEnabled && (isPixelPath(pathname) || isUpsellMeasurementPath(pathname)) && consent === "accepted"

  // Red de seguridad: si gtag ya estaba cargado y la ruta sale de la allowlist
  // (o se retira el consentimiento), recarga completa para descargarlo.
  useEffect(() => {
    if (
      isGoogleAdsEnabled &&
      !allowed &&
      consent !== "pending" &&
      typeof window.gtag === "function"
    ) {
      // Una sola recarga por pestaña: evita un bucle si algo más define `gtag`.
      try {
        if (window.sessionStorage.getItem(RELOAD_GUARD_KEY)) return
        window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1")
      } catch {
        return
      }
      window.location.reload()
    } else if (typeof window.gtag !== "function") {
      try {
        window.sessionStorage.removeItem(RELOAD_GUARD_KEY)
      } catch {
        /* noop */
      }
    }
  }, [allowed, consent, pathname])

  if (!allowed) return null

  const id = JSON.stringify(GOOGLE_ADS_ID)
  const code = `window.dataLayer=window.dataLayer||[];
function gtag(){window.dataLayer.push(arguments)}
window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'denied',analytics_storage:'denied'});
gtag('js',new Date());
gtag('config',${id},{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
(function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(${id});document.head.appendChild(s)})();
window.dispatchEvent(new Event(${JSON.stringify(GOOGLE_ADS_READY_EVENT)}));`

  return (
    <Script id="google-ads-tag" strategy="afterInteractive">
      {code}
    </Script>
  )
}
