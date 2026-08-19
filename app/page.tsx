import { redirect } from "next/navigation";

// La landing es Fase 4 del roadmap. Por ahora la raíz entra al editor.
export default function Home() {
  redirect("/editor");
}
