"use client";

import { useEffect } from "react";
import { capturarAtribucion } from "@/lib/atribucion";

export function AttributionCapture() {
  useEffect(() => {
    capturarAtribucion();
  }, []);
  return null;
}
