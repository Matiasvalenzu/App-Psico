"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function HomeGate() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    router.replace(token ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Image
        src="/logo-psiconex.png"
        alt="Psiconex"
        width={1951}
        height={393}
        priority
        className="h-11 w-auto dark:hidden"
      />
      <Image
        src="/logo-psiconex-sidebar.png"
        alt=""
        width={1951}
        height={393}
        priority
        className="hidden h-11 w-auto dark:block"
      />
    </div>
  );
}
