import asyncio, sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import streamlit as st
import streamlit.components.v1 as components
import pandas as pd
from PIL import Image
import requests, base64, json
from io import BytesIO

st.set_page_config(
    page_title="ShelfWatch · Error Portal",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

[data-testid="stAppViewContainer"] { background: #fff; }
[data-testid="stSidebar"] { display: none; }
[data-testid="collapsedControl"] { display: none; }
#MainMenu, footer { visibility: hidden; }
[data-testid="stHeader"] { background: transparent; height: 0; min-height: 0; }
[data-testid="stDecoration"] { display: none; }

/* remove default top padding from main block */
.block-container { padding-top: 1.5rem !important; padding-bottom: 2rem !important; }

/* ── Top bar ── */
.sw-topbar {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid #f0f0f0; padding-bottom: 14px; margin-bottom: 20px;
}
.sw-logo-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: #E8501A;
}
.sw-logo-title {
    font-size: 20px; font-weight: 700; color: #111; margin-top: 1px;
}

/* ── Upload zone ── */
.sw-upload-wrap {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 48px 24px; text-align: center;
    border: 2px dashed #e8e8e8; border-radius: 14px; background: #fafafa;
    margin: 40px auto; max-width: 520px;
}
.sw-upload-icon { font-size: 36px; margin-bottom: 12px; }
.sw-upload-title { font-size: 20px; font-weight: 600; color: #111; margin-bottom: 6px; }
.sw-upload-sub { font-size: 13px; color: #aaa; line-height: 1.6; }

/* ── Filter bar ── */
.sw-filter-bar {
    background: #fafafa; border: 1px solid #f0f0f0;
    border-radius: 10px; padding: 14px 18px; margin-bottom: 18px;
}
.sw-filter-title {
    font-size: 11px; font-weight: 700; letter-spacing: 0.07em;
    text-transform: uppercase; color: #bbb; margin-bottom: 10px;
}

/* ── Metrics ── */
.sw-metrics {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 10px; margin-bottom: 18px;
}
.sw-card {
    background: #fff; border: 1px solid #f0f0f0;
    border-radius: 10px; padding: 14px 18px;
    border-left: 3px solid #E8501A;
}
.sw-card-val { font-size: 24px; font-weight: 700; color: #111; line-height: 1; margin-bottom: 3px; }
.sw-card-val.red { color: #D22323; }
.sw-card-lbl { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #bbb; }

/* ── Legend ── */
.sw-legend {
    display: flex; gap: 18px; align-items: center;
    font-size: 12px; color: #555; margin-bottom: 10px; flex-wrap: wrap;
}
.sw-legend-dot {
    display: inline-block; width: 10px; height: 10px;
    border-radius: 2px; margin-right: 5px; vertical-align: middle;
}

/* ── Meta pills ── */
.sw-meta { display: flex; flex-wrap: wrap; gap: 7px; margin: 10px 0 14px 0; }
.sw-pill {
    background: #f6f6f6; border-radius: 20px;
    padding: 3px 11px; font-size: 12px; color: #555; font-weight: 500;
}
.sw-pill.red { background: #fff2f0; color: #D22323; font-weight: 600; }

/* ── Nav buttons ── */
.stButton > button {
    background: #fff !important; border: 1px solid #e8e8e8 !important;
    border-radius: 7px !important; color: #333 !important;
    font-size: 13px !important; font-weight: 500 !important;
    padding: 0.3rem 0.7rem !important; transition: all 0.12s !important;
}
.stButton > button:hover { border-color: #E8501A !important; color: #E8501A !important; }
.stButton > button:disabled { opacity: 0.3 !important; }

/* ── Number input ── */
[data-testid="stNumberInput"] input {
    text-align: center; font-weight: 600; font-size: 14px;
    border-color: #E8501A !important;
}

/* ── Expander ── */
[data-testid="stExpander"] { border: 1px solid #f0f0f0 !important; border-radius: 8px !important; }

/* ── Selectbox / text input labels ── */
label { font-size: 11px !important; font-weight: 600 !important;
    letter-spacing: 0.05em !important; text-transform: uppercase !important; color: #aaa !important; }

/* ── File uploader ── */
[data-testid="stFileUploader"] section {
    border: 1.5px dashed #e0e0e0 !important;
    border-radius: 10px !important; padding: 10px !important;
}
hr { border-color: #f4f4f4 !important; margin: 0.4rem 0 !important; }
</style>
""", unsafe_allow_html=True)

# ── Constants ──────────────────────────────────────────────────────────────────
LABEL_COLORS = {
    "both":  (0,   255, 0),
    "group": (34,  139, 34),
    "class": (210, 170, 0),
}
BOX_HEX = {
    "both":  "#00FF00",
    "group": "#229922",
    "class": "#D2AA00",
}
MAX_RENDER_W = 1400

# ── Helpers ────────────────────────────────────────────────────────────────────
@st.cache_data(show_spinner=False)
def load_csv(file_bytes: bytes) -> pd.DataFrame:
    df = pd.read_csv(BytesIO(file_bytes))
    df["wrong_group"] = pd.to_numeric(df.get("wrong_group", 0), errors="coerce").fillna(0).astype(int)
    df["wrong_class"]  = pd.to_numeric(df.get("wrong_class",  0), errors="coerce").fillna(0).astype(int)
    if "image_id" in df.columns:
        df["image_id"] = df["image_id"].astype(str)
    return df

@st.cache_data(show_spinner=False)
def load_class_info(file_bytes: bytes) -> dict:
    gi = pd.read_csv(BytesIO(file_bytes))
    gi = gi[gi["class_image_gcs_file_path"].notna()]
    gi = gi[["class_name","class_image_gcs_file_path"]].drop_duplicates()
    return (gi.groupby("class_name")["class_image_gcs_file_path"]
              .apply(lambda x: list(x.unique())).to_dict())

@st.cache_data(show_spinner=False)
def fetch_image(url: str) -> bytes | None:
    try:
        r = requests.get(url, timeout=14, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        r.raise_for_status()
        return r.content
    except Exception:
        return None

def error_type(wg: int, wc: int) -> str:
    if wg and wc: return "both"
    if wg:        return "group"
    return "class"

def raw_to_b64(raw: bytes):
    img = Image.open(BytesIO(raw)).convert("RGB")
    ratio = 1.0
    if img.width > MAX_RENDER_W:
        ratio = MAX_RENDER_W / img.width
        img = img.resize((MAX_RENDER_W, int(img.height * ratio)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode(), img.width, img.height, ratio

def build_annotations_json(rows: pd.DataFrame, scale: float, class_img_map: dict = {}) -> str:
    """Store coords in original image space (ix0/iy0/ix1/iy1).
    The canvas renderer handles all scaling via CSS transform.
    scale param kept for API compatibility but not applied here."""
    anns = []
    for _, r in rows.iterrows():
        et = error_type(int(r.wrong_group), int(r.wrong_class))
        anns.append({
            "ix0": float(r.x_min * scale), "iy0": float(r.y_min * scale),
            "ix1": float(r.x_max * scale), "iy1": float(r.y_max * scale),
            "type": et, "color": BOX_HEX[et],
            "tag": {"both": "WG+WC", "group": "WG", "class": "WC"}[et],
            "actual":          str(r.get("actual_class",      "") or "—"),
            "predicted":       str(r.get("predicted_class",   "") or "—"),
            "actual_group":    str(r.get("actual_group",      "") or "—"),
            "predicted_group": str(r.get("predicted_group",   "") or "—"),
            "annotation_id":   str(r.get("annotation_id",     "") or "—"),
            "actual_imgs":     class_img_map.get(str(r.get("actual_class","") or ""), [])[:6],
            "predicted_imgs":  class_img_map.get(str(r.get("predicted_class","") or ""), [])[:6],
        })
    return json.dumps(anns)

def render_canvas(img_b64: str, img_w: int, img_h: int, anns_json: str, has_class_info: bool = False) -> None:
    VIEWPORT_W = 1060
    VIEWPORT_H = 680

    html = """
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:transparent;font-family:Inter,sans-serif;overflow:hidden}
  #vp{
    width:""" + str(VIEWPORT_W) + """px;height:""" + str(VIEWPORT_H) + """px;
    background:#111;border-radius:10px;
    border:1px solid #e0e0e0;
    overflow:hidden;position:relative;
    cursor:grab;user-select:none;
  }
  #vp.dragging{cursor:grabbing}
  #c{position:absolute;top:0;left:0;image-rendering:pixelated}
  #hint{
    position:absolute;bottom:10px;right:12px;
    font-size:11px;color:rgba(255,255,255,.4);
    font-weight:500;pointer-events:none;font-family:Inter,sans-serif;
  }
  #zoomlvl{
    position:absolute;top:10px;right:12px;
    font-size:11px;font-weight:700;color:rgba(255,255,255,.7);
    font-family:Inter,sans-serif;pointer-events:none;
    background:rgba(0,0,0,.4);padding:3px 8px;border-radius:5px;
  }
  #zp{position:fixed;display:none;width:260px;height:260px;border-radius:10px;
      border:2px solid #E8501A;background:#111;overflow:hidden;pointer-events:none;
      z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.3)}
  #zp canvas{position:absolute;top:0;left:0}
  #tt{position:fixed;display:none;background:rgba(12,12,12,.93);color:#fff;
      font-size:12px;line-height:1.55;padding:8px 12px;border-radius:7px;
      pointer-events:none;z-index:10000;max-width:260px;border-left:3px solid #E8501A}
  .tt-type{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#E8501A;margin-bottom:4px}
  .tt-row{color:#ccc;margin-bottom:2px}
  .tt-row b{color:#fff}
  /* ── Info panel (right of viewport) ── */
  #sw-root{display:flex;gap:12px;align-items:flex-start}
  #sw-panel{width:300px;flex-shrink:0;background:#fff;border:1px solid #f0f0f0;
    border-radius:10px;overflow:hidden;height:""" + str(VIEWPORT_H) + """px;
    display:flex;flex-direction:column;font-family:Inter,sans-serif}
  #sw-empty{display:flex;flex-direction:column;align-items:center;
    justify-content:center;height:100%;color:#ccc;font-size:13px;
    text-align:center;padding:24px;line-height:1.6}
  #sw-content{display:none;flex-direction:column;height:100%;overflow:hidden}
  #sw-annid{background:#fff8f0;border-bottom:1px solid #f5e8d0;padding:7px 12px;
    font-size:10px;font-weight:700;color:#E8501A;letter-spacing:.06em;
    text-transform:uppercase;flex-shrink:0}
  #sw-annid span{font-weight:400;color:#999;margin-left:5px;font-size:10px}
  #sw-errbanner{padding:7px 12px;font-size:10px;font-weight:700;letter-spacing:.07em;
    text-transform:uppercase;flex-shrink:0;border-bottom:1px solid #f0f0f0}
  #sw-text{padding:9px 12px;font-size:11px;line-height:1.6;color:#555;
    border-bottom:1px solid #f0f0f0;flex-shrink:0}
  #sw-text b{color:#111;font-weight:600}
  #sw-text .grp{font-size:10px;color:#aaa;margin-top:2px}
  #sw-imgs{flex:1;overflow-y:auto;padding:9px 12px}
  .sw-isl{font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
    color:#bbb;margin-bottom:6px;margin-top:9px}
  .sw-isl:first-child{margin-top:0}
  .sw-isw{display:flex;flex-wrap:wrap;gap:5px}
  .sw-isw img{height:72px;width:auto;max-width:120px;border-radius:5px;
    border:1.5px solid #f0f0f0;object-fit:contain;background:#fafafa}
  .sw-isw img:hover{border-color:#E8501A}
  .sw-noimgs{font-size:11px;color:#ccc;font-style:italic}
</style>
<div id="sw-root">
<div id="vp">
  <canvas id="c"></canvas>
  <div id="hint">scroll to zoom &nbsp;·&nbsp; drag to pan</div>
  <div id="zoomlvl">100%</div>
</div>
<div id="sw-panel">
  <div id="sw-empty"><div style="font-size:26px;margin-bottom:8px">👆</div>Hover over an annotation<br>to see details</div>
  <div id="sw-content">
    <div id="sw-annid">Annotation ID<span id="sw-ann-val">—</span></div>
    <div id="sw-errbanner"></div>
    <div id="sw-text"></div>
    <div id="sw-imgs"></div>
  </div>
</div>
</div>
<div id="zp"><canvas id="zc" width="260" height="260"></canvas></div>
<div id="tt"></div>
<script>
var IMG_B64=""" + f'"{img_b64}"' + """;
var ANNS_RAW=""" + anns_json + """;
var IMG_W=""" + str(img_w) + """;
var IMG_H=""" + str(img_h) + """;
var VW=""" + str(VIEWPORT_W) + """;
var VH=""" + str(VIEWPORT_H) + """;

// Convert ANNS coords (stored in scaled space) back to image space
// build_annotations_json applies coord_scale, so we need to undo that
// Actually we'll store raw image coords — see build_annotations_json note below
var ANNS = ANNS_RAW;
var HAS_CLASS_INFO=""" + ('true' if has_class_info else 'false') + """;

function updatePanel(hi){
  var empty=document.getElementById('sw-empty');
  var content=document.getElementById('sw-content');
  if(hi===-1){empty.style.display='flex';content.style.display='none';return;}
  empty.style.display='none';content.style.display='flex';
  var a=ANNS[hi];
  document.getElementById('sw-ann-val').textContent=a.annotation_id||'—';
  var b=document.getElementById('sw-errbanner');
  var isWG=(a.type==='both');
  b.style.background=isWG?'#f0fff0':'#fffbe6';
  b.style.color=isWG?'#1a7a1a':'#8a6d00';
  b.style.borderBottom='1px solid '+(isWG?'#c8efc8':'#ffe58f');
  b.textContent=isWG?'Wrong group':'Wrong class';
  document.getElementById('sw-text').innerHTML=
    '<b>Actual:</b> '+a.actual+'<br><b>Predicted:</b> '+a.predicted+
    '<div class="grp">GT: '+a.actual_group+' &nbsp;·&nbsp; Pred: '+a.predicted_group+'</div>';
  if(!HAS_CLASS_INFO){document.getElementById('sw-imgs').innerHTML='';return;}
  var sec=document.getElementById('sw-imgs'),h='';
  h+='<div class="sw-isl">Actual — '+a.actual+'</div><div class="sw-isw">';
  if(a.actual_imgs&&a.actual_imgs.length)
    a.actual_imgs.forEach(function(u){h+='<img src="'+u+'" loading="lazy" onerror="this.remove()">'; });
  else h+='<span class="sw-noimgs">No reference images</span>';
  h+='</div><div class="sw-isl">Predicted — '+a.predicted+'</div><div class="sw-isw">';
  if(a.predicted_imgs&&a.predicted_imgs.length)
    a.predicted_imgs.forEach(function(u){h+='<img src="'+u+'" loading="lazy" onerror="this.remove()">'; });
  else h+='<span class="sw-noimgs">No reference images</span>';
  h+='</div>';
  sec.innerHTML=h;
}

var scale, offX, offY;
var dragStart=null, dragOff=null, hitIdx=-1;
var vp=document.getElementById('vp');
var cv=document.getElementById('c');
var ctx=cv.getContext('2d');
var zp=document.getElementById('zp');
var zc=document.getElementById('zc');
var zx=zc.getContext('2d');
var tt=document.getElementById('tt');
var zoomlvl=document.getElementById('zoomlvl');

var im=new Image();
im.onload=function(){
  var fitS=Math.min(VW/IMG_W, VH/IMG_H);
  scale=fitS;
  offX=(VW-IMG_W*scale)/2;
  offY=(VH-IMG_H*scale)/2;
  cv.width=IMG_W; cv.height=IMG_H;
  redraw(-1);
};
im.src="data:image/jpeg;base64,"+IMG_B64;

function redraw(hi){
  cv.style.width=(IMG_W*scale)+'px';
  cv.style.height=(IMG_H*scale)+'px';
  cv.style.transform='translate('+offX+'px,'+offY+'px)';
  ctx.clearRect(0,0,IMG_W,IMG_H);
  ctx.drawImage(im,0,0,IMG_W,IMG_H);
  var lw=(2/scale);
  ANNS.forEach(function(a,i){
    var alpha=(hi===-1||i===hi)?1:0.3;
    ctx.globalAlpha=alpha;
    ctx.fillStyle=a.color+'25';
    ctx.fillRect(a.ix0,a.iy0,a.ix1-a.ix0,a.iy1-a.iy0);
    ctx.strokeStyle=a.color;
    ctx.lineWidth=(i===hi?3:2)/scale;
    ctx.strokeRect(a.ix0,a.iy0,a.ix1-a.ix0,a.iy1-a.iy0);
    var fs=Math.max(9,Math.round(11/scale));
    ctx.font='bold '+fs+'px Inter,sans-serif';
    var tw=ctx.measureText(a.tag).width;
    var tagH=(fs+5)/scale;
    ctx.fillStyle=a.color;
    ctx.fillRect(a.ix0,a.iy0-tagH,tw+8/scale,tagH);
    ctx.fillStyle='#fff';
    ctx.fillText(a.tag,a.ix0+4/scale,a.iy0-3/scale);
    ctx.globalAlpha=1;
  });
  var fitS=Math.min(VW/IMG_W,VH/IMG_H);
  zoomlvl.textContent=Math.round(scale/fitS*100)+'%';
}

function screenToImg(ex,ey){
  var r=vp.getBoundingClientRect();
  return {x:(ex-r.left-offX)/scale, y:(ey-r.top-offY)/scale};
}

function hitTest(ex,ey){
  var p=screenToImg(ex,ey);
  for(var i=ANNS.length-1;i>=0;i--){
    var a=ANNS[i];
    if(p.x>=a.ix0&&p.x<=a.ix1&&p.y>=a.iy0&&p.y<=a.iy1) return i;
  }
  return -1;
}

vp.addEventListener('wheel',function(e){
  e.preventDefault();
  var r=vp.getBoundingClientRect();
  var mx=e.clientX-r.left, my=e.clientY-r.top;
  var factor=e.deltaY<0?1.12:1/1.12;
  var fitS=Math.min(VW/IMG_W,VH/IMG_H);
  var newS=Math.min(Math.max(scale*factor,fitS*0.4),fitS*12);
  offX=mx-(mx-offX)*(newS/scale);
  offY=my-(my-offY)*(newS/scale);
  scale=newS;
  redraw(hitIdx);
},{passive:false});

vp.addEventListener('mousedown',function(e){
  dragStart={x:e.clientX,y:e.clientY};
  dragOff={x:offX,y:offY};
  vp.classList.add('dragging');
});

window.addEventListener('mousemove',function(e){
  if(dragStart){
    offX=dragOff.x+(e.clientX-dragStart.x);
    offY=dragOff.y+(e.clientY-dragStart.y);
    redraw(-1);
    return;
  }
  var hi=hitTest(e.clientX,e.clientY);
  if(hi!==hitIdx){hitIdx=hi;redraw(hi);updatePanel(hi);}
  if(hi===-1){
    zp.style.display='none';tt.style.display='none';
    vp.style.cursor='grab';return;
  }
  vp.style.cursor='pointer';
  var a=ANNS[hi];

  // Zoom panel: snapshot the visible viewport region around the annotation
  var snap=document.createElement('canvas');
  snap.width=VW; snap.height=VH;
  var sCtx=snap.getContext('2d');
  sCtx.drawImage(cv,0,0,IMG_W,IMG_H,offX,offY,IMG_W*scale,IMG_H*scale);

  var cx0=offX+a.ix0*scale, cy0=offY+a.iy0*scale;
  var cw=(a.ix1-a.ix0)*scale, ch=(a.iy1-a.iy0)*scale;
  var padX=Math.max(cw*0.7,40), padY=Math.max(ch*0.7,40);
  var sx=Math.max(0,cx0-padX), sy=Math.max(0,cy0-padY);
  var sw=Math.min(VW-sx,cw+padX*2), sh=Math.min(VH-sy,ch+padY*2);

  zx.fillStyle='#111'; zx.fillRect(0,0,260,260);
  var zs=Math.min(260/sw,260/sh);
  var dw=sw*zs, dh=sh*zs, dx=(260-dw)/2, dy=(260-dh)/2;
  zx.drawImage(snap,sx,sy,sw,sh,dx,dy,dw,dh);
  var bx=dx+(cx0-sx)*zs, by=dy+(cy0-sy)*zs;
  zx.strokeStyle=a.color; zx.lineWidth=2;
  zx.strokeRect(bx,by,cw*zs,ch*zs);

  var zpx=e.clientX+18, zpy=e.clientY-278;
  if(zpx+270>window.innerWidth) zpx=e.clientX-278;
  if(zpy<8) zpy=e.clientY+18;
  zp.style.left=zpx+'px'; zp.style.top=zpy+'px'; zp.style.display='block';

  var lbl={both:'Wrong group + class',group:'Wrong group only',class:'Wrong class only'}[a.type];
  tt.innerHTML='<div class="tt-type">'+lbl+'</div>'
    +'<div class="tt-row"><b>Actual:</b> '+a.actual+'</div>'
    +'<div class="tt-row"><b>Predicted:</b> '+a.predicted+'</div>'
    +'<div class="tt-row" style="margin-top:4px;color:#999">GT group: '+a.actual_group+'</div>'
    +'<div class="tt-row" style="color:#999">Pred group: '+a.predicted_group+'</div>';
  var ttx=e.clientX+18, tty=zpy+268;
  if(ttx+270>window.innerWidth) ttx=e.clientX-278;
  tt.style.left=ttx+'px'; tt.style.top=tty+'px'; tt.style.display='block';
});

window.addEventListener('mouseup',function(){
  dragStart=null; dragOff=null;
  vp.classList.remove('dragging');
});

vp.addEventListener('mouseleave',function(){
  hitIdx=-1;
  zp.style.display='none'; tt.style.display='none';
  redraw(-1);updatePanel(-1);
});
</script>
"""
    components.html(html, height=VIEWPORT_H + 16, width=VIEWPORT_W + 12 + 300, scrolling=False)

def render_annotation_table(rows: pd.DataFrame):
    cols = [c for c in ["annotation_id","actual_group","predicted_group",
                         "actual_class","predicted_class","wrong_group","wrong_class",
                         "self/comp_actual","self/comp_predicted"] if c in rows.columns]
    def style_row(r):
        s = [""]*len(r); idx=list(r.index)
        for k in ["wrong_group","wrong_class"]:
            if k in idx and r[k]==1:
                s[idx.index(k)]="background:#fff2f0;color:#D22323;font-weight:600"
        return s
    st.dataframe(rows[cols].style.apply(style_row,axis=1),
                 use_container_width=True, hide_index=True,
                 height=min(240, 40+len(rows)*40))


# ══════════════════════════════════════════════════════════════════════════════
# TOP BAR
# ══════════════════════════════════════════════════════════════════════════════
st.markdown("""
<div class="sw-topbar">
  <div>
    <div class="sw-logo-label">ParallelDots · ShelfWatch</div>
    <div class="sw-logo-title">Error Annotation Portal</div>
  </div>
  <div class="sw-legend">
    <span><span class="sw-legend-dot" style="background:#00FF00"></span>WG+WC — wrong group + class</span>
    <span><span class="sw-legend-dot" style="background:#229922"></span>WG — wrong group only</span>
    <span><span class="sw-legend-dot" style="background:#D2AA00"></span>WC — wrong class only</span>
  </div>
</div>
""", unsafe_allow_html=True)

# ══════════════════════════════════════════════════════════════════════════════
# FILE UPLOAD — always visible on main page
# ══════════════════════════════════════════════════════════════════════════════
_c1, _c2 = st.columns([3, 2])
with _c1:
    uploaded = st.file_uploader(
        "Upload df_out CSV (required)",
        type=["csv"],
        label_visibility="visible",
    )
with _c2:
    class_info_file = st.file_uploader(
        "Group/class info CSV (optional — SKU images on hover)",
        type=["csv"],
        label_visibility="visible",
    )

if not uploaded:
    st.markdown("""
    <div class="sw-upload-wrap">
      <div class="sw-upload-icon">📦</div>
      <div class="sw-upload-title">Drop your CSV above to begin</div>
      <div class="sw-upload-sub">
        Upload the ShelfWatch <code>df_out</code> CSV.<br>
        The portal shows one image at a time with bounding boxes<br>
        on every error annotation and interactive hover zoom.
      </div>
    </div>
    """, unsafe_allow_html=True)
    st.stop()

# ══════════════════════════════════════════════════════════════════════════════
# DATA LOAD
# ══════════════════════════════════════════════════════════════════════════════
df = load_csv(uploaded.read())
total_rows = len(df)

# Optional class info CSV
class_img_map = {}
has_class_info = False
if class_info_file is not None:
    class_img_map = load_class_info(class_info_file.read())
    has_class_info = True

errors = df[
    ((df["wrong_group"] == 1) | (df["wrong_class"] == 1)) &
    (df["annotation_type"].str.upper() == "SKU")
].copy()

n_both  = int(((errors.wrong_group==1) & (errors.wrong_class==1)).sum())
n_class = int(((errors.wrong_group==0) & (errors.wrong_class==1)).sum())

# ══════════════════════════════════════════════════════════════════════════════
# FILTER BAR — inline on main page
# ══════════════════════════════════════════════════════════════════════════════
with st.expander("🔽  Filters & display options", expanded=True):
    fc1, fc2, fc3, fc4, fc5, fc6 = st.columns([2, 2, 1.8, 1.8, 1.8, 1.5])
    with fc1:
        error_filter = st.selectbox(
            f"Error type  (🔴{n_both:,} / 🟡{n_class:,})",
            ["Any error", "Wrong group", "Wrong class only"]
        )
    with fc2:
        sku_search = st.text_input("SKU name", placeholder="Search actual or predicted…")
    with fc3:
        date_vals = ["All"] + sorted(errors["Date"].dropna().unique().tolist()) if "Date" in errors.columns else ["All"]
        date_filter = st.selectbox("Date", date_vals)
    with fc4:
        shops = ["All"] + sorted(errors["Shop Name"].dropna().unique().tolist())
        shop_filter = st.selectbox("Shop", shops)
    with fc5:
        img_id_search = st.text_input("Image ID", placeholder="e.g. 113353766")
    with fc6:
        ann_id_search = st.text_input("Annotation ID", placeholder="e.g. 4480908741")

    d1, d2 = st.columns([1, 4])
    with d1:
        show_table = st.toggle("Annotation table", value=True)

# ══════════════════════════════════════════════════════════════════════════════
# APPLY FILTERS
# ══════════════════════════════════════════════════════════════════════════════
filt = errors.copy()
if error_filter == "Wrong group":
    filt = filt[(filt.wrong_group==1) & (filt.wrong_class==1)]
elif error_filter == "Wrong class only":
    filt = filt[(filt.wrong_group==0) & (filt.wrong_class==1)]

if sku_search.strip():
    q = sku_search.strip().lower()
    mask = (
        filt["actual_class"].fillna("").str.lower().str.contains(q, regex=False) |
        filt["predicted_class"].fillna("").str.lower().str.contains(q, regex=False) |
        filt["actual_group"].fillna("").str.lower().str.contains(q, regex=False) |
        filt["predicted_group"].fillna("").str.lower().str.contains(q, regex=False)
    )
    filt = filt[mask]

if date_filter != "All":
    filt = filt[filt["Date"] == date_filter]
if shop_filter != "All":
    filt = filt[filt["Shop Name"] == shop_filter]
if img_id_search.strip():
    filt = filt[filt["image_id"].astype(str).str.contains(img_id_search.strip(), regex=False)]
if ann_id_search.strip():
    filt = filt[filt["annotation_id"].astype(str).str.contains(ann_id_search.strip(), regex=False)]

img_groups   = filt.groupby("image_id", sort=False)
group_keys   = list(img_groups.groups.keys())
total_images = len(group_keys)

# ══════════════════════════════════════════════════════════════════════════════
# METRICS
# ══════════════════════════════════════════════════════════════════════════════
st.markdown(f"""
<div class="sw-metrics">
  <div class="sw-card">
    <div class="sw-card-val">{total_rows:,}</div>
    <div class="sw-card-lbl">Total annotations</div>
  </div>
  <div class="sw-card">
    <div class="sw-card-val red">{len(errors):,}</div>
    <div class="sw-card-lbl">Total errors</div>
  </div>
  <div class="sw-card">
    <div class="sw-card-val red">{len(filt):,}</div>
    <div class="sw-card-lbl">Filtered errors</div>
  </div>
  <div class="sw-card">
    <div class="sw-card-val">{total_images:,}</div>
    <div class="sw-card-lbl">Matched images</div>
  </div>
</div>
""", unsafe_allow_html=True)

if not group_keys:
    st.markdown(f"""
    <div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:10px;padding:18px 22px;margin:4px 0">
      <div style="font-size:15px;font-weight:600;color:#333;margin-bottom:6px">No images match the current filters</div>
      <div style="font-size:13px;color:#666;line-height:1.9">
        Breakdown in this dataset:<br>
        🔴 Wrong group: <b>{n_both:,}</b> &nbsp;·&nbsp;
        🟡 Wrong class only: <b>{n_class:,}</b><br>
        Adjust the error type, SKU name, date, shop, or image ID filters above.
      </div>
    </div>
    """, unsafe_allow_html=True)
    st.stop()

# ══════════════════════════════════════════════════════════════════════════════
# SESSION STATE
# ══════════════════════════════════════════════════════════════════════════════
if "img_idx" not in st.session_state:
    st.session_state.img_idx = 0
st.session_state.img_idx = min(st.session_state.img_idx, total_images - 1)
idx = st.session_state.img_idx

# ══════════════════════════════════════════════════════════════════════════════
# NAVIGATION
# ══════════════════════════════════════════════════════════════════════════════
n1, n2, n3, n4, n5, n6 = st.columns([1, 1, 1, 2.5, 1, 1])
with n1:
    if st.button("⏮", use_container_width=True, disabled=(idx==0), help="First image"):
        st.session_state.img_idx = 0; st.rerun()
with n2:
    if st.button("← Prev", use_container_width=True, disabled=(idx==0)):
        st.session_state.img_idx -= 1; st.rerun()
with n3:
    if st.button("Next →", use_container_width=True, disabled=(idx>=total_images-1)):
        st.session_state.img_idx += 1; st.rerun()
with n4:
    jump = st.number_input("jump", min_value=1, max_value=total_images,
                            value=idx+1, step=1, label_visibility="collapsed")
    if int(jump)-1 != idx:
        st.session_state.img_idx = int(jump)-1; st.rerun()
    st.markdown(
        f'<p style="text-align:center;font-size:12px;color:#bbb;margin-top:2px;font-weight:500">'
        f'Image {idx+1} of {total_images}</p>', unsafe_allow_html=True)
with n5:
    if st.button("Last ⏭", use_container_width=True, disabled=(idx>=total_images-1)):
        st.session_state.img_idx = total_images-1; st.rerun()
with n6:
    st.markdown(
        f'<div style="font-size:12px;color:#bbb;font-weight:500;padding-top:8px;text-align:center">'
        f'{idx+1} / {total_images}</div>', unsafe_allow_html=True)

st.markdown("<div style='height:4px'></div>", unsafe_allow_html=True)

# ══════════════════════════════════════════════════════════════════════════════
# CURRENT IMAGE
# ══════════════════════════════════════════════════════════════════════════════
img_id   = group_keys[idx]
rows     = img_groups.get_group(img_id)
first    = rows.iloc[0]
img_url  = first["url"]
shop     = first.get("Shop Name", "—")
category = first.get("Category Name", "—")
date     = first.get("Date", "—")
n_errors = len(rows)

st.markdown(f"""
<div class="sw-meta">
  <span class="sw-pill">{shop}</span>
  <span class="sw-pill">{category}</span>
  <span class="sw-pill">{date}</span>
  <span class="sw-pill">ID: {img_id}</span>
  <span class="sw-pill red">{n_errors} error annotation{"s" if n_errors!=1 else ""}</span>
  {'<span class="sw-pill" style="background:#f0fff0;color:#1a7a1a;font-weight:600">✓ SKU images loaded</span>' if has_class_info else ''}
</div>
<div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#ccc;margin-bottom:6px">
  Hover over a box to zoom
</div>
""", unsafe_allow_html=True)

with st.spinner("Loading image…"):
    raw = fetch_image(img_url)

if raw is None:
    st.error(f"Could not fetch image — URL may need authentication or VPN access.\n`{img_url[:120]}`")
    st.stop()

img_b64, iw, ih, img_ratio = raw_to_b64(raw)
anns_json = build_annotations_json(rows, img_ratio, class_img_map)
render_canvas(img_b64, iw, ih, anns_json, has_class_info)

# ══════════════════════════════════════════════════════════════════════════════
# ANNOTATION TABLE
# ══════════════════════════════════════════════════════════════════════════════
if show_table:
    st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
    with st.expander(f"Annotation details — {n_errors} row{'s' if n_errors!=1 else ''}", expanded=False):
        render_annotation_table(rows)
        if "annotated_image_link" in rows.columns:
            link = rows.iloc[0]["annotated_image_link"]
            if pd.notna(link):
                st.markdown(
                    f'<a href="{link}" target="_blank" style="font-size:13px;color:#E8501A;'
                    f'text-decoration:none;font-weight:600">Open in ShelfWatch viewer ↗</a>',
                    unsafe_allow_html=True)