import { redirect } from "next/navigation";

// La lista de pacientes vive en /dashboard (links, conversiones y tutorial apuntan ahí)
export default function PacientesIndex() {
  redirect("/dashboard");
}
