import { supabase } from "./supabase";
import { ReviewSession } from "./types";
import { getDeviceId, getDeviceLabel } from "./device";

const MAX_ACTIVE_SESSIONS = 3;

/** Upsert this device's session for a dataset, ensuring at most 3 active sessions. */
export async function saveSession(
  datasetId: string,
  imageIndex: number,
  totalImages: number
): Promise<void> {
  const device_id = getDeviceId();

  // First check if there are already 3 active sessions not including this dataset
  const { data: existing } = await supabase
    .from("sw_sessions")
    .select("id, dataset_id, status, updated_at")
    .eq("device_id", device_id)
    .order("updated_at", { ascending: false });

  const active = (existing || []).filter((s) => s.status !== "paused" && s.dataset_id !== datasetId);
  if (active.length >= MAX_ACTIVE_SESSIONS) {
    // Pause the oldest active session(s)
    const toPause = active.slice(MAX_ACTIVE_SESSIONS - 1).map((s) => s.id);
    if (toPause.length > 0) {
      await supabase
        .from("sw_sessions")
        .update({ status: "paused" })
        .in("id", toPause);
    }
  }

  await supabase.from("sw_sessions").upsert(
    {
      device_id,
      device_label: getDeviceLabel(),
      dataset_id: datasetId,
      image_index: imageIndex,
      total_images: totalImages,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id,dataset_id" }
  );
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

/** All sessions for this device, with dataset names & status. */
export async function listSessions(): Promise<ReviewSession[]> {
  const { data } = await supabase
    .from("sw_sessions")
    .select("*, sw_datasets(name, owner_id)")
    .eq("device_id", getDeviceId())
    .order("updated_at", { ascending: false });
  return (data as ReviewSession[]) ?? [];
}

/** Toggle a session between active and paused */
export async function toggleSessionStatus(
  datasetId: string,
  targetStatus: "active" | "paused"
): Promise<void> {
  const device_id = getDeviceId();
  if (targetStatus === "active") {
    // Check limit before activating
    const { data: existing } = await supabase
      .from("sw_sessions")
      .select("id, dataset_id, status")
      .eq("device_id", device_id);
    const active = (existing || []).filter((s) => s.status !== "paused" && s.dataset_id !== datasetId);
    if (active.length >= MAX_ACTIVE_SESSIONS) {
      throw new Error("You already have 3 active sessions. Pause one before activating another.");
    }
  }
  await supabase
    .from("sw_sessions")
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq("device_id", device_id)
    .eq("dataset_id", datasetId);
}

/** Rename a dataset / session */
export async function renameDataset(
  datasetId: string,
  newName: string
): Promise<void> {
  const { error } = await supabase
    .from("sw_datasets")
    .update({ name: newName.trim() })
    .eq("id", datasetId);
  if (error) throw new Error(error.message);
}
