"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ClientPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm overflow-y-auto">
      {children}
    </div>,
    document.body
  );
}
