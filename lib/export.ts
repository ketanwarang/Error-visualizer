import { AnnRow, ERROR_META, TRIAGE_META, errorType } from "./types";

/**
 * Export annotation rows (usually the filtered set) as CSV or Excel,
 * including the triage status and remarks columns.
 * SheetJS is imported lazily so it never loads until an export is clicked.
 */
export async function exportRows(
  rows: AnnRow[],
  baseName: string,
  format: "csv" | "xlsx"
): Promise<void> {
  const XLSX = await import("xlsx");
  const data = rows.map((r) => ({
    image_id: r.image_id,
    shop_name: r.shop_name ?? "",
    category_name: r.category_name ?? "",
    date: r.visit_date ?? "",
    annotation_id: r.annotation_id ?? "",
    error_type: ERROR_META[errorType(r.wrong_group, r.wrong_class)].tag,
    actual_group: r.actual_group ?? "",
    predicted_group: r.predicted_group ?? "",
    actual_class: r.actual_class ?? "",
    predicted_class: r.predicted_class ?? "",
    wrong_group: r.wrong_group,
    wrong_class: r.wrong_class,
    triage_status: r.triage_status ? TRIAGE_META[r.triage_status].label : "",
    remarks: r.remarks ?? "",
    x_min: r.x_min,
    y_min: r.y_min,
    x_max: r.x_max,
    y_max: r.y_max,
    image_url: r.url,
    annotated_image_link: r.annotated_image_link ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "errors");
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = baseName.replace(/[^\w\-]+/g, "_");
  XLSX.writeFile(wb, `${safe}_errors_${stamp}.${format}`, {
    bookType: format,
  });
}
