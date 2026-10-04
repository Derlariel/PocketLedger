import { exportFilterSchema } from "@/features/exports/filters";
import { generateCsv } from "@/features/exports/csv";
import { generatePdf } from "@/features/exports/pdf";
import { ExportError, exportFilename, loadExportData, previewExport, recordExportAudit } from "@/features/exports/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Send export options as JSON." }, { status: 415 });
    const body: unknown = await request.json();
    const parsed = exportFilterSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Check the export filters and try again.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const preview = typeof body === "object" && body !== null && "preview" in body && body.preview === true;
    if (preview) return Response.json(await previewExport(parsed.data), { headers: { "cache-control": "private, no-store" } });

    const data = await loadExportData(parsed.data);
    const file = parsed.data.format === "csv" ? Buffer.from(generateCsv(data), "utf8") : await generatePdf(data);
    await recordExportAudit(data);
    return new Response(new Uint8Array(file), { headers: {
      "content-type": parsed.data.format === "csv" ? "text/csv; charset=utf-8" : "application/pdf",
      "content-disposition": `attachment; filename="${exportFilename(data)}"`,
      "content-length": String(file.byteLength),
      "x-export-transaction-count": String(data.transactions.length),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof ExportError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "cache-control": "private, no-store" } });
    return Response.json({ error: "Export generation failed. Review the filters and retry." }, { status: 500, headers: { "cache-control": "private, no-store" } });
  }
}
