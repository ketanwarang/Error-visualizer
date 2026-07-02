"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCollab } from "./CollabContext";

export default function HeaderCollabButton() {
  const { datasetId, datasetName, collaborators, isLive, myId, myName } = useCollab();
  const [open, setOpen] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open]);

  const copySessionId = () => {
    if (!datasetId) return;
    navigator.clipboard.writeText(datasetId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    let target = joinId.trim();
    if (!target) return;
    // If user pasted a full URL, extract the dataset ID
    if (target.includes("/dataset/")) {
      target = target.split("/dataset/")[1]?.split("?")[0]?.split("/")[0] || target;
    }
    setOpen(false);
    setJoinId("");
    router.push(`/dataset/${target}`);
  };

  return (
    <div className="relative flex items-center gap-2" ref={containerRef}>
      {/* Session ID Pill right next to Collab button */}
      {datasetId && (
        <button
          onClick={copySessionId}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
          title="Click to copy Session ID"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span>Session: {datasetId.slice(0, 8)}…</span>
          <span className="ml-0.5 text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
            {copied ? "✓ Copied" : "📋"}
          </span>
        </button>
      )}

      {/* Collab Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
          open || isLive
            ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)] shadow-card"
            : "border-line bg-paper text-ink hover:border-ink/40"
        }`}
        title="Realtime Collaboration Sessions"
      >
        <span>👥</span>
        <span>Collab</span>
        {collaborators.length > 0 && (
          <span className="ml-0.5 rounded-full bg-[var(--color-brand)] px-1.5 py-0.2 text-[10px] font-bold text-white">
            {collaborators.length}
          </span>
        )}
      </button>

      {/* Collab Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-12 z-[70] w-[340px] overflow-hidden rounded-2xl border border-line bg-paper shadow-pop"
          >
            <div className="border-b border-line bg-wash px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-ink">Real-time Collaboration</h3>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  ⚡ Live Sync
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-mute">
                Share session IDs so teammates inspect annotations without conflicting.
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Current Session Info */}
              {datasetId ? (
                <div className="rounded-xl border border-line bg-wash p-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-mute">
                    <span>ACTIVE SESSION</span>
                    <span>{datasetName || "Dataset"}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] font-bold text-ink">
                      {datasetId}
                    </span>
                    <button
                      onClick={copySessionId}
                      className="shrink-0 rounded bg-paper px-2 py-1 text-[11px] font-semibold text-[var(--color-brand)] border border-line hover:bg-wash"
                    >
                      {copied ? "Copied!" : "Copy ID"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line p-3 text-center text-[12px] text-mute">
                  Open a dataset to broadcast your session ID.
                </div>
              )}

              {/* Join Session Box */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-mute mb-1.5">
                  Join Team Session
                </label>
                <form onSubmit={handleJoin} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste Session ID or link..."
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value)}
                    className="field flex-1 text-[12px] font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!joinId.trim()}
                    className="btn btn-primary px-3 py-1.5 text-[12px] disabled:opacity-50"
                  >
                    Join →
                  </button>
                </form>
              </div>

              {/* Active Inspectors List */}
              {datasetId && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-mute mb-1.5">
                    Active Inspectors ({collaborators.length})
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 slim-scroll">
                    {collaborators.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12px]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="font-semibold text-ink">
                            {c.name} {c.id === myId ? "(You)" : ""}
                          </span>
                        </div>
                        {typeof c.imageIdx === "number" && (
                          <span className="font-mono text-[11px] text-mute">
                            Img #{c.imageIdx + 1}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
