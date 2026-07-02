"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, supabaseReady } from "@/lib/supabase";
import { parseDfOut, parseClassInfo, chunk } from "@/lib/parse";
import { Dataset } from "@/lib/types";

type UploadPhase =
  | { step: "idle" }
  | { step: "parsing" }
  | { step: "inserting"; done: number; total: number }
  | { step: "error"; message: string };

export default function HomePage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [phase, setPhase] = useState<UploadPhase>({ step: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const dfInput = useRef<HTMLInputElement>(null);
  const classInput = useRef<HTMLInputElement>(null);
  const [classFile, setClassFile] = useState<File | null>(null);

  const loadDatasets = useCallback(async () => {
    if (!supabaseReady) return setDatasets([]);
    const { data } = await supabase
      .from("sw_datasets")
      .select("*")
      .order("created_at", { ascending: false });
    setDatasets((data as Dataset[]) ?? []);
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

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

      const { data: ds, error: dsErr } = await supabase
        .from("sw_datasets")
        .insert({
          name: file.name.replace(/\.csv$/i, ""),
          total_rows: parsed.totalRows,
          error_rows: parsed.errors.length,
          image_count: parsed.imageCount,
          has_class_info: classRows.length > 0,
        })
        .select()
        .single();
      if (dsErr || !ds) throw new Error(dsErr?.message ?? "Insert failed");

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
            if (f && !busy) handleUpload(f);
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
                  Drop your <span className="font-mono text-brand">df_out</span>{" "}
                  CSV to begin
                </h1>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-mute">
                  Error rows are parsed in your browser and saved to Supabase —
                  shareable with the team, no re-uploads.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    className="btn btn-primary"
                    onClick={() => dfInput.current?.click()}
                  >
                    Choose df_out CSV
                  </button>
                  <button
                    className="btn"
                    onClick={() => classInput.current?.click()}
                  >
                    {classFile
                      ? `✓ ${classFile.name}`
                      : "Add class info CSV (optional)"}
                  </button>
                </div>
                <p className="mt-3 text-[11px] text-mute">
                  Class info CSV enables SKU reference images on hover
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
              if (f) handleUpload(f);
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

      {/* ── Dataset library ── */}
      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-mute">
            Saved datasets
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
            No datasets yet — upload a df_out CSV above to create your first
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
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink group-hover:text-brand">
                    {d.name}
                  </p>
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
