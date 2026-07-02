import Papa from "papaparse";
import { AnnRow } from "./types";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "nan" ? null : s;
};

export interface ParsedDfOut {
  totalRows: number;
  errors: AnnRow[];
  imageCount: number;
}

/** Parse a df_out CSV in the browser and keep only SKU error rows. */
export function parseDfOut(file: File): Promise<ParsedDfOut> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const rows = res.data;
          const errors: AnnRow[] = [];
          for (const r of rows) {
            const wg = num(r["wrong_group"]) ? 1 : 0;
            const wc = num(r["wrong_class"]) ? 1 : 0;
            const type = String(r["annotation_type"] ?? "").toUpperCase();
            if (type !== "SKU" || (!wg && !wc)) continue;
            const url = str(r["url"]);
            const imageId = str(r["image_id"]);
            if (!url || !imageId) continue;
            errors.push({
              image_id: imageId,
              url,
              shop_name: str(r["Shop Name"]),
              category_name: str(r["Category Name"]),
              visit_date: str(r["Date"]),
              annotation_id: str(r["annotation_id"]),
              actual_class: str(r["actual_class"]),
              predicted_class: str(r["predicted_class"]),
              actual_group: str(r["actual_group"]),
              predicted_group: str(r["predicted_group"]),
              wrong_group: wg,
              wrong_class: wc,
              x_min: num(r["x_min"]),
              y_min: num(r["y_min"]),
              x_max: num(r["x_max"]),
              y_max: num(r["y_max"]),
              annotated_image_link: str(r["annotated_image_link"]),
            });
          }
          const imageCount = new Set(errors.map((e) => e.image_id)).size;
          resolve({ totalRows: rows.length, errors, imageCount });
        } catch (e) {
          reject(e);
        }
      },
      error: reject,
    });
  });
}

/** Parse the optional group/class info CSV -> class_name -> [image urls]. */
export function parseClassInfo(
  file: File
): Promise<{ class_name: string; image_url: string }[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const seen = new Set<string>();
        const out: { class_name: string; image_url: string }[] = [];
        for (const r of res.data) {
          const cls = str(r["class_name"]);
          const url = str(r["class_image_gcs_file_path"]);
          if (!cls || !url) continue;
          const key = `${cls}\u0000${url}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ class_name: cls, image_url: url });
        }
        resolve(out);
      },
      error: reject,
    });
  });
}

export const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
