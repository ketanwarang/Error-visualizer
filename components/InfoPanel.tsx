"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AnnRow,
  ERROR_META,
  TRIAGE_META,
  TriageStatus,
  errorType,
  proxied,
} from "@/lib/types";

interface Props {
  ann: AnnRow | null;
  classImages: Record<string, string[]>;
  hasClassInfo: boolean;
  height?: number;
  onTriage: (ann: AnnRow, patch: Partial<AnnRow>) => void;
}

export default function InfoPanel({
  ann,
  classImages,
  hasClassInfo,
  height = 660,
  onTriage,
}: Props) {
  return (
    <aside
      className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-paper"
      style={{ height }}
    >
      <AnimatePresence mode="wait">
        {!ann ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid h-full place-items-center p-6 text-center"
          >
            <div>
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-wash text-xl">
                🎯
              </div>
              <p className="text-[13px] leading-relaxed text-mute">
                Hover over a bounding box —<br />
                its details stay pinned here
                <br />
                until you hover the next one
              </p>
            </div>
          </motion.div>
        ) : (
          <Detail
            key={String(ann.id ?? ann.annotation_id)}
            ann={ann}
            classImages={classImages}
            hasClassInfo={hasClassInfo}
            onTriage={onTriage}
          />
        )}
      </AnimatePresence>
    </aside>
  );
}

function Detail({
  ann,
  classImages,
  hasClassInfo,
  onTriage,
}: {
  ann: AnnRow;
  classImages: Record<string, string[]>;
  hasClassInfo: boolean;
  onTriage: (ann: AnnRow, patch: Partial<AnnRow>) => void;
}) {
  const et = errorType(ann.wrong_group, ann.wrong_class);
  const meta = ERROR_META[et];
  const actualImgs = classImages[ann.actual_class ?? ""] ?? [];
  const predImgs = classImages[ann.predicted_class ?? ""] ?? [];
  const [imagesOpen, setImagesOpen] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.15 }}
      className="flex h-full flex-col overflow-hidden"
    >
      <div className="shrink-0 border-b border-line bg-brand-soft px-4 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand">
          Annotation
          <span className="ml-2 font-mono font-medium normal-case tracking-normal text-soot">
            {ann.annotation_id ?? "—"}
          </span>
        </p>
      </div>
      <div
        className="shrink-0 border-b border-line px-4 py-2 text-[10px] font-bold uppercase tracking-[0.07em]"
        style={{ color: meta.hex, background: meta.hex + "10" }}
      >
        {meta.label}
      </div>
      <div className="shrink-0 space-y-1 border-b border-line px-4 py-3 text-[12px] leading-relaxed text-soot">
        <p>
          <b className="font-semibold text-ink">Actual:</b>{" "}
          {ann.actual_class ?? "—"}
        </p>
        <p>
          <b className="font-semibold text-ink">Predicted:</b>{" "}
          {ann.predicted_class ?? "—"}
        </p>
        <p className="pt-1 text-[11px] text-mute">
          GT: {ann.actual_group ?? "—"} · Pred: {ann.predicted_group ?? "—"}
        </p>
      </div>

      {/* ── Collapsible image section ── */}
      <div className="shrink-0 border-b border-line">
        <button
          onClick={() => setImagesOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-[0.07em] text-mute transition-colors hover:text-ink"
        >
          <span>Reference images</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${
              imagesOpen ? "rotate-180" : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <AnimatePresence>
          {imagesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="slim-scroll max-h-[240px] overflow-y-auto px-4 pb-3">
                {hasClassInfo ? (
                  <>
                    <RefStrip
                      title={`Actual — ${ann.actual_class ?? "—"}`}
                      urls={actualImgs}
                    />
                    <RefStrip
                      title={`Predicted — ${ann.predicted_class ?? "—"}`}
                      urls={predImgs}
                    />
                  </>
                ) : (
                  <p className="text-[11px] italic text-mute">
                    Upload the CGC file with a dataset to see SKU reference
                    images here.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Spacer */}
      <div className="min-h-0 flex-1" />

      <RemarksBox ann={ann} onTriage={onTriage} />
    </motion.div>
  );
}

function RemarksBox({
  ann,
  onTriage,
}: {
  ann: AnnRow;
  onTriage: (ann: AnnRow, patch: Partial<AnnRow>) => void;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
  }, [ann.id, ann.annotation_id]);

  return (
    <div className="shrink-0 border-t border-line bg-wash px-3 py-3">
      <p className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.08em] text-mute">
        Remarks
        <span
          className={`font-medium normal-case tracking-normal text-emerald-600 transition-opacity ${
            saved ? "opacity-100" : "opacity-0"
          }`}
        >
          Saved ✓
        </span>
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(TRIAGE_META) as TriageStatus[]).map((s) => {
          const m = TRIAGE_META[s];
          const active = ann.triage_status === s;
          return (
            <button
              key={s}
              onClick={() => {
                onTriage(ann, { triage_status: active ? null : s });
                setSaved(true);
                setTimeout(() => setSaved(false), 1500);
              }}
              className="flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] font-semibold transition-all duration-150"
              style={{
                borderColor: active ? m.hex : "var(--color-line)",
                background: active ? m.hex : "var(--color-paper)",
                color: active ? "#fff" : m.hex,
              }}
              title={`${m.label} (press ${m.key})`}
            >
              <span className="text-center leading-tight">{m.label}</span>
              <span
                className="rounded px-1 font-mono text-[8px]"
                style={{
                  background: active ? "rgba(255,255,255,.2)" : "var(--color-wash)",
                  color: active ? "#fff" : "var(--color-mute)",
                }}
              >
                {m.key}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RefStrip({ title, urls }: { title: string; urls: string[] }) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.07em] text-mute">
        {title}
      </p>
      {urls.length ? (
        <div className="flex flex-wrap gap-1.5">
          {urls.slice(0, 6).map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={u}
              src={proxied(u)}
              alt=""
              loading="lazy"
              className="h-[72px] w-auto max-w-[120px] rounded-md border border-line bg-wash object-contain transition-colors hover:border-brand"
              onError={(e) => e.currentTarget.remove()}
            />
          ))}
        </div>
      ) : (
        <p className="text-[11px] italic text-mute">No reference images</p>
      )}
    </div>
  );
}
