import { notFound } from "next/navigation";
import { parseDesign } from "@core/persist";
import { loadSharedDesign } from "@/src/server/designStore";
import { SharedView } from "./SharedView";

export const dynamic = "force-dynamic";

export default async function SharedDesignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const record = await loadSharedDesign(slug);
  if (!record) notFound();

  // Se valida con el mismo parser que el editor: un diseño de otra versión
  // de schema no debe romper la página pública.
  const design = parseDesign(JSON.stringify(record.payload));
  if (!design) notFound();

  return (
    <div className="h-full">
      <SharedView design={design} />
    </div>
  );
}
