"use client";

import { useEffect } from "react";
import { getAccessToken } from "@/lib/api";

// Responde a mensajes de la extensión Chrome con los datos de sesión virtual activa.
// La extensión inyecta un iframe apuntando a esta app y hace postMessage para obtener
// el session_id y el JWT, evitando la restricción cross-origin de localStorage.
export default function ExtensionBridge() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== "GET_DATNEXIA_SESSION") return;

      const sessionId = sessionStorage.getItem("virtual_session_id");
      const token = getAccessToken();

      event.source?.postMessage(
        {
          type: "DATNEXIA_SESSION",
          sessionId: sessionId ? parseInt(sessionId) : null,
          token: token || null,
        },
        { targetOrigin: event.origin }
      );
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}
