export type ErrorType = "both" | "group" | "class";
export type TriageStatus =
  | "incorrectly_tagged"
  | "ai_mistake"
  | "visibility_issues"
  | "sku_partially_visible"
  | "ambiguous";

export interface Dataset {
  id: string;
  name: string;
  created_at: string;
  total_rows: number;
  error_rows: number;
  image_count: number;
  has_class_info: boolean;
  owner_id?: string | null;
  status?: "active" | "paused" | null;
}

export interface ReviewSession {
  id: number;
  device_id: string;
  device_label: string | null;
  dataset_id: string;
  image_index: number;
  total_images: number;
  updated_at: string;
  status?: "active" | "paused" | null;
  sw_datasets?: { name: string; owner_id?: string | null; status?: "active" | "paused" | null } | null;
}

export interface AnnRow {
  id?: number;
  dataset_id?: string;
  image_id: string;
  url: string;
  shop_name: string | null;
  category_name: string | null;
  visit_date: string | null;
  annotation_id: string | null;
  actual_class: string | null;
  predicted_class: string | null;
  actual_group: string | null;
  predicted_group: string | null;
  wrong_group: number;
  wrong_class: number;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  annotated_image_link: string | null;
  triage_status?: TriageStatus | null;
  remarks?: string | null;
}

export const TRIAGE_META: Record<
  TriageStatus,
  { label: string; hex: string; key: string }
> = {
  incorrectly_tagged: { label: "Incorrectly Tagged", hex: "#DC2626", key: "1" },
  ai_mistake:         { label: "AI mistake",         hex: "#2563EB", key: "2" },
  visibility_issues:  { label: "Visibility issues",  hex: "#CA8A04", key: "3" },
  sku_partially_visible: { label: "SKU partially visible", hex: "#7C3AED", key: "4" },
  ambiguous:          { label: "Ambiguous",           hex: "#71717A", key: "5" },
};

export const errorType = (wg: number, wc: number): ErrorType =>
  wg && wc ? "both" : wg ? "group" : "class";

export const ERROR_META: Record<
  ErrorType,
  { hex: string; tag: string; label: string }
> = {
  both:  { hex: "#7C3AED", tag: "WG",  label: "Wrong group" },
  group: { hex: "#F59E0B", tag: "WG",  label: "Wrong group" },
  class: { hex: "#EF4444", tag: "WC",  label: "Wrong class only" },
};

/** Route remote shelf images through the server-side proxy (avoids CORS/auth issues). */
export const proxied = (url: string) => `/api/img?u=${encodeURIComponent(url)}`;
