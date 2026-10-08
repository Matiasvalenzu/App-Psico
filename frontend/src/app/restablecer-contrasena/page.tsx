import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import RestablecerContrasenaForm from "./form";

export default function RestablecerContrasenaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <RestablecerContrasenaForm />
    </Suspense>
  );
}
