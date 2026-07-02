import { supabase } from "./supabase";
import { ReviewSession } from "./types";
import { getDeviceId, getDeviceLabel } from "./device";

const MAX_SESSIONS = 3;

/** Upsert this device's session for a dataset, then prune to the 3 newest. */
export async function saveSession(
  datasetId: string,
  imageIndex: number,
  totalImages: number
): Promise<void> {
  const device_id = getDeviceId();
  await supabase.from("sw_sessions").upsert(
    {
      device_id,
      device_label: getDeviceLabel(),
      dataset_id: datasetId,
      image_index: imageIndex,
      total_images: totalImages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id,dataset_id" }
  );

  const { data } = await supabase
    .from("sw_sessions")
    .select("id")
    .eq("device_id", device_id)
    .order("updated_at", { ascending: false });
  if (data && data.length > MAX_SESSIONS) {
    const stale = data.slice(MAX_SESSIONS).map((r) => r.id);
    await supabase.from("sw_sessions").delete().in("id", stale);
  }
}

/** The saved position for this device on one dataset (or null). */
export async function getSession(
  datasetId: string
): Promise<ReviewSession | null> {
  const { data } = await supabase
    .from("sw_sessions")
    .select("*")
    .eq("device_id", getDeviceId())
    .eq("dataset_id", datasetId)
    .maybeSingle();
  return (data as ReviewSession) ?? null;
}

/** Up to 3 most recent sessions for this device, with dataset names. */
export async function listSessions(): Promise<ReviewSession[]> {
  const { data } = await supabase
    .from("sw_sessions")
    .select("*, sw_datasets(name)")
    .eq("device_id", getDeviceId())
    .order("updated_at", { ascending: false })
    .limit(MAX_SESSIONS);
  return (data as ReviewSession[]) ?? [];
}
