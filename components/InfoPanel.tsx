"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AnnRow, ERROR_META, errorType, proxied } from "@/lib/types";

interface Props {
  ann: AnnRow | null;
  classImages: Record<string, string[]>;
  hasClassInfo: boolean;
  height?: number;
}

export default function InfoPanel({
  ann,
  classImages,
  hasClassInfo,
  height = 660,
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
                Hover over a bounding box
                <br />
                to inspect the annotation
              </p>
            </div>
          </motion.div>
        ) : (
          <Detail
            key={ann.annotation_id ?? "ann"}
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
      <div className="slim-scroll flex-1 overflow-y-auto px-4 py-3">
        {hasClassInfo ? (
          <>
            <RefStrip title={`Actual — ${ann.actual_class ?? "—"}`} urls={actualImgs} />
            <RefStrip title={`Predicted — ${ann.predicted_class ?? "—"}`} urls={predImgs} />
          </>
        ) : (
          <p className="text-[11px] italic text-mute">
            Upload the class info CSV with a dataset to see SKU reference
            images here.
          </p>
        )}
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
