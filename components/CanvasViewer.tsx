"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AnnRow, ERROR_META, errorType, proxied } from "@/lib/types";

export interface CanvasViewerHandle {
  /** Animate back to 100% (fit-to-viewport). Bound to the `d` key. */
  resetZoom: () => void;
}

interface Props {
  imageUrl: string;
  anns: AnnRow[];
  height?: number;
  onHover?: (index: number) => void; // -1 = nothing hovered
}

interface View {
  scale: number;
  offX: number;
  offY: number;
}

const LENS = 260;

const CanvasViewer = forwardRef<CanvasViewerHandle, Props>(
  function CanvasViewer({ imageUrl, anns, height = 660, onHover }, ref) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lensRef = useRef<HTMLDivElement>(null);
    const lensCanvasRef = useRef<HTMLCanvasElement>(null);
    const tipRef = useRef<HTMLDivElement>(null);
    const zoomBadgeRef = useRef<HTMLSpanElement>(null);

    const imgRef = useRef<HTMLImageElement | null>(null);
    const viewRef = useRef<View>({ scale: 1, offX: 0, offY: 0 });
    const fitScaleRef = useRef(1);
    const hitRef = useRef(-1);
    const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
    const animRef = useRef<number | null>(null);
    const sizeRef = useRef({ w: 1060, h: height });

    const [status, setStatus] = useState<"loading" | "ready" | "failed">(
      "loading"
    );

    const redraw = useCallback(() => {
      const cv = canvasRef.current;
      const im = imgRef.current;
      if (!cv || !im) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const { scale, offX, offY } = viewRef.current;
      const hi = hitRef.current;
      const { w: VW, h: VH } = sizeRef.current;
      const dpr = window.devicePixelRatio || 1;

      if (cv.width !== VW * dpr || cv.height !== VH * dpr) {
        cv.width = VW * dpr;
        cv.height = VH * dpr;
        cv.style.width = `${VW}px`;
        cv.style.height = `${VH}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, VW, VH);
      ctx.save();
      ctx.translate(offX, offY);
      ctx.scale(scale, scale);
      ctx.imageSmoothingEnabled = scale < 1.5;
      ctx.drawImage(im, 0, 0);

      anns.forEach((a, i) => {
        const et = errorType(a.wrong_group, a.wrong_class);
        const color = ERROR_META[et].hex;
        const dim = hi !== -1 && i !== hi;
        ctx.globalAlpha = dim ? 0.28 : 1;
        ctx.fillStyle = color + "22";
        ctx.fillRect(a.x_min, a.y_min, a.x_max - a.x_min, a.y_max - a.y_min);
        ctx.strokeStyle = color;
        ctx.lineWidth = (i === hi ? 3 : 2) / scale;
        ctx.strokeRect(a.x_min, a.y_min, a.x_max - a.x_min, a.y_max - a.y_min);
        const fs = Math.max(10, 12 / scale);
        ctx.font = `700 ${fs}px var(--font-inter), sans-serif`;
        const tag = ERROR_META[et].tag;
        const tw = ctx.measureText(tag).width;
        const th = fs * 1.45;
        ctx.fillStyle = color;
        ctx.fillRect(a.x_min, a.y_min - th, tw + fs * 0.8, th);
        ctx.fillStyle = "#fff";
        ctx.fillText(tag, a.x_min + fs * 0.4, a.y_min - fs * 0.35);
        ctx.globalAlpha = 1;
      });
      ctx.restore();

      if (zoomBadgeRef.current)
        zoomBadgeRef.current.textContent = `${Math.round(
          (scale / fitScaleRef.current) * 100
        )}%`;
    }, [anns]);

    const fitView = useCallback((): View => {
      const im = imgRef.current;
      const { w: VW, h: VH } = sizeRef.current;
      if (!im) return { scale: 1, offX: 0, offY: 0 };
      const s = Math.min(VW / im.naturalWidth, VH / im.naturalHeight);
      return {
        scale: s,
        offX: (VW - im.naturalWidth * s) / 2,
        offY: (VH - im.naturalHeight * s) / 2,
      };
    }, []);

    /* Smoothly animate the view back to fit (the `d` shortcut). */
    const resetZoom = useCallback(() => {
      const from = { ...viewRef.current };
      const to = fitView();
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const t0 = performance.now();
      const D = 260;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / D);
        const k = ease(t);
        viewRef.current = {
          scale: from.scale + (to.scale - from.scale) * k,
          offX: from.offX + (to.offX - from.offX) * k,
          offY: from.offY + (to.offY - from.offY) * k,
        };
        redraw();
        if (t < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    }, [fitView, redraw]);

    useImperativeHandle(ref, () => ({ resetZoom }), [resetZoom]);

    /* Responsive viewport measurement */
    useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        sizeRef.current = { w: el.clientWidth, h: height };
        if (status === "ready") {
          viewRef.current = fitView();
          redraw();
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [height, status, fitView, redraw]);

    /* Load image (through proxy) */
    useEffect(() => {
      setStatus("loading");
      hitRef.current = -1;
      onHover?.(-1);
      const im = new Image();
      im.onload = () => {
        imgRef.current = im;
        const el = wrapRef.current;
        if (el) sizeRef.current = { w: el.clientWidth, h: height };
        viewRef.current = fitView();
        setStatus("ready");
        requestAnimationFrame(redraw);
      };
      im.onerror = () => setStatus("failed");
      im.src = proxied(imageUrl);
      return () => {
        im.onload = null;
        im.onerror = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageUrl]);

    useEffect(() => {
      if (status === "ready") redraw();
    }, [anns, status, redraw]);

    /* ── Pointer interactions ── */
    const screenToImg = (ex: number, ey: number) => {
      const r = wrapRef.current!.getBoundingClientRect();
      const { scale, offX, offY } = viewRef.current;
      return { x: (ex - r.left - offX) / scale, y: (ey - r.top - offY) / scale };
    };

    const hitTest = (ex: number, ey: number) => {
      const p = screenToImg(ex, ey);
      for (let i = anns.length - 1; i >= 0; i--) {
        const a = anns[i];
        if (p.x >= a.x_min && p.x <= a.x_max && p.y >= a.y_min && p.y <= a.y_max)
          return i;
      }
      return -1;
    };

    const hideOverlays = () => {
      if (lensRef.current) lensRef.current.style.opacity = "0";
      if (tipRef.current) tipRef.current.style.opacity = "0";
    };

    const onWheel = useCallback((e: WheelEvent) => {
      e.preventDefault();
      const r = wrapRef.current!.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const v = viewRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const fit = fitScaleRef.current;
      const ns = Math.min(Math.max(v.scale * factor, fit * 0.4), fit * 14);
      viewRef.current = {
        scale: ns,
        offX: mx - (mx - v.offX) * (ns / v.scale),
        offY: my - (my - v.offY) * (ns / v.scale),
      };
      redraw();
    }, [redraw]);

    useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [onWheel]);

    useEffect(() => {
      fitScaleRef.current = fitView().scale;
    });

    const onMouseMove = (e: React.MouseEvent) => {
      if (dragRef.current) {
        const d = dragRef.current;
        viewRef.current.offX = d.ox + (e.clientX - d.sx);
        viewRef.current.offY = d.oy + (e.clientY - d.sy);
        hideOverlays();
        redraw();
        return;
      }
      const hi = hitTest(e.clientX, e.clientY);
      if (hi !== hitRef.current) {
        hitRef.current = hi;
        redraw();
        onHover?.(hi);
      }
      if (hi === -1) {
        hideOverlays();
        return;
      }
      drawLensAndTip(e.clientX, e.clientY, anns[hi]);
    };

    const drawLensAndTip = (cx: number, cy: number, a: AnnRow) => {
      const lens = lensRef.current;
      const lc = lensCanvasRef.current;
      const tip = tipRef.current;
      const im = imgRef.current;
      if (!lens || !lc || !tip || !im) return;
      const et = errorType(a.wrong_group, a.wrong_class);
      const meta = ERROR_META[et];

      // Crop the annotation + padding straight from the source image
      const bw = a.x_max - a.x_min;
      const bh = a.y_max - a.y_min;
      const padX = Math.max(bw * 0.6, 30);
      const padY = Math.max(bh * 0.6, 30);
      const sx = Math.max(0, a.x_min - padX);
      const sy = Math.max(0, a.y_min - padY);
      const sw = Math.min(im.naturalWidth - sx, bw + padX * 2);
      const sh = Math.min(im.naturalHeight - sy, bh + padY * 2);

      const zctx = lc.getContext("2d")!;
      lc.width = LENS;
      lc.height = LENS;
      zctx.fillStyle = "#0E0E11";
      zctx.fillRect(0, 0, LENS, LENS);
      const zs = Math.min(LENS / sw, LENS / sh);
      const dw = sw * zs;
      const dh = sh * zs;
      const dx = (LENS - dw) / 2;
      const dy = (LENS - dh) / 2;
      zctx.imageSmoothingEnabled = false;
      zctx.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
      zctx.strokeStyle = meta.hex;
      zctx.lineWidth = 2;
      zctx.strokeRect(dx + (a.x_min - sx) * zs, dy + (a.y_min - sy) * zs, bw * zs, bh * zs);

      let lx = cx + 20;
      let ly = cy - LENS - 18;
      if (lx + LENS + 12 > window.innerWidth) lx = cx - LENS - 20;
      if (ly < 8) ly = cy + 20;
      lens.style.transform = `translate(${lx}px, ${ly}px)`;
      lens.style.borderColor = meta.hex;
      lens.style.opacity = "1";

      tip.innerHTML =
        `<div style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${meta.hex};margin-bottom:4px">${meta.label}</div>` +
        `<div><b style="color:#fff">Actual:</b> ${a.actual_class ?? "—"}</div>` +
        `<div><b style="color:#fff">Predicted:</b> ${a.predicted_class ?? "—"}</div>` +
        `<div style="margin-top:4px;color:#8b8b93">GT group: ${a.actual_group ?? "—"}</div>` +
        `<div style="color:#8b8b93">Pred group: ${a.predicted_group ?? "—"}</div>`;
      let tx = cx + 20;
      let ty = ly + LENS + 10;
      if (tx + 280 > window.innerWidth) tx = cx - 290;
      if (ty + 130 > window.innerHeight) ty = cy - 150;
      tip.style.transform = `translate(${tx}px, ${ty}px)`;
      tip.style.borderLeftColor = meta.hex;
      tip.style.opacity = "1";
    };

    return (
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-xl border border-line bg-stage"
        style={{ height, cursor: dragRef.current ? "grabbing" : "grab" }}
        onMouseDown={(e) => {
          dragRef.current = {
            sx: e.clientX,
            sy: e.clientY,
            ox: viewRef.current.offX,
            oy: viewRef.current.offY,
          };
        }}
        onMouseUp={() => (dragRef.current = null)}
        onMouseMove={onMouseMove}
        onMouseLeave={() => {
          dragRef.current = null;
          hitRef.current = -1;
          hideOverlays();
          onHover?.(-1);
          if (status === "ready") redraw();
        }}
        onDoubleClick={resetZoom}
      >
        <canvas
          ref={canvasRef}
          className={`transition-opacity duration-300 ${
            status === "ready" ? "opacity-100" : "opacity-0"
          }`}
        />

        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/10 border-t-brand" />
          </div>
        )}
        {status === "failed" && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div>
              <p className="text-[14px] font-semibold text-white/80">
                Couldn&apos;t load this image
              </p>
              <p className="mt-1 max-w-md break-all text-[11px] text-white/40">
                The URL may need VPN access or authentication.
              </p>
            </div>
          </div>
        )}

        <span
          ref={zoomBadgeRef}
          className="absolute right-3 top-3 rounded-md bg-black/45 px-2 py-1 font-mono text-[11px] font-semibold text-white/75 backdrop-blur-sm"
        >
          100%
        </span>
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 text-[11px] text-white/40">
          scroll to zoom · drag to pan · double-click or{" "}
          <span className="keycap-dark">d</span> to reset
        </div>

        {/* Zoom lens — fixed so it can escape the stage */}
        <div
          ref={lensRef}
          className="pointer-events-none fixed left-0 top-0 z-[60] overflow-hidden rounded-xl border-2 bg-stage opacity-0 shadow-lens transition-opacity duration-100"
          style={{ width: LENS, height: LENS }}
        >
          <canvas ref={lensCanvasRef} />
        </div>
        <div
          ref={tipRef}
          className="pointer-events-none fixed left-0 top-0 z-[60] max-w-[280px] rounded-lg border-l-[3px] bg-[#101014]/95 px-3 py-2 text-[12px] leading-relaxed text-[#c8c8ce] opacity-0 shadow-pop backdrop-blur-sm transition-opacity duration-100"
        />
      </div>
    );
  }
);

export default CanvasViewer;
