"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useExport } from "./ExportContext";

export default function HeaderDownloadButton() {
  const { state, exportAs } = useExport();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  if (state.rows.length === 0) return null;

  return (
    <div className="relative" ref={btnRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn gap-2 bg-[var(--color-brand)] text-white hover:brightness-110 border-transparent shadow-card text-[12px] h-8 px-3"
        title="Download filtered dataset"
      >
        <span>↓ Download</span>
        <span className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[10px]">
          {state.rows.length.toLocaleString()}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 z-[60] w-48 overflow-hidden rounded-xl border border-line bg-paper p-1.5 shadow-pop"
            >
              <div className="px-3 py-1.5 border-b border-line mb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-mute">
                  Export {state.rows.length.toLocaleString()} rows
                </p>
                <p className="text-[11px] text-ink truncate">
                  {state.datasetName}
                </p>
              </div>
              <button
                onClick={() => {
                  exportAs("csv");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] font-medium text-soot hover:bg-wash hover:text-ink transition-colors"
              >
                <span>Download as CSV</span>
                <span className="font-mono text-[10px] text-mute">.csv</span>
              </button>
              <button
                onClick={() => {
                  exportAs("xlsx");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] font-medium text-soot hover:bg-wash hover:text-ink transition-colors"
              >
                <span>Download as Excel</span>
                <span className="font-mono text-[10px] text-mute">.xlsx</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
