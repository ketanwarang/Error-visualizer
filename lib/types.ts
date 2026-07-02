export type ErrorType = "both" | "group" | "class";

export interface Dataset {
  id: string;
  name: string;
  created_at: string;
  total_rows: number;
  error_rows: number;
  image_count: number;
  has_class_info: boolean;
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
}

export const errorType = (wg: number, wc: number): ErrorType =>
  wg && wc ? "both" : wg ? "group" : "class";

export const ERROR_META: Record<
  ErrorType,
  { hex: string; tag: string; label: string }
> = {
  both: { hex: "#7C3AED", tag: "WG+WC", label: "Wrong group + class" },
  group: { hex: "#F59E0B", tag: "WG", label: "Wrong group only" },
  class: { hex: "#EF4444", tag: "WC", label: "Wrong class only" },
};

/** Route remote shelf images through the server-side proxy (avoids CORS/auth issues). */
export const proxied = (url: string) => `/api/img?u=${encodeURIComponent(url)}`;
