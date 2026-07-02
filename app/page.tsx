"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, supabaseReady } from "@/lib/supabase";
import { parseDfOut, parseClassInfo, chunk } from "@/lib/parse";
import { Dataset, ReviewSession } from "@/lib/types";
import { listSessions, renameDataset as renameApi, toggleSessionStatus } from "@/lib/sessions";
import { getDeviceId } from "@/lib/device";

type UploadPhase =
  | { step: "idle" }
  | { step: "parsing" }
  | { step: "inserting"; done: number; total: number }
  | { step: "error"; message: string };

export default function HomePage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [phase, setPhase] = useState<UploadPhase>({ step: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const dfInput = useRef<HTMLInputElement>(null);
  const classInput = useRef<HTMLInputElement>(null);
  const [dfFile, setDfFile] = useState<File | null>(null);
  const [classFile, setClassFile] = useState<File | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const loadDatasets = useCallback(async () => {
    if (!supabaseReady) return setDatasets([]);
    const myId = getDeviceId();
    const mySess = await listSessions();
    setSessions(mySess);

    const { data } = await supabase
      .from("sw_datasets")
      .select("*")
      .order("created_at", { ascending: false });

    const localOwned = new Set(JSON.parse(localStorage.getItem("sw_my_dataset_ids") || "[]"));
    const mySessIds = new Set(mySess.map((s) => s.dataset_id));

    const allDs = (data as Dataset[]) ?? [];
    // Only show datasets owned by this user OR where they have participated in a session OR created locally
    const userDs = allDs.filter(
      (d) => d.owner_id === myId || localOwned.has(d.id) || mySessIds.has(d.id)
    );
    setDatasets(userDs);
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  const handleFileSelect = (f: File) => {
    setDfFile(f);
    if (!sessionName.trim()) {
      setSessionName(f.name.replace(/\.csv$/i, ""));
    }
  };

  const handleUpload = async (file: File) => {
    if (!supabaseReady) {
      setPhase({
        step: "error",
        message:
          "Supabase is not configured. Copy .env.local.example to .env.local and add your project URL + anon key.",
      });
      return;
    }
    try {
      setPhase({ step: "parsing" });
      const parsed = await parseDfOut(file);
      if (parsed.errors.length === 0) {
        setPhase({
          step: "error",
          message:
            "No SKU error rows found. Check that the CSV has annotation_type, wrong_group and wrong_class columns.",
        });
        return;
      }
      const classRows = classFile ? await parseClassInfo(classFile) : [];

      const finalName = sessionName.trim() || file.name.replace(/\.csv$/i, "");
      const myId = getDeviceId();

      const { data: ds, error: dsErr } = await supabase
        .from("sw_datasets")
        .insert({
          name: finalName,
          total_rows: parsed.totalRows,
          error_rows: parsed.errors.length,
          image_count: parsed.imageCount,
          has_class_info: classRows.length > 0,
          owner_id: myId,
        })
        .select()
        .single();
      if (dsErr || !ds) throw new Error(dsErr?.message ?? "Insert failed");

      // Record ownership locally
      const localOwned = JSON.parse(localStorage.getItem("sw_my_dataset_ids") || "[]");
      localStorage.setItem("sw_my_dataset_ids", JSON.stringify(Array.from(new Set([...localOwned, ds.id]))));

      const annChunks = chunk(
        parsed.errors.map((e) => ({ ...e, dataset_id: ds.id })),
        500
      );
      const clsChunks = chunk(
        classRows.map((c) => ({ ...c, dataset_id: ds.id })),
        500
      );
      const total = annChunks.length + clsChunks.length;
      let done = 0;
      setPhase({ step: "inserting", done, total });

      for (const c of annChunks) {
        const { error } = await supabase.from("sw_annotations").insert(c);
        if (error) throw new Error(error.message);
        setPhase({ step: "inserting", done: ++done, total });
      }
      for (const c of clsChunks) {
        const { error } = await supabase.from("sw_class_images").insert(c);
        if (error) throw new Error(error.message);
        setPhase({ step: "inserting", done: ++done, total });
      }
      router.push(`/dataset/${ds.id}`);
    } catch (e) {
      setPhase({
        step: "error",
        message: e instanceof Error ? e.message : "Upload failed",
      });
    }
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return setEditingId(null);
    try {
      await renameApi(id, editingName);
      setEditingId(null);
      loadDatasets();
    } catch (e) {
      alert("Rename failed");
    }
  };

  const handleToggleStatus = async (datasetId: string, currentStatus?: string | null) => {
    const next = currentStatus === "paused" ? "active" : "paused";
    try {
      await toggleSessionStatus(datasetId, next);
      loadDatasets();
    } catch (e: any) {
      alert(e.message || "Could not toggle status");
    }
  };

  const deleteDataset = async (id: string) => {
    if (!confirm("Delete this dataset and all its annotations?")) return;
    await supabase.from("sw_datasets").delete().eq("id", id);
    loadDatasets();
  };

  const busy = phase.step === "parsing" || phase.step === "inserting";

  return (
    <div className="mx-auto max-w-[980px]">
      {/* ── Upload zone ── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f && !busy) setDfFile(f);
          }}
          className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
            dragOver
              ? "border-brand bg-brand-soft scale-[1.01]"
              : "border-line bg-wash"
          }`}
        >
          <AnimatePresence mode="wait">
            {busy ? (
              <motion.div
                key="busy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-line border-t-brand" />
                <p className="text-[15px] font-semibold">
                  {phase.step === "parsing"
                    ? "Parsing CSV…"
                    : `Uploading to Supabase — batch ${
                        (phase as { done: number }).done
                      } of ${(phase as { total: number }).total}`}
                </p>
                {phase.step === "inserting" && (
                  <div className="mx-auto mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-line">
                    <motion.div
                      className="h-full rounded-full bg-brand"
                      animate={{
                        width: `${(phase.done / phase.total) * 100}%`,
                      }}
                      transition={{ ease: "easeOut" }}
                    />
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-paper text-2xl shadow-card">
                  📦
                </div>
                <h1 className="text-[19px] font-bold">
                  Upload your data files to begin
                </h1>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-mute">
                  Error rows are parsed in your browser and saved to Supabase —
                  shareable with the team, no re-uploads.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    className={`btn ${
                      dfFile ? "border-emerald-500 text-emerald-700" : ""
                    }`}
                    onClick={() => dfInput.current?.click()}
                  >
                    {dfFile ? `✓ ${dfFile.name}` : "Raw data"}
                  </button>
                  <button
                    className={`btn ${
                      classFile ? "border-emerald-500 text-emerald-700" : ""
                    }`}
                    onClick={() => classInput.current?.click()}
                  >
                    {classFile
                      ? `✓ ${classFile.name}`
                      : "CGC file (optional)"}
                  </button>
                </div>
                {dfFile && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex flex-col items-center gap-3"
                  >
                    <div className="w-full max-w-xs">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-mute mb-1">
                        Session Name
                      </label>
                      <input
                        type="text"
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        placeholder="e.g. Q3 Audit - East Region"
                        className="field w-full text-center text-[13px] font-semibold"
                      />
                    </div>
                    <button
                      className="btn btn-primary px-8"
                      onClick={() => handleUpload(dfFile)}
                    >
                      Proceed
                    </button>
                  </motion.div>
                )}
                <p className="mt-3 text-[11px] text-mute">
                  CGC file enables SKU reference images on hover · Max 3 active sessions
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <input
            ref={dfInput}
            type="file"
            accept=".csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
              e.target.value = "";
            }}
          />
          <input
            ref={classInput}
            type="file"
            accept=".csv"
            hidden
            onChange={(e) => setClassFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {phase.step === "error" && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-lg border border-err-class/30 bg-err-class/5 px-4 py-3 text-[13px] text-err-class"
          >
            {phase.message}
          </motion.p>
        )}
      </motion.section>

      {/* ── Resume sessions (Active max 3) ── */}
      {sessions.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-mute">
              Active & Paused Sessions (Max 3 Active)
            </h2>
            <span className="font-mono text-[11px] text-mute">
              {sessions.filter((s) => s.status !== "paused").length} / 3 active
            </span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {sessions.map((s, i) => {
              const pct = s.total_images
                ? Math.round(((s.image_index + 1) / s.total_images) * 100)
                : 0;
              const isPaused = s.status === "paused";
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-150 ${
                    isPaused
                      ? "border-line/60 bg-wash opacity-80 hover:opacity-100"
                      : "border-line bg-paper hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => router.push(`/dataset/${s.dataset_id}`)}
                        className="truncate text-[13px] font-semibold text-ink hover:text-brand text-left flex-1"
                      >
                        {s.sw_datasets?.name ?? "Dataset"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(s.dataset_id);
                          setEditingName(s.sw_datasets?.name || "");
                        }}
                        className="p-1 text-mute opacity-60 hover:opacity-100 transition-opacity"
                        title="Rename session"
                      >
                        ✏️
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-mute">
                      Image {(s.image_index + 1).toLocaleString()} of{" "}
                      {s.total_images.toLocaleString()} · {timeAgo(s.updated_at)}
                    </p>
                  </div>

                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full transition-all ${isPaused ? "bg-mute" : "bg-brand"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-mute">{pct}% done</span>
                      <button
                        onClick={() => handleToggleStatus(s.dataset_id, s.status)}
                        className={`rounded px-2 py-0.5 font-bold transition-colors ${
                          isPaused
                            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                        }`}
                      >
                        {isPaused ? "▶ Resume" : "⏸ Pause"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Rename Modal ── */}
      <AnimatePresence>
        {editingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-line bg-paper p-5 shadow-pop"
            >
              <h3 className="text-[14px] font-bold text-ink mb-3">Rename Session</h3>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="Session name..."
                className="field w-full text-[13px]"
                autoFocus
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setEditingId(null)}
                  className="btn px-4 py-1.5 text-[12px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRename(editingId)}
                  className="btn btn-primary px-4 py-1.5 text-[12px]"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Dataset library ── */}
      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-mute">
            Your Saved Datasets
          </h2>
          {datasets && datasets.length > 0 && (
            <span className="font-mono text-[11px] text-mute">
              {datasets.length} dataset{datasets.length !== 1 && "s"}
            </span>
          )}
        </div>

        {datasets === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-[72px] rounded-xl" />
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <div className="rounded-xl border border-line bg-wash p-8 text-center text-[13px] text-mute">
            No datasets yet — upload a CSV above to create your first
            one.
          </div>
        ) : (
          <div className="space-y-2">
            {datasets.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className="group flex cursor-pointer items-center justify-between rounded-xl border border-line bg-paper px-5 py-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card"
                onClick={() => router.push(`/dataset/${d.id}`)}
              >
                <div className="min-w-0 flex-1 mr-4">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-ink group-hover:text-brand">
                      {d.name}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(d.id);
                        setEditingName(d.name);
                      }}
                      className="text-mute opacity-0 group-hover:opacity-100 hover:text-ink transition-opacity text-[12px]"
                      title="Rename dataset"
                    >
                      ✏️
                    </button>
                  </div>
                  <p className="mt-0.5 text-[12px] text-mute">
                    {new Date(d.created_at).toLocaleString()}
                    {d.has_class_info && (
                      <span className="ml-2 text-emerald-600">
                        ✓ SKU images
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-5">
                  <Stat label="errors" value={d.error_rows} accent />
                  <Stat label="images" value={d.image_count} />
                  <Stat label="rows" value={d.total_rows} />
                  <button
                    className="rounded-lg p-2 text-mute opacity-0 transition-all hover:bg-err-class/10 hover:text-err-class group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDataset(d.id);
                    }}
                    title="Delete dataset"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="hidden text-right sm:block">
      <p
        className={`font-mono text-[14px] font-semibold ${
          accent ? "text-brand" : "text-ink"
        }`}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-mute">{label}</p>
    </div>
  );
}
