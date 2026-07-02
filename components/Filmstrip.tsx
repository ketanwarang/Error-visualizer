"use client";

import { motion } from "framer-motion";
import { AnnRow, proxied } from "@/lib/types";

interface Props {
  groups: [string, AnnRow[]][];
  idx: number;
  onJump: (i: number) => void;
}

/** Thumbnails around the current image (±8). Sharing the proxied URL with
 *  the main stage means every thumb shown here is already in the browser
 *  cache when the user navigates to it. */
const WINDOW = 8;

export default function Filmstrip({ groups, idx, onJump }: Props) {
  const start = Math.max(0, idx - WINDOW);
  const end = Math.min(groups.length, idx + WINDOW + 1);
  const slice = groups.slice(start, end);

  return (
    <div className="mt-3 rounded-xl border border-line bg-wash p-2">
      <div className="slim-scroll flex items-center gap-2 overflow-x-auto pb-1">
        {start > 0 && (
          <button
            className="grid h-[64px] w-9 shrink-0 place-items-center rounded-lg border border-line bg-paper text-mute transition-colors hover:border-brand hover:text-brand"
            onClick={() => onJump(Math.max(0, idx - WINDOW))}
            title={`Jump back ${WINDOW}`}
          >
            «
          </button>
        )}
        {slice.map(([imageId, rows], i) => {
          const gi = start + i;
          const active = gi === idx;
          const done = rows.every((r) => r.triage_status);
          return (
            <motion.button
              key={imageId}
              layout
              onClick={() => onJump(gi)}
              className={`relative h-[64px] w-[96px] shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-150 ${
                active
                  ? "border-brand shadow-card"
                  : "border-transparent opacity-70 hover:opacity-100 hover:border-line"
              }`}
              title={`Image ${gi + 1} · ${rows.length} error${
                rows.length !== 1 ? "s" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxied(rows[0].url)}
                alt=""
                loading="lazy"
                className="h-full w-full bg-stage object-cover"
              />
              <span
                className={`absolute bottom-1 left-1 rounded px-1 font-mono text-[9px] font-semibold text-white ${
                  active ? "bg-brand" : "bg-black/55"
                }`}
              >
                {gi + 1}
              </span>
              <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 font-mono text-[9px] font-semibold text-white">
                {rows.length}
              </span>
              {done && (
                <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                  ✓
                </span>
              )}
            </motion.button>
          );
        })}
        {end < groups.length && (
          <button
            className="grid h-[64px] w-9 shrink-0 place-items-center rounded-lg border border-line bg-paper text-mute transition-colors hover:border-brand hover:text-brand"
            onClick={() => onJump(Math.min(groups.length - 1, idx + WINDOW))}
            title={`Jump ahead ${WINDOW}`}
          >
            »
          </button>
        )}
      </div>
    </div>
  );
}
