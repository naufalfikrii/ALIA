"""
ALIA — Real Estate Feasibility PDF Generator
Professional multi-section report with:
  - Cover page
  - Project profile
  - Static map image (OpenStreetMap via staticmap API)
  - Location profile (from fetched data)
  - Physical analysis with amenities
  - Legal analysis table
  - Financial analysis with bar chart
  - QA scores
"""

import io
import json
import os
import urllib.request
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics import renderPDF

# ── Brand colours ─────────────────────────────────────────────────────────
GREEN_DARK   = colors.HexColor("#1a3a2a")
GREEN_MID    = colors.HexColor("#2d6a4f")
GREEN_LIGHT  = colors.HexColor("#52b788")
GREEN_PALE   = colors.HexColor("#d8f3dc")
GREEN_TINT   = colors.HexColor("#f0faf2")
AMBER        = colors.HexColor("#d97706")
RED_SOFT     = colors.HexColor("#dc2626")
GREY_LINE    = colors.HexColor("#e5e7eb")
GREY_BG      = colors.HexColor("#f9fafb")
WHITE        = colors.white
BLACK        = colors.HexColor("#111827")
TEXT_MUTED   = colors.HexColor("#6b7280")

W, H = A4  # 595.27 x 841.89 pts


# ═══════════════════════════════════════════════════════════════════════════
# STYLES
# ═══════════════════════════════════════════════════════════════════════════
def build_styles():
    base = getSampleStyleSheet()
    S = {}

    def s(name, **kw):
        S[name] = ParagraphStyle(name, **kw)

    s("cover_title",  fontName="Helvetica-Bold",  fontSize=32, textColor=WHITE,
      alignment=TA_CENTER, leading=38, spaceAfter=8)
    s("cover_sub",    fontName="Helvetica",         fontSize=14, textColor=GREEN_PALE,
      alignment=TA_CENTER, leading=18, spaceAfter=6)
    s("cover_meta",   fontName="Helvetica",         fontSize=10, textColor=GREEN_PALE,
      alignment=TA_CENTER, leading=14)

    s("section_title",fontName="Helvetica-Bold",   fontSize=16, textColor=GREEN_DARK,
      leading=20, spaceBefore=14, spaceAfter=6)
    s("subsection",   fontName="Helvetica-Bold",   fontSize=11, textColor=GREEN_MID,
      leading=14, spaceBefore=8, spaceAfter=4)
    s("body",         fontName="Helvetica",         fontSize=9,  textColor=BLACK,
      leading=13, spaceAfter=3)
    s("body_muted",   fontName="Helvetica",         fontSize=8,  textColor=TEXT_MUTED,
      leading=12, spaceAfter=2)
    s("label",        fontName="Helvetica-Bold",   fontSize=8,  textColor=TEXT_MUTED,
      leading=11, spaceAfter=1)
    s("value",        fontName="Helvetica",         fontSize=9,  textColor=BLACK,
      leading=12)
    s("tag_green",    fontName="Helvetica-Bold",   fontSize=8,  textColor=GREEN_MID,
      leading=10)
    s("tag_amber",    fontName="Helvetica-Bold",   fontSize=8,  textColor=AMBER,
      leading=10)
    s("tag_red",      fontName="Helvetica-Bold",   fontSize=8,  textColor=RED_SOFT,
      leading=10)
    s("verdict_go",   fontName="Helvetica-Bold",   fontSize=22, textColor=WHITE,
      alignment=TA_CENTER, leading=26)
    s("verdict_nogo", fontName="Helvetica-Bold",   fontSize=22, textColor=WHITE,
      alignment=TA_CENTER, leading=26)
    s("caption",      fontName="Helvetica-Oblique", fontSize=7.5, textColor=TEXT_MUTED,
      alignment=TA_CENTER, leading=10)
    return S


# ═══════════════════════════════════════════════════════════════════════════
# MAP HELPER — fetch static map PNG via OpenStreetMap / staticmap.de
# ═══════════════════════════════════════════════════════════════════════════
def fetch_map_png(coords: list, width_px=600, height_px=400, zoom=15) -> Optional[bytes]:
    """Fetch a static map centred on the coordinates. Returns PNG bytes or None."""
    if not coords:
        return None
    try:
        lats = [c["lat"] for c in coords]
        lngs = [c["lng"] for c in coords]
        clat = sum(lats) / len(lats)
        clng = sum(lngs) / len(lngs)

        # Use staticmap.de (no API key, free)
        markers = "|".join(f"{c['lat']},{c['lng']}" for c in coords[:10])
        url = (
            f"https://staticmap.openstreetmap.de/staticmap.php"
            f"?center={clat},{clng}&zoom={zoom}&size={width_px}x{height_px}"
            f"&markers={markers}&maptype=osm"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "ALIA-PDF/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read()
    except Exception as e:
        print(f"[PDFGen] Map fetch failed: {e}")
        return None


def map_image_flowable(coords: list, width_cm=15, height_cm=8,
                       caption="Site Location") -> list:
    """Returns a list of flowables: [Image, caption] or fallback text."""
    png = fetch_map_png(coords, width_px=900, height_px=600)
    if png:
        img = Image(io.BytesIO(png), width=width_cm*cm, height=height_cm*cm)
        img.hAlign = "CENTER"
        return [img, Paragraph(caption, S["caption"]), Spacer(1, 0.3*cm)]
    else:
        return [Paragraph("⚠ Map image unavailable (check network)", S["body_muted"]),
                Spacer(1, 0.3*cm)]


# ═══════════════════════════════════════════════════════════════════════════
# DRAWING HELPERS
# ═══════════════════════════════════════════════════════════════════════════
def divider():
    return HRFlowable(width="100%", thickness=0.5, color=GREY_LINE,
                      spaceAfter=6, spaceBefore=4)

def section_header(title: str, number: str = "") -> list:
    label = f"{number}  {title}" if number else title
    return [
        Spacer(1, 0.4*cm),
        Paragraph(label, S["section_title"]),
        HRFlowable(width="100%", thickness=1.5, color=GREEN_MID,
                   spaceAfter=8, spaceBefore=2),
    ]

def info_table(rows: list, col_w=(5*cm, 11.5*cm)) -> Table:
    """Two-column label/value table."""
    data = [[Paragraph(f"<b>{r[0]}</b>", S["label"]),
             Paragraph(str(r[1]) if r[1] else "—", S["value"])]
            for r in rows]
    t = Table(data, colWidths=col_w, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (0, -1), GREEN_TINT),
        ("TEXTCOLOR",    (0, 0), (0, -1), GREEN_DARK),
        ("ROWBACKGROUNDS",(1,0), (-1,-1), [WHITE, GREY_BG]),
        ("BOX",          (0, 0), (-1,-1), 0.5, GREY_LINE),
        ("INNERGRID",    (0, 0), (-1,-1), 0.3, GREY_LINE),
        ("TOPPADDING",   (0, 0), (-1,-1), 5),
        ("BOTTOMPADDING",(0, 0), (-1,-1), 5),
        ("LEFTPADDING",  (0, 0), (-1,-1), 8),
        ("RIGHTPADDING", (0, 0), (-1,-1), 8),
    ]))
    return t

def risk_badge(level: str) -> str:
    level = (level or "").lower()
    if level == "low":    return f'<font color="#15803d"><b>● LOW</b></font>'
    if level == "high":   return f'<font color="#dc2626"><b>● HIGH</b></font>'
    return f'<font color="#d97706"><b>● MEDIUM</b></font>'

def stringify(val) -> str:
    if val is None: return "—"
    if val == "": return "—"
    if isinstance(val, list): return ", ".join(str(x) for x in val if x is not None) or "—"
    if isinstance(val, dict): return json.dumps(val, ensure_ascii=False)[:200]
    return str(val)


# ═══════════════════════════════════════════════════════════════════════════
# FINANCIAL BAR CHART
# ═══════════════════════════════════════════════════════════════════════════
def financial_bar_chart(fin: dict, width=14*cm, height=6*cm) -> Drawing:
    """Returns a ReportLab Drawing with a revenue bar chart."""
    def parse_idr(s):
        if s is None: return 0
        if isinstance(s, (int, float)): return s
        return int(str(s).replace(",","").replace(".","").replace("IDR","")
                   .replace("Rp","").replace(" ","").strip() or 0)

    rev  = fin.get("projected_revenue", {})
    cost = fin.get("project_cost", {})

    labels = ["Year 1 Rev", "Year 5 Rev", "Year 10 Rev", "GDV Total", "Total Cost"]
    values = [
        parse_idr(rev.get("year_1")),
        parse_idr(rev.get("year_5")),
        parse_idr(rev.get("year_10")),
        parse_idr(rev.get("gdv_total")),
        parse_idr(cost.get("total") if cost else None),
    ]

    # Fallback for flat format
    if all(v == 0 for v in values[:4]):
        labels = ["Total Cost", "GDV / Revenue"]
        values = [
            parse_idr(fin.get("total_estimated_project_cost")),
            parse_idr(fin.get("projected_revenue_gdv")),
        ]

    values = [v for v in values]
    max_v  = max(values or [1], default=1)

    d = Drawing(width, height)
    bar_w   = (width - 60) / max(len(values), 1)
    bar_gap = bar_w * 0.25
    x_start = 55

    for i, (label, val) in enumerate(zip(labels, values)):
        bar_h = (val / max_v) * (height - 50) if max_v else 0
        x     = x_start + i * bar_w + bar_gap / 2
        bw    = bar_w - bar_gap

        # Bar
        bar_color = GREEN_MID if "Cost" not in label else AMBER
        d.add(Rect(x, 30, bw, bar_h,
                   fillColor=bar_color, strokeColor=None))

        # Value label above bar
        if val > 0:
            vstr = f"{val/1e9:.1f}B" if val >= 1e9 else f"{val/1e6:.0f}M"
            d.add(String(x + bw/2, 30 + bar_h + 3, vstr,
                         fontSize=7, textAnchor="middle",
                         fillColor=GREEN_DARK, fontName="Helvetica-Bold"))

        # X-axis label
        short = label.replace(" Rev","").replace(" Total","")
        d.add(String(x + bw/2, 16, short,
                     fontSize=7, textAnchor="middle",
                     fillColor=TEXT_MUTED, fontName="Helvetica"))

    # Y-axis line
    d.add(Line(x_start - 2, 28, x_start - 2, height - 10,
               strokeColor=GREY_LINE, strokeWidth=0.5))
    # X-axis line
    d.add(Line(x_start - 2, 28, width - 5, 28,
               strokeColor=GREY_LINE, strokeWidth=0.5))

    return d


# ═══════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════════════════════
def build_cover(canvas, doc, state):
    canvas.saveState()
    # Full-page dark green background
    canvas.setFillColor(GREEN_DARK)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)

    # Decorative accent strip top
    canvas.setFillColor(GREEN_MID)
    canvas.rect(0, H - 8, W, 8, fill=1, stroke=0)

    # Decorative green band bottom-left corner
    canvas.setFillColor(GREEN_MID)
    canvas.rect(0, 0, W * 0.35, 5, fill=1, stroke=0)

    # ALIA wordmark
    canvas.setFillColor(GREEN_LIGHT)
    canvas.setFont("Helvetica-Bold", 13)
    canvas.drawString(2*cm, H - 1.8*cm, "ALIA")
    canvas.setFillColor(GREEN_PALE)
    canvas.setFont("Helvetica", 10)
    canvas.drawString(2*cm + 42, H - 1.8*cm, "Real Estate Feasibility Intelligence")

    # Main title block — centred vertically
    mid_y = H * 0.55
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 36)
    title = state.user_input.project_name.upper()
    canvas.drawCentredString(W / 2, mid_y + 40, title)

    canvas.setFillColor(GREEN_PALE)
    canvas.setFont("Helvetica", 15)
    canvas.drawCentredString(W / 2, mid_y + 10, "Real Estate Feasibility Study")

    # Thin divider line
    canvas.setStrokeColor(GREEN_LIGHT)
    canvas.setLineWidth(0.8)
    canvas.line(2*cm, mid_y - 5, W - 2*cm, mid_y - 5)

    # Meta row
    canvas.setFillColor(GREEN_PALE)
    canvas.setFont("Helvetica", 10)
    canvas.drawCentredString(W / 2, mid_y - 22,
        f"{state.user_input.location}  ·  {state.user_input.project_type}  ·  "
        f"{state.user_input.land_area_sqm:,.0f} sqm")

    date_str = datetime.now().strftime("%B %Y")
    canvas.drawCentredString(W / 2, mid_y - 38, f"Prepared: {date_str}")

    # Bottom confidentiality note
    canvas.setFillColor(TEXT_MUTED)
    canvas.setFont("Helvetica-Oblique", 8)
    canvas.drawCentredString(W / 2, 1.5*cm, "CONFIDENTIAL — For internal use only")

    canvas.restoreState()


# ═══════════════════════════════════════════════════════════════════════════
# PAGE TEMPLATE with header/footer on content pages
# ═══════════════════════════════════════════════════════════════════════════
class ContentPageTemplate(PageTemplate):
    def __init__(self, state):
        self.state = state
        frame = Frame(
            1.8*cm, 1.8*cm,
            W - 3.6*cm, H - 3.8*cm,
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
        )
        super().__init__("content", [frame])

    def beforeDrawPage(self, canvas, doc):
        s = self.state
        canvas.saveState()

        # Header bar
        canvas.setFillColor(GREEN_DARK)
        canvas.rect(0, H - 1.5*cm, W, 1.5*cm, fill=1, stroke=0)
        canvas.setFillColor(WHITE)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(1.8*cm, H - 0.95*cm, "ALIA")
        canvas.setFont("Helvetica", 9)
        canvas.drawString(1.8*cm + 28, H - 0.95*cm,
                          f"Feasibility Study — {s.user_input.project_name}")
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(W - 1.8*cm, H - 0.95*cm, s.user_input.location)

        # Footer bar
        canvas.setFillColor(GREEN_TINT)
        canvas.rect(0, 0, W, 1.5*cm, fill=1, stroke=0)
        canvas.setStrokeColor(GREEN_PALE)
        canvas.setLineWidth(0.5)
        canvas.line(0, 1.5*cm, W, 1.5*cm)
        canvas.setFillColor(TEXT_MUTED)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(1.8*cm, 0.55*cm, "CONFIDENTIAL — ALIA Real Estate Intelligence")
        canvas.drawRightString(W - 1.8*cm, 0.55*cm, f"Page {doc.page}")

        canvas.restoreState()


# ═══════════════════════════════════════════════════════════════════════════
# MAIN GENERATOR
# ═══════════════════════════════════════════════════════════════════════════
# Expose globally so helpers can use it
S = build_styles()

def generate_feasibility_pdf(state, output_path: str) -> str:
    global S
    S = build_styles()

    ui   = state.user_input
    ar   = state.analysis_result
    fd   = state.fetched_data
    coords = [{"lat": c.lat, "lng": c.lng} for c in (ui.coordinates or [])]

    # ── Document setup ─────────────────────────────────────────────────────
    doc = BaseDocTemplate(
        output_path, pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=2*cm,    bottomMargin=1.8*cm,
    )

    cover_tpl   = PageTemplate("cover",   [Frame(0, 0, W, H, 0,0,0,0)])
    content_tpl = ContentPageTemplate(state)
    doc.addPageTemplates([cover_tpl, content_tpl])

    story = []

    # ══════════════════════════════════════════════════════════════════════
    # PAGE 1 — COVER
    # ══════════════════════════════════════════════════════════════════════
    # The cover is drawn entirely in the onPage callback via build_cover
    # We add a dummy frame content + pagebreak
    story.append(Spacer(W, H))  # fill the cover frame
    story.append(PageBreak())

    # Switch to content template
    from reportlab.platypus import NextPageTemplate
    story.insert(0, NextPageTemplate("cover"))
    story.insert(2, NextPageTemplate("content"))

    # ══════════════════════════════════════════════════════════════════════
    # PAGE 2 — PROJECT PROFILE
    # ══════════════════════════════════════════════════════════════════════
    story += section_header("PROJECT PROFILE", "01")

    story.append(info_table([
        ("Project Name",  ui.project_name),
        ("Location",      ui.location),
        ("Project Type",  ui.project_type),
        ("Land Area",     f"{ui.land_area_sqm:,.0f} sqm"),
        ("Coordinates",   f"{len(coords)} points defined" if coords else "Not specified"),
        ("Report Date",   datetime.now().strftime("%d %B %Y")),
        ("Run ID",        state.run_id[:8] + "..."),
    ]))
    story.append(Spacer(1, 0.5*cm))

    # Site map
    if coords:
        story += [Paragraph("Site Location Map", S["subsection"])]
        story += map_image_flowable(
            coords, width_cm=15.9, height_cm=9,
            caption=f"Site boundary — {ui.location}"
        )
    else:
        story.append(Paragraph("No site coordinates were provided.", S["body_muted"]))
        story.append(Spacer(1, 0.3*cm))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # PAGE 3 — LOCATION PROFILE (from fetched data)
    # ══════════════════════════════════════════════════════════════════════
    story += section_header("LOCATION PROFILE", "02")
    story.append(Paragraph(
        "Data gathered by ALIA's parallel fetch agents from OpenStreetMap and public sources.",
        S["body_muted"]
    ))
    story.append(Spacer(1, 0.3*cm))

    phys_raw = {}
    econ_raw = {}
    if fd:
        phys_raw = (fd.physical_data  or {})
        econ_raw = (fd.economic_data   or {})

    # Physical — roads & amenities
    phys_summary = phys_raw.get("summary", phys_raw)
    story.append(Paragraph("Infrastructure & Surroundings", S["subsection"]))

    roads     = phys_summary.get("roads", [])
    amenities = phys_summary.get("amenities", [])
    transport = phys_summary.get("transport", [])

    if roads or amenities or transport:
        loc_rows = []
        if roads:
            loc_rows.append(("Nearby Roads", ", ".join(str(r) for r in roads[:5] if r is not None)))
        if amenities:
            loc_rows.append(("Amenities", "\n".join(f"• {a}" for a in amenities[:6])))
        if transport:
            loc_rows.append(("Transport", ", ".join(str(t) for t in transport[:4] if t is not None)))
        terrain = phys_summary.get("terrain")
        if terrain:
            loc_rows.append(("Terrain", terrain))
        story.append(info_table(loc_rows))
    else:
        story.append(Paragraph("Physical location data was not available.", S["body_muted"]))

    story.append(Spacer(1, 0.5*cm))

    # Economic snapshot
    econ_summary = econ_raw.get("summary", econ_raw)
    story.append(Paragraph("Market Overview", S["subsection"]))
    econ_rows = []
    if econ_summary.get("price_per_sqm"):
        econ_rows.append(("Land Price / m²", econ_summary["price_per_sqm"]))
    if econ_summary.get("price_range"):
        econ_rows.append(("Price Range",     econ_summary["price_range"]))
    if econ_summary.get("price_trend"):
        econ_rows.append(("Market Trend",    econ_summary["price_trend"]))
    if econ_summary.get("market_note"):
        econ_rows.append(("Market Note",     econ_summary["market_note"]))
    listings = econ_summary.get("sample_listings", [])
    if listings:
        econ_rows.append(("Sample Listings", "\n".join(f"• {l}" for l in listings[:4])))

    if econ_rows:
        story.append(info_table(econ_rows))
    else:
        story.append(Paragraph("Economic data was not available.", S["body_muted"]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # PAGE 4 — PHYSICAL ANALYSIS
    # ══════════════════════════════════════════════════════════════════════
    story += section_header("PHYSICAL SITE ANALYSIS", "03")

    phys_an = {}
    if ar and ar.physical_analysis:
        phys_an = ar.physical_analysis

    # Site map at amenity zoom level
    if coords:
        story += map_image_flowable(
            coords, width_cm=15.9, height_cm=8,
            caption="Site boundary with surrounding area context"
        )

    if phys_an:
        # Site suitability
        suitability = phys_an.get("site_suitability", {})
        if suitability:
            story.append(Paragraph("Site Suitability Assessment", S["subsection"]))
            suit_rows = []
            for k, v in suitability.items():
                label = k.replace("_", " ").title()
                suit_rows.append((label, stringify(v)))
            story.append(info_table(suit_rows))
            story.append(Spacer(1, 0.3*cm))

        # Infrastructure
        infra = phys_an.get("infrastructure", {})
        if infra:
            story.append(Paragraph("Infrastructure Readiness", S["subsection"]))
            infra_rows = [(k.replace("_"," ").title(), stringify(v))
                          for k, v in infra.items()]
            story.append(info_table(infra_rows))
            story.append(Spacer(1, 0.3*cm))

        # Constraints
        constraints = phys_an.get("construction_constraints", [])
        if constraints:
            story.append(Paragraph("Construction Constraints", S["subsection"]))
            for c in constraints:
                story.append(Paragraph(f"• {c}", S["body"]))
            story.append(Spacer(1, 0.3*cm))

        # Risk score
        risk = phys_an.get("physical_risk_score", "")
        if risk:
            story.append(Paragraph(
                f"Physical Risk Score: {risk_badge(risk)}",
                S["body"]
            ))
            story.append(Spacer(1, 0.2*cm))

        # Recommendations
        recs = phys_an.get("recommendations", [])
        if recs:
            story.append(Paragraph("Recommendations", S["subsection"]))
            for r in recs:
                story.append(Paragraph(f"✓  {r}", S["body"]))
    else:
        story.append(Paragraph("Physical analysis data not available.", S["body_muted"]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # PAGE 5 — LEGAL ANALYSIS
    # ══════════════════════════════════════════════════════════════════════
    story += section_header("LEGAL & REGULATORY ANALYSIS", "04")

    legal_an = {}
    if ar and ar.legal_analysis:
        legal_an = ar.legal_analysis

    if legal_an:
        # Zoning
        zoning = legal_an.get("zoning", {})
        if zoning:
            story.append(Paragraph("Zoning Classification", S["subsection"]))
            z_rows = [
                ("Classification",    zoning.get("classification", "—")),
                ("Compliance Status", zoning.get("compliance_status", "—")),
                ("Note",              zoning.get("compliance_note", "—")),
            ]
            story.append(info_table(z_rows))
            story.append(Spacer(1, 0.4*cm))

        # Building parameters
        bp = legal_an.get("building_parameters", {})
        if bp:
            story.append(Paragraph("Building Parameters", S["subsection"]))
            bp_rows = [(k.replace("_"," ").title(), stringify(v))
                       for k, v in bp.items()]
            story.append(info_table(bp_rows))
            story.append(Spacer(1, 0.4*cm))

        # Permits table
        permits = legal_an.get("required_permits", [])
        if permits:
            story.append(Paragraph("Required Permits", S["subsection"]))
            hdr = [
                Paragraph("<b>Permit</b>",    S["label"]),
                Paragraph("<b>Issuer</b>",    S["label"]),
                Paragraph("<b>Duration</b>",  S["label"]),
                Paragraph("<b>Difficulty</b>",S["label"]),
            ]
            rows = [hdr]
            for p in permits:
                diff = (p.get("difficulty") or "").lower()
                diff_col = {"easy": GREEN_MID, "hard": RED_SOFT}.get(diff, AMBER)
                rows.append([
                    Paragraph(p.get("permit","—"),      S["body"]),
                    Paragraph(p.get("issuer","—"),      S["body"]),
                    Paragraph(p.get("est_duration","—"),S["body"]),
                    Paragraph(f'<font color="{diff_col.hexval() if hasattr(diff_col,"hexval") else "#d97706"}"><b>{diff.upper()}</b></font>', S["body"]),
                ])
            pt = Table(rows, colWidths=[6*cm, 4*cm, 3*cm, 2.9*cm], hAlign="LEFT")
            pt.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (-1,0), GREEN_DARK),
                ("TEXTCOLOR",     (0,0), (-1,0), WHITE),
                ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GREY_BG]),
                ("BOX",           (0,0), (-1,-1), 0.5, GREY_LINE),
                ("INNERGRID",     (0,0), (-1,-1), 0.3, GREY_LINE),
                ("TOPPADDING",    (0,0), (-1,-1), 5),
                ("BOTTOMPADDING", (0,0), (-1,-1), 5),
                ("LEFTPADDING",   (0,0), (-1,-1), 7),
                ("RIGHTPADDING",  (0,0), (-1,-1), 7),
            ]))
            story.append(pt)
            story.append(Spacer(1, 0.4*cm))

        # Legal risks
        risks = legal_an.get("legal_risks", [])
        if risks:
            story.append(Paragraph("Legal Risks", S["subsection"]))
            risk_data = [
                [Paragraph("<b>Risk</b>",S["label"]),
                 Paragraph("<b>Severity</b>",S["label"]),
                 Paragraph("<b>Mitigation</b>",S["label"])]
            ]
            for r in risks:
                risk_data.append([
                    Paragraph(r.get("risk","—"),       S["body"]),
                    Paragraph(risk_badge(r.get("severity","")), S["body"]),
                    Paragraph(r.get("mitigation","—"), S["body"]),
                ])
            rt = Table(risk_data, colWidths=[5*cm, 2.5*cm, 8.4*cm], hAlign="LEFT")
            rt.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (-1,0), GREEN_DARK),
                ("TEXTCOLOR",     (0,0), (-1,0), WHITE),
                ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GREY_BG]),
                ("BOX",           (0,0), (-1,-1), 0.5, GREY_LINE),
                ("INNERGRID",     (0,0), (-1,-1), 0.3, GREY_LINE),
                ("TOPPADDING",    (0,0), (-1,-1), 5),
                ("BOTTOMPADDING", (0,0), (-1,-1), 5),
                ("LEFTPADDING",   (0,0), (-1,-1), 7),
                ("RIGHTPADDING",  (0,0), (-1,-1), 7),
            ]))
            story.append(rt)
            story.append(Spacer(1, 0.4*cm))

        # Recommendations
        recs = legal_an.get("compliance_recommendations", [])
        if recs:
            story.append(Paragraph("Compliance Recommendations", S["subsection"]))
            for r in recs:
                story.append(Paragraph(f"✓  {r}", S["body"]))

        # Overall legal risk
        overall = legal_an.get("overall_legal_risk", "")
        if overall:
            story.append(Spacer(1, 0.3*cm))
            story.append(Paragraph(
                f"Overall Legal Risk: {risk_badge(overall)}",
                S["body"]
            ))
    else:
        story.append(Paragraph("Legal analysis data not available.", S["body_muted"]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # PAGE 6 — FINANCIAL ANALYSIS
    # ══════════════════════════════════════════════════════════════════════
    story += section_header("FINANCIAL ANALYSIS", "05")

    fin_an = {}
    if ar and ar.financial_analysis:
        fin_an = ar.financial_analysis

    if fin_an:
        # Normalise flat vs nested format
        def norm_fin(f):
            def p(v):
                if v is None: return None
                if isinstance(v, (int,float)): return f"IDR {v:,.0f}"
                return str(v)

            rec = f.get("recommendation", {})
            if not isinstance(rec, dict):
                rec = {"verdict": str(rec or "GO").upper(),
                       "rationale": f.get("rationale",""), "conditions": []}

            return {
                "recommendation": rec,
                "returns": f.get("returns") or {
                    "roi_pct":        p(f.get("roi_estimate")),
                    "irr_pct":        p(f.get("irr_estimate")),
                    "equity_multiple": f.get("equity_multiple"),
                },
                "projected_revenue": f.get("projected_revenue") or {
                    "year_1":    p(f.get("projected_revenue_year_1")),
                    "year_5":    p(f.get("projected_revenue_year_5")),
                    "year_10":   p(f.get("projected_revenue_year_10")),
                    "gdv_total": p(f.get("projected_revenue_gdv")),
                    "basis": None,
                },
                "project_cost": f.get("project_cost") or (
                    {"total": p(f.get("total_estimated_project_cost"))}
                    if f.get("total_estimated_project_cost") else None
                ),
                "payback": f.get("payback") or {
                    "payback_period_years":    f.get("payback_period_years"),
                    "break_even_units_or_sqm": (
                        f"{f['break_even_analysis']['break_even_units']} units"
                        if isinstance(f.get("break_even_analysis"), dict) else None
                    ),
                    "break_even_revenue": (
                        p(f["break_even_analysis"].get("break_even_revenue"))
                        if isinstance(f.get("break_even_analysis"), dict) else None
                    ),
                },
                "risk": f.get("risk") or {
                    "overall_rating":    f.get("financial_risk_assessment"),
                    "market_risk":       None,
                    "construction_risk": None,
                    "regulatory_risk":   None,
                    "reasoning":         None,
                },
            }

        fn = norm_fin(fin_an)
        rec = fn["recommendation"]
        ret = fn["returns"]
        rev = fn["projected_revenue"]
        cst = fn["project_cost"]
        pay = fn["payback"]
        rsk = fn["risk"]

        # Verdict banner
        verdict = (rec.get("verdict") or "GO").upper()
        is_nogo = "NO-GO" in verdict
        is_cond = "CONDITIONAL" in verdict
        v_color = RED_SOFT if is_nogo else (AMBER if is_cond else GREEN_MID)

        verdict_data = [[
            Paragraph(verdict, ParagraphStyle("verd", fontName="Helvetica-Bold",
                fontSize=22, textColor=WHITE, alignment=TA_CENTER)),
            Paragraph(rec.get("rationale",""), ParagraphStyle("vrat", fontName="Helvetica",
                fontSize=9, textColor=WHITE, leading=13)),
        ]]
        vt = Table(verdict_data, colWidths=[3.5*cm, 12.4*cm])
        vt.setStyle(TableStyle([
            ("BACKGROUND",   (0,0), (-1,-1), v_color),
            ("TOPPADDING",   (0,0), (-1,-1), 12),
            ("BOTTOMPADDING",(0,0), (-1,-1), 12),
            ("LEFTPADDING",  (0,0), (-1,-1), 12),
            ("RIGHTPADDING", (0,0), (-1,-1), 12),
            ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
        ]))
        story.append(vt)
        story.append(Spacer(1, 0.5*cm))

        # Key metrics row
        story.append(Paragraph("Key Financial Metrics", S["subsection"]))
        metrics = [
            [Paragraph("ROI", S["label"]),
             Paragraph("IRR", S["label"]),
             Paragraph("Equity Multiple", S["label"]),
             Paragraph("Payback Period", S["label"])],
            [Paragraph(f'<font size="16"><b>{ret.get("roi_pct","—")}</b></font>', S["body"]),
             Paragraph(f'<font size="16"><b>{ret.get("irr_pct","—")}</b></font>', S["body"]),
             Paragraph(f'<font size="16"><b>{ret.get("equity_multiple","—")}</b></font>', S["body"]),
             Paragraph(f'<font size="16"><b>{pay.get("payback_period_years","—")} yrs</b></font>', S["body"])],
        ]
        mt = Table(metrics, colWidths=[4*cm]*4, hAlign="LEFT")
        mt.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0), GREEN_TINT),
            ("BACKGROUND",    (0,1), (-1,1), WHITE),
            ("BOX",           (0,0), (-1,-1), 0.5, GREY_LINE),
            ("INNERGRID",     (0,0), (-1,-1), 0.3, GREY_LINE),
            ("TOPPADDING",    (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("ALIGN",         (0,0), (-1,-1), "CENTER"),
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ]))
        story.append(mt)
        story.append(Spacer(1, 0.5*cm))

        # Revenue bar chart
        story.append(Paragraph("Revenue & Cost Projection Chart", S["subsection"]))
        chart = financial_bar_chart(fn, width=15.9*cm, height=6.5*cm)
        story.append(chart)
        story.append(Paragraph("Values in IDR billions (B) or millions (M)", S["caption"]))
        story.append(Spacer(1, 0.5*cm))

        # Revenue table
        if any(rev.get(k) for k in ["year_1","year_5","year_10","gdv_total"]):
            story.append(Paragraph("Projected Revenue", S["subsection"]))
            rev_rows = []
            if rev.get("year_1"):    rev_rows.append(("Year 1",    rev["year_1"]))
            if rev.get("year_5"):    rev_rows.append(("Year 5",    rev["year_5"]))
            if rev.get("year_10"):   rev_rows.append(("Year 10",   rev["year_10"]))
            if rev.get("gdv_total"): rev_rows.append(("GDV Total", rev["gdv_total"]))
            if rev.get("basis"):     rev_rows.append(("Basis",     rev["basis"]))
            story.append(info_table(rev_rows))
            story.append(Spacer(1, 0.3*cm))

        # Cost breakdown
        if cst:
            story.append(Paragraph("Project Cost Breakdown", S["subsection"]))
            cost_rows = [(k.replace("_"," ").title(), stringify(v))
                         for k, v in cst.items() if k != "total"]
            if cost_rows:
                story.append(info_table(cost_rows))
            if cst.get("total"):
                total_row = [[
                    Paragraph("<b>TOTAL PROJECT COST</b>", ParagraphStyle(
                        "tot", fontName="Helvetica-Bold", fontSize=10, textColor=WHITE)),
                    Paragraph(f"<b>{cst['total']}</b>", ParagraphStyle(
                        "totv", fontName="Helvetica-Bold", fontSize=10, textColor=WHITE)),
                ]]
                tt = Table(total_row, colWidths=[5*cm, 11.5*cm], hAlign="LEFT")
                tt.setStyle(TableStyle([
                    ("BACKGROUND",   (0,0),(-1,-1), GREEN_DARK),
                    ("TOPPADDING",   (0,0),(-1,-1), 8),
                    ("BOTTOMPADDING",(0,0),(-1,-1), 8),
                    ("LEFTPADDING",  (0,0),(-1,-1), 8),
                ]))
                story.append(tt)
            story.append(Spacer(1, 0.4*cm))

        # Break-even
        if any(pay.get(k) for k in ["break_even_units_or_sqm","break_even_revenue"]):
            story.append(Paragraph("Break-even Analysis", S["subsection"]))
            be_rows = []
            if pay.get("break_even_units_or_sqm"):
                be_rows.append(("Break-even Point", pay["break_even_units_or_sqm"]))
            if pay.get("break_even_revenue"):
                be_rows.append(("Break-even Revenue", pay["break_even_revenue"]))
            if pay.get("break_even_note"):
                be_rows.append(("Note", pay["break_even_note"]))
            story.append(info_table(be_rows))
            story.append(Spacer(1, 0.3*cm))

        # Risk table
        story.append(Paragraph("Risk Assessment", S["subsection"]))
        risk_rows = [("Overall Risk", risk_badge(rsk.get("overall_rating","")))]
        for k in ["market_risk","construction_risk","regulatory_risk"]:
            if rsk.get(k):
                risk_rows.append((k.replace("_"," ").title(), risk_badge(rsk[k])))
        story.append(info_table(risk_rows))
        if rsk.get("reasoning"):
            story.append(Spacer(1, 0.2*cm))
            story.append(Paragraph(f"<i>{rsk['reasoning']}</i>", S["body_muted"]))

    else:
        story.append(Paragraph("Financial analysis data not available.", S["body_muted"]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # PAGE 7 — QA & SIGN-OFF
    # ══════════════════════════════════════════════════════════════════════
    story += section_header("QUALITY ASSURANCE", "06")

    qa_rows = []
    if state.data_guardrail:
        qa_rows.append(("Data Quality Score",     f"{state.data_guardrail.score:.0%}"))
        if state.data_guardrail.issues:
            qa_rows.append(("Data Issues", "; ".join(state.data_guardrail.issues[:3])))
    if state.output_guardrail:
        qa_rows.append(("Analysis Quality Score", f"{state.output_guardrail.score:.0%}"))
        if state.output_guardrail.issues:
            qa_rows.append(("Analysis Issues", "; ".join(state.output_guardrail.issues[:3])))
    if qa_rows:
        story.append(info_table(qa_rows))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("Disclaimer", S["subsection"]))
    story.append(Paragraph(
        "This feasibility study was generated by ALIA (AI Land Investment Analyst) "
        "and reviewed by a human analyst at each critical stage. The information "
        "contained herein is based on publicly available data and AI analysis. "
        "It should not be relied upon as the sole basis for investment decisions. "
        "Always consult qualified professionals before proceeding.",
        S["body_muted"]
    ))
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph(
        f"Generated on {datetime.now().strftime('%d %B %Y at %H:%M')} · ALIA v2.0",
        S["caption"]
    ))

    # ── Build ──────────────────────────────────────────────────────────────
    def on_first_page(canvas, doc):
        build_cover(canvas, doc, state)

    def on_later_pages(canvas, doc):
        content_tpl.beforeDrawPage(canvas, doc)

    # Patch onPage into the page templates
    cover_tpl.onPage   = lambda c, d: build_cover(c, d, state)
    content_tpl.onPage = lambda c, d: content_tpl.beforeDrawPage(c, d)
    doc.build(story)

    return output_path