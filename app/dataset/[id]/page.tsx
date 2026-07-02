"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { AnnRow, Dataset, ERROR_META, errorType } from "@/lib/types";
import CanvasViewer, { CanvasViewerHandle } from "@/components/CanvasViewer";
import InfoPanel from "@/components/InfoPanel";

const VIEW_H = 660;
const PAGE_SIZE = 1000;

export default function DatasetPage() {
  const { id } = useParams<{ id: string }>();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [anns, setAnns] = useState<AnnRow[] | null>(null);
  const [classImages, setClassImages] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [errFilter, setErrFilter] = useState<"any" | "both" | "group" | "class">("any");
  const [skuSearch, setSkuSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("All");
  const [shopFilter, setShopFilter] = useState("All");
  const [imgIdSearch, setImgIdSearch] = useState("");
  const [annIdSearch, setAnnIdSearch] = useState("");
  const [showTable, setShowTable] = useState(false);

  const [idx, setIdx] = useState(0);
  const [hovered, setHovered] = useState(-1);
  const [flash, setFlash] = useState<"s" | "d" | "f" | null>(null);
  const viewerRef = useRef<CanvasViewerHandle>(null);

  /* ── Load dataset + annotations (paged) + class images ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: ds, error } = await supabase
        .from("sw_datasets")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !ds) {
        setLoadError(error?.message ?? "Dataset not found");
        return;
      }
      if (cancelled) return;
      setDataset(ds as Dataset);

      const all: AnnRow[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error: e2 } = await supabase
          .from("sw_annotations")
          .select("*")
          .eq("dataset_id", id)
          .order("id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (e2) {
          setLoadError(e2.message);
          return;
        }
        all.push(...((data as AnnRow[]) ?? []));
        if (!data || data.length < PAGE_SIZE) break;
      }
      if (cancelled) return;
      setAnns(all);

      if ((ds as Dataset).has_class_info) {
        const map: Record<string, string[]> = {};
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data } = await supabase
            .from("sw_class_images")
            .select("class_name,image_url")
            .eq("dataset_id", id)
            .range(from, from + PAGE_SIZE - 1);
          for (const r of data ?? [])
            (map[r.class_name] ??= []).push(r.image_url);
          if (!data || data.length < PAGE_SIZE) break;
        }
        if (!cancelled) setClassImages(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    if (!anns) return [];
    let f = anns;
    if (errFilter !== "any")
      f = f.filter((a) => errorType(a.wrong_group, a.wrong_class) === errFilter);
    const q = skuSearch.trim().toLowerCase();
    if (q)
      f = f.filter((a) =>
        [a.actual_class, a.predicted_class, a.actual_group, a.predicted_group]
          .some((v) => (v ?? "").toLowerCase().includes(q))
      );
    if (dateFilter !== "All") f = f.filter((a) => a.visit_date === dateFilter);
    if (shopFilter !== "All") f = f.filter((a) => a.shop_name === shopFilter);
    if (imgIdSearch.trim())
      f = f.filter((a) => a.image_id.includes(imgIdSearch.trim()));
    if (annIdSearch.trim())
      f = f.filter((a) => (a.annotation_id ?? "").includes(annIdSearch.trim()));
    return f;
  }, [anns, errFilter, skuSearch, dateFilter, shopFilter, imgIdSearch, annIdSearch]);

  const imageGroups = useMemo(() => {
    const m = new Map<string, AnnRow[]>();
    for (const a of filtered) {
      const arr = m.get(a.image_id);
      if (arr) arr.push(a);
      else m.set(a.image_id, [a]);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const total = imageGroups.length;
  const safeIdx = Math.min(idx, Math.max(0, total - 1));
  const current = imageGroups[safeIdx];
  const rows = current?.[1] ?? [];
  const first = rows[0];

  const dates = useMemo(
    () => ["All", ...Array.from(new Set((anns ?? []).map((a) => a.visit_date).filter(Boolean) as string[])).sort()],
    [anns]
  );
  const shops = useMemo(
    () => ["All", ...Array.from(new Set((anns ?? []).map((a) => a.shop_name).filter(Boolean) as string[])).sort()],
    [anns]
  );
  const counts = useMemo(() => {
    const c = { both: 0, group: 0, class: 0 };
    for (const a of anns ?? []) c[errorType(a.wrong_group, a.wrong_class)]++;
    return c;
  }, [anns]);

  /* ── Keyboard shortcuts: s = prev · d = reset zoom · f = next ── */
  const goPrev = useCallback(
    () => setIdx((i) => Math.max(0, i - 1)),
    []
  );
  const goNext = useCallback(
    () => setIdx((i) => Math.min(total - 1, i + 1)),
    [total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable ||
        e.metaKey || e.ctrlKey || e.altKey
      )
        return;
      const k = e.key.toLowerCase();
      if (k === "s" || k === "arrowleft") {
        e.preventDefault();
        goPrev();
        setFlash("s");
      } else if (k === "f" || k === "arrowright") {
        e.preventDefault();
        goNext();
        setFlash("f");
      } else if (k === "d") {
        e.preventDefault();
        viewerRef.current?.resetZoom();
        setFlash("d");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 200);
    return () => clearTimeout(t);
  }, [flash]);

  /* Reset page when filters change */
  useEffect(() => setIdx(0), [errFilter, skuSearch, dateFilter, shopFilter, imgIdSearch, annIdSearch]);

  /* ── Render states ── */
  if (loadError)
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-err-class/30 bg-err-class/5 p-6 text-center">
        <p className="text-[14px] font-semibold text-err-class">{loadError}</p>
        <Link href="/" className="btn mt-4">← Back to datasets</Link>
      </div>
    );

  if (!dataset || !anns)
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-72 rounded-lg" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton rounded-xl" style={{ height: VIEW_H }} />
      </div>
    );

  return (
    <div>
      {/* ── Breadcrumb + dataset name ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px]">
          <Link href="/" className="text-mute transition-colors hover:text-brand">
            Datasets
          </Link>
          <span className="text-line">/</span>
          <span className="font-semibold text-ink">{dataset.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-mute">
          <span className={`keycap transition-all ${flash === "s" ? "!border-brand !text-brand scale-110" : ""}`}>s</span>
          prev
          <span className={`keycap transition-all ${flash === "d" ? "!border-brand !text-brand scale-110" : ""}`}>d</span>
          100%
          <span className={`keycap transition-all ${flash === "f" ? "!border-brand !text-brand scale-110" : ""}`}>f</span>
          next
        </div>
      </div>

      {/* ── Metrics ── */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Metric label="Total annotations" value={dataset.total_rows} delay={0} />
        <Metric label="Total errors" value={dataset.error_rows} accent delay={0.05} />
        <Metric label="Filtered errors" value={filtered.length} accent delay={0.1} />
        <Metric label="Matched images" value={total} delay={0.15} />
      </div>

      {/* ── Filters ── */}
      <div className="mb-4 rounded-xl border border-line bg-wash p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="field-label">
              Error type ({counts.both.toLocaleString()} / {counts.group.toLocaleString()} / {counts.class.toLocaleString()})
            </label>
            <select className="field" value={errFilter} onChange={(e) => setErrFilter(e.target.value as typeof errFilter)}>
              <option value="any">Any error</option>
              <option value="both">Wrong group + class</option>
              <option value="group">Wrong group only</option>
              <option value="class">Wrong class only</option>
            </select>
          </div>
          <div>
            <label className="field-label">SKU name</label>
            <input className="field" placeholder="Actual or predicted…" value={skuSearch} onChange={(e) => setSkuSearch(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Date</label>
            <select className="field" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              {dates.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Shop</label>
            <select className="field" value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
              {shops.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Image ID</label>
            <input className="field font-mono" placeholder="e.g. 113353766" value={imgIdSearch} onChange={(e) => setImgIdSearch(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Annotation ID</label>
            <input className="field font-mono" placeholder="e.g. 4480908741" value={annIdSearch} onChange={(e) => setAnnIdSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-err-group/30 bg-err-group/5 p-6 text-center">
          <p className="text-[14px] font-semibold">No images match the current filters</p>
          <p className="mt-1 text-[13px] text-mute">
            This dataset has {counts.both.toLocaleString()} WG+WC, {counts.group.toLocaleString()} WG-only and {counts.class.toLocaleString()} WC-only errors — adjust the filters above.
          </p>
        </div>
      ) : (
        <>
          {/* ── Navigation ── */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button className="btn" disabled={safeIdx === 0} onClick={() => setIdx(0)} title="First image">⏮</button>
            <button className="btn" disabled={safeIdx === 0} onClick={goPrev}>← Prev</button>
            <button className="btn" disabled={safeIdx >= total - 1} onClick={goNext}>Next →</button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={total}
                value={safeIdx + 1}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setIdx(Math.min(Math.max(1, v), total) - 1);
                }}
                className="field w-20 text-center font-mono font-semibold"
              />
              <span className="text-[12px] font-medium text-mute">of {total.toLocaleString()}</span>
            </div>
            <button className="btn" disabled={safeIdx >= total - 1} onClick={() => setIdx(total - 1)} title="Last image">⏭</button>

            <div className="ml-auto h-1.5 w-40 overflow-hidden rounded-full bg-line">
              <motion.div
                className="h-full rounded-full bg-brand"
                animate={{ width: `${((safeIdx + 1) / total) * 100}%` }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* ── Meta pills ── */}
          {first && (
            <motion.div
              key={current[0]}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-3 flex flex-wrap items-center gap-1.5"
            >
              <Pill>{first.shop_name ?? "—"}</Pill>
              <Pill>{first.category_name ?? "—"}</Pill>
              <Pill>{first.visit_date ?? "—"}</Pill>
              <Pill mono>ID {current[0]}</Pill>
              <Pill accent>{rows.length} error annotation{rows.length !== 1 && "s"}</Pill>
              {first.annotated_image_link && (
                <a
                  href={first.annotated_image_link}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 text-[12px] font-semibold text-brand transition-opacity hover:opacity-70"
                >
                  Open in ShelfWatch viewer ↗
                </a>
              )}
            </motion.div>
          )}

          {/* ── Stage + panel ── */}
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current[0]}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <CanvasViewer
                    ref={viewerRef}
                    imageUrl={first.url}
                    anns={rows}
                    height={VIEW_H}
                    onHover={setHovered}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <InfoPanel
              ann={hovered >= 0 ? rows[hovered] : null}
              classImages={classImages}
              hasClassInfo={dataset.has_class_info}
              height={VIEW_H}
            />
          </div>

          {/* ── Annotation table ── */}
          <div className="mt-4">
            <button className="btn" onClick={() => setShowTable((s) => !s)}>
              {showTable ? "Hide" : "Show"} annotation table ({rows.length})
            </button>
            <AnimatePresence>
              {showTable && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="slim-scroll mt-3 max-h-[320px] overflow-auto rounded-xl border border-line">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-wash text-left">
                        <tr>
                          {["Annotation ID","Actual group","Predicted group","Actual class","Predicted class","WG","WC"].map((h) => (
                            <th key={h} className="whitespace-nowrap border-b border-line px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-mute">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const et = errorType(r.wrong_group, r.wrong_class);
                          return (
                            <tr
                              key={r.annotation_id ?? i}
                              className={`border-b border-line/60 transition-colors last:border-0 ${
                                i === hovered ? "bg-brand-soft" : "hover:bg-wash"
                              }`}
                            >
                              <td className="px-3 py-2 font-mono">{r.annotation_id ?? "—"}</td>
                              <td className="px-3 py-2">{r.actual_group ?? "—"}</td>
                              <td className="px-3 py-2">{r.predicted_group ?? "—"}</td>
                              <td className="px-3 py-2">{r.actual_class ?? "—"}</td>
                              <td className="px-3 py-2">{r.predicted_class ?? "—"}</td>
                              <td className="px-3 py-2 font-mono font-semibold" style={{ color: r.wrong_group ? ERROR_META[et].hex : undefined }}>
                                {r.wrong_group}
                              </td>
                              <td className="px-3 py-2 font-mono font-semibold" style={{ color: r.wrong_class ? ERROR_META[et].hex : undefined }}>
                                {r.wrong_class}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  delay,
}: {
  label: string;
  value: number;
  accent?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
      className="rounded-xl border border-line border-l-[3px] border-l-brand bg-paper px-4 py-3 shadow-card"
    >
      <p className={`font-mono text-[22px] font-semibold leading-none ${accent ? "text-brand" : "text-ink"}`}>
        {value.toLocaleString()}
      </p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-mute">
        {label}
      </p>
    </motion.div>
  );
}

function Pill({
  children,
  accent,
  mono,
}: {
  children: React.ReactNode;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[12px] font-medium ${
        accent ? "bg-brand-soft font-semibold text-brand" : "bg-wash text-soot"
      } ${mono ? "font-mono" : ""}`}
    >
      {children}
    </span>
  );
}
