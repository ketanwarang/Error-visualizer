"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnnRow, ERROR_META, errorType, proxied } from "@/lib/types";

interface Props {
  ann: AnnRow | null;
  classImages: Record<string, string[]>;
  hasClassInfo: boolean;
  height?: number;
  onTriage?: (ann: AnnRow, patch: Partial<AnnRow>) => void;
}

export default function InfoPanel({
  ann,
  classImages,
  hasClassInfo,
  height = 660,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <aside
        className="flex w-10 shrink-0 flex-col items-center justify-between overflow-hidden rounded-xl border border-line bg-paper py-3 cursor-pointer hover:bg-wash transition-colors"
        style={{ height }}
        onClick={() => setIsCollapsed(false)}
        title="Expand details panel"
      >
        <div className="text-[12px] font-bold text-mute">←</div>
        <div className="writing-vertical text-[11px] font-bold uppercase tracking-wider text-soot">
          Inspection Details
        </div>
        <div className="text-[12px] font-bold text-mute">←</div>
      </aside>
    );
  }

  return (
    <aside
      className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-paper transition-all"
      style={{ height }}
    >
      <div className="flex items-center justify-between border-b border-line bg-wash px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-mute">
          Inspection Details
        </span>
        <button
          onClick={() => setIsCollapsed(true)}
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-mute hover:bg-paper hover:text-ink transition-colors"
          title="Collapse panel to right side"
        >
          Hide →
        </button>
      </div>

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
                Hover or select an error box —<br />
                its classification and reference images appear pinned here.
              </p>
            </div>
          </motion.div>
        ) : (
          <Detail
            key={String(ann.id ?? ann.annotation_id)}
            ann={ann}
            classImages={classImages}
            hasClassInfo={hasClassInfo}
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
}: {
  ann: AnnRow;
  classImages: Record<string, string[]>;
  hasClassInfo: boolean;
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

      <div className="flex-1 min-h-0 overflow-y-auto slim-scroll">
        <div className="space-y-1 border-b border-line px-4 py-3 text-[12px] leading-relaxed text-soot">
          <p>
            <b className="font-semibold text-ink">Actual:</b>{" "}
            {ann.actual_class ?? "—"}
          </p>
          <p>
            <b className="font-semibold text-ink">Predicted:</b>{" "}
            {ann.predicted_class ?? "—"}
          </p>
          <p className="pt-1 text-[11px] text-mute">
            GT group: {ann.actual_group ?? "—"} · Pred group: {ann.predicted_group ?? "—"}
          </p>
        </div>

        {/* ── Collapsible reference image section ── */}
        <div className="border-b border-line">
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
                <div className="px-4 pb-3 pt-1">
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

        <div className="p-4 text-[11px] text-mute leading-relaxed">
          <p>
            <b className="text-soot">Visit Date:</b> {ann.visit_date ?? "—"}
          </p>
          <p className="mt-1">
            <b className="text-soot">Shop:</b> {ann.shop_name ?? "—"}
          </p>
          {ann.remarks && (
            <p className="mt-2 rounded bg-wash p-2 text-soot italic">
              &ldquo;{ann.remarks}&rdquo;
            </p>
          )}
        </div>
      </div>
    </motion.div>
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
