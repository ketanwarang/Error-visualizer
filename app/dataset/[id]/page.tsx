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
import {
  AnnRow,
  Dataset,
  ERROR_META,
  TRIAGE_META,
  TriageStatus,
  errorType,
  proxied,
} from "@/lib/types";
import { getSession, saveSession } from "@/lib/sessions";
import { useSettings } from "@/components/SettingsContext";
import { useExport } from "@/components/ExportContext";
import CanvasViewer, { CanvasViewerHandle } from "@/components/CanvasViewer";
import InfoPanel from "@/components/InfoPanel";
import Filmstrip from "@/components/Filmstrip";

const PAGE_SIZE = 1000;

export default function DatasetPage() {
  const { id } = useParams<{ id: string }>();
  const { settings } = useSettings();
  const { setExportData, clearExportData } = useExport();

  const viewH = Math.round(
    (typeof window !== "undefined" ? window.innerHeight : 780) *
      0.55 *
      settings.viewerScale
  );
  const viewWPct = Math.round((settings.viewerWidthScale ?? 1.0) * 100);

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [anns, setAnns] = useState<AnnRow[] | null>(null);
  const [classImages, setClassImages] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [errFilter, setErrFilter] = useState<"any" | "both" | "class">("any");
  const [skuSearch, setSkuSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("All");
  const [shopFilter, setShopFilter] = useState("All");
  const [imgIdSearch, setImgIdSearch] = useState("");
  const [annIdSearch, setAnnIdSearch] = useState("");
  const [showTable, setShowTable] = useState(false);
  const [topCollapsed, setTopCollapsed] = useState(false);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<AnnRow | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const viewerRef = useRef<CanvasViewerHandle>(null);
  const resumedRef = useRef(false);
  const userNavigatedRef = useRef(false);

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
    if (errFilter !== "any") {
      if (errFilter === "both") {
        f = f.filter((a) => a.wrong_group === 1);
      } else {
        f = f.filter((a) => errorType(a.wrong_group, a.wrong_class) === errFilter);
      }
    }
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

  /* Feed export data to header download button */
  useEffect(() => {
    if (dataset) setExportData(filtered, dataset.name);
    return () => clearExportData();
  }, [filtered, dataset, setExportData, clearExportData]);

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
  const rows = useMemo(() => current?.[1] ?? [], [current]);
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
    const c = { wg: 0, wc: 0 };
    for (const a of anns ?? []) {
      if (a.wrong_group) c.wg++;
      if (a.wrong_class && !a.wrong_group) c.wc++;
    }
    return c;
  }, [anns]);
  const triagedCount = useMemo(
    () => filtered.filter((a) => a.triage_status).length,
    [filtered]
  );

  /* ── Session resume ── */
  useEffect(() => {
    if (!anns || total === 0 || resumedRef.current) return;
    resumedRef.current = true;
    (async () => {
      const s = await getSession(id);
      if (
        s &&
        s.image_index > 0 &&
        s.image_index < total &&
        !userNavigatedRef.current
      ) {
        setIdx(s.image_index);
        setToast(`Resumed at image ${s.image_index + 1} of ${total}`);
        setTimeout(() => setToast(null), 3200);
      }
    })();
  }, [anns, total, id]);

  /* ── Session save ── */
  useEffect(() => {
    if (!anns || total === 0) return;
    const t = setTimeout(() => saveSession(id, safeIdx, total), 800);
    return () => clearTimeout(t);
  }, [safeIdx, total, anns, id]);

  /* ── Preload ── */
  useEffect(() => {
    for (const off of [1, 2, 3, -1, -2]) {
      const g = imageGroups[safeIdx + off];
      if (g) new Image().src = proxied(g[1][0].url);
    }
    for (const r of rows) {
      for (const cls of [r.actual_class, r.predicted_class]) {
        for (const u of (classImages[cls ?? ""] ?? []).slice(0, 6))
          new Image().src = proxied(u);
      }
    }
  }, [safeIdx, imageGroups, rows, classImages]);

  /* ── Sticky panel ── */
  const onHover = useCallback(
    (i: number) => {
      if (i >= 0) setSelected(rows[i]);
    },
    [rows]
  );
  useEffect(() => setSelected(null), [current?.[0]]);

  /* ── Triage / remarks updates ── */
  const updateTriage = useCallback(
    async (ann: AnnRow, patch: Partial<AnnRow>) => {
      setAnns((prev) =>
        prev
          ? prev.map((a) => (a.id === ann.id ? { ...a, ...patch } : a))
          : prev
      );
      setSelected((s) => (s && s.id === ann.id ? { ...s, ...patch } : s));
      if (ann.id !== undefined) {
        await supabase
          .from("sw_annotations")
          .update({
            triage_status: patch.triage_status !== undefined ? patch.triage_status : ann.triage_status ?? null,
            remarks: patch.remarks !== undefined ? patch.remarks : ann.remarks ?? null,
          })
          .eq("id", ann.id);
      }
    },
    []
  );

  /* ── Keyboard: s prev · d reset · f next · 1-5 remarks ── */
  const goPrev = useCallback(() => {
    userNavigatedRef.current = true;
    setIdx((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    userNavigatedRef.current = true;
    setIdx((i) => Math.min(total - 1, i + 1));
  }, [total]);
  const jumpTo = useCallback((i: number) => {
    userNavigatedRef.current = true;
    setIdx(i);
  }, []);

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
      const activeAnn = selected ?? rows[0];
      if (k === "s" || k === "arrowleft") {
        e.preventDefault(); goPrev(); setFlash("s");
      } else if (k === "f" || k === "arrowright") {
        e.preventDefault(); goNext(); setFlash("f");
      } else if (k === "d") {
        e.preventDefault(); viewerRef.current?.resetZoom(); setFlash("d");
      } else if (["1", "2", "3", "4", "5"].includes(k) && activeAnn) {
        e.preventDefault();
        const statuses: TriageStatus[] = [
          "incorrectly_tagged",
          "ai_mistake",
          "visibility_issues",
          "sku_partially_visible",
          "ambiguous",
        ];
        const status = statuses[Number(k) - 1];
        updateTriage(activeAnn, {
          triage_status: activeAnn.triage_status === status ? null : status,
        });
        setFlash(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, selected, rows, updateTriage]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 200);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    setIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errFilter, skuSearch, dateFilter, shopFilter, imgIdSearch, annIdSearch]);

  const activeAnn = selected ?? rows[0];

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
        <div className="skeleton rounded-xl" style={{ height: viewH }} />
      </div>
    );

  return (
    <div>
      {/* ── Resume toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-white shadow-pop"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Breadcrumb + shortcuts + collapse toggle ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px]">
          <Link href="/" className="text-mute transition-colors hover:text-brand">
            Datasets
          </Link>
          <span className="text-line">/</span>
          <span className="font-semibold text-ink">{dataset.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setTopCollapsed((c) => !c)}
            className="rounded-lg border border-line bg-paper px-3 py-1 text-[11px] font-semibold text-ink shadow-card transition-colors hover:border-[var(--color-brand)]"
          >
            {topCollapsed ? "Show Filters & Metrics ↓" : "Hide Filters & Metrics ↑"}
          </button>
          <div className="hidden sm:flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-mute">
            <Cap k="s" flash={flash} /> prev
            <Cap k="d" flash={flash} /> 100%
            <Cap k="f" flash={flash} /> next
            <span className="mx-1 text-line">|</span>
            <Cap k="1" flash={flash} /><Cap k="2" flash={flash} /><Cap k="3" flash={flash} /><Cap k="4" flash={flash} /><Cap k="5" flash={flash} /> remarks
          </div>
        </div>
      </div>

      {/* ── Collapsible Top Section (Metrics + Filters) ── */}
      <AnimatePresence initial={false}>
        {!topCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {/* ── Metrics ── */}
            <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-5">
              <Metric label="Total annotations" value={dataset.total_rows} delay={0} />
              <Metric label="Total errors" value={dataset.error_rows} accent delay={0.05} />
              <Metric label="Filtered errors" value={filtered.length} accent delay={0.1} />
              <Metric label="Matched images" value={total} delay={0.15} />
              <Metric
                label="Triaged"
                value={triagedCount}
                suffix={filtered.length ? ` / ${filtered.length.toLocaleString()}` : ""}
                delay={0.2}
              />
            </div>

            {/* ── Filters ── */}
            <div className="mb-4 rounded-xl border border-line bg-wash p-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <div>
                  <label className="field-label">
                    Error type ({counts.wg.toLocaleString()} / {counts.wc.toLocaleString()})
                  </label>
                  <select className="field" value={errFilter} onChange={(e) => setErrFilter(e.target.value as typeof errFilter)}>
                    <option value="any">Any error</option>
                    <option value="both">Wrong group</option>
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
          </motion.div>
        )}
      </AnimatePresence>

      {total === 0 ? (
        <div className="rounded-xl border border-err-group/30 bg-err-group/5 p-6 text-center">
          <p className="text-[14px] font-semibold">No images match the current filters</p>
          <p className="mt-1 text-[13px] text-mute">
            This dataset has {counts.wg.toLocaleString()} WG and {counts.wc.toLocaleString()} WC-only errors — adjust the filters above.
          </p>
        </div>
      ) : (
        <>
          {/* ── Navigation ── */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button className="btn" disabled={safeIdx === 0} onClick={() => jumpTo(0)} title="First image">⏮</button>
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
                  if (Number.isFinite(v)) jumpTo(Math.min(Math.max(1, v), total) - 1);
                }}
                className="field w-20 text-center font-mono font-semibold"
              />
              <span className="text-[12px] font-medium text-mute">of {total.toLocaleString()}</span>
            </div>
            <button className="btn" disabled={safeIdx >= total - 1} onClick={() => jumpTo(total - 1)} title="Last image">⏭</button>

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
              className="mb-3 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill>{first.shop_name ?? "—"}</Pill>
                <Pill>{first.category_name ?? "—"}</Pill>
                <Pill>{first.visit_date ?? "—"}</Pill>
                <Pill mono>ID {current[0]}</Pill>
                <Pill accent>{rows.length} error annotation{rows.length !== 1 && "s"}</Pill>
                {rows.every((r) => r.triage_status) && (
                  <Pill green>✓ fully triaged</Pill>
                )}
              </div>
              {first.annotated_image_link && (
                <a
                  href={first.annotated_image_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] font-semibold text-[var(--color-brand)] transition-opacity hover:opacity-70"
                >
                  Open in ShelfWatch viewer ↗
                </a>
              )}
            </motion.div>
          )}

          {/* ── Horizontal Remarks Bar directly above Viewer ── */}
          {activeAnn && (
            <motion.div
              key={activeAnn.id ?? activeAnn.annotation_id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-2.5 shadow-card"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-mute">
                  Remarks:
                </span>
                <span className="rounded bg-wash px-2 py-0.5 font-mono text-[11px] font-bold text-ink">
                  {activeAnn.annotation_id ? `#${activeAnn.annotation_id}` : `Box 1 of ${rows.length}`}
                </span>
                {rows.length > 1 && !selected && (
                  <span className="text-[11px] text-mute italic">
                    (click box on image to switch box)
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ["incorrectly_tagged", "1. Incorrectly Tagged"],
                    ["ai_mistake", "2. AI mistake"],
                    ["visibility_issues", "3. Visibility issues"],
                    ["sku_partially_visible", "4. SKU partially visible"],
                    ["ambiguous", "5. Ambiguous"],
                  ] as const
                ).map(([key, label]) => {
                  const active = activeAnn.triage_status === key;
                  const meta = TRIAGE_META[key];
                  return (
                    <button
                      key={key}
                      onClick={() =>
                        updateTriage(activeAnn, {
                          triage_status: active ? null : key,
                        })
                      }
                      className={`btn h-7 px-2.5 text-[11px] font-semibold transition-all ${
                        active
                          ? "!border-transparent !text-white shadow-card scale-[1.03]"
                          : "hover:border-ink/40 text-soot"
                      }`}
                      style={active ? { background: meta.hex } : undefined}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Stage + panel ── */}
          <div className="flex flex-col gap-3 lg:flex-row overflow-x-auto">
            <div
              className="min-w-0 transition-all duration-200"
              style={{ width: viewWPct === 100 ? "100%" : `${viewWPct}%`, flex: viewWPct === 100 ? "1 1 0%" : "none" }}
            >
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
                    height={viewH}
                    onHover={onHover}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <InfoPanel
              ann={selected}
              classImages={classImages}
              hasClassInfo={dataset.has_class_info}
              height={viewH}
              onTriage={updateTriage}
            />
          </div>

          {/* ── Filmstrip ── */}
          <Filmstrip groups={imageGroups} idx={safeIdx} onJump={jumpTo} />

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
                          {["Annotation ID","Actual group","Predicted group","Actual class","Predicted class","WG","WC","Status","Remarks"].map((h) => (
                            <th key={h} className="whitespace-nowrap border-b border-line px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-mute">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const et = errorType(r.wrong_group, r.wrong_class);
                          const isSel = selected?.id !== undefined && selected.id === r.id;
                          return (
                            <tr
                              key={r.annotation_id ?? i}
                              onClick={() => setSelected(r)}
                              className={`border-b border-line/60 transition-colors last:border-0 cursor-pointer ${
                                isSel ? "bg-brand-soft" : "hover:bg-wash"
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
                              <td className="px-3 py-2">
                                {r.triage_status && TRIAGE_META[r.triage_status] ? (
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                    style={{ background: TRIAGE_META[r.triage_status].hex }}
                                  >
                                    {TRIAGE_META[r.triage_status].label}
                                  </span>
                                ) : (
                                  <span className="text-mute">—</span>
                                )}
                              </td>
                              <td className="max-w-[220px] truncate px-3 py-2 text-soot" title={r.remarks ?? ""}>
                                {r.remarks ?? "—"}
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

function Cap({ k, flash }: { k: string; flash: string | null }) {
  return (
    <span className={`keycap transition-all ${flash === k ? "!border-brand !text-brand scale-110" : ""}`}>
      {k}
    </span>
  );
}

function Metric({
  label,
  value,
  suffix = "",
  accent,
  delay,
}: {
  label: string;
  value: number;
  suffix?: string;
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
        {suffix && <span className="text-[13px] text-mute">{suffix}</span>}
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
  green,
  mono,
}: {
  children: React.ReactNode;
  accent?: boolean;
  green?: boolean;
  mono?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[12px] font-medium ${
        accent
          ? "bg-brand-soft font-semibold text-[var(--color-brand)]"
          : green
          ? "bg-emerald-50 font-semibold text-emerald-700"
          : "bg-wash text-soot"
      } ${mono ? "font-mono" : ""}`}
    >
      {children}
    </span>
  );
}
