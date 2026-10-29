import { REPORT_CONFIG } from "../opexReport/config.js";
import { REPORT_LOGO_DATA_URI } from "../opexReport/logo.js";
import { REPORT_CSS } from "../opexReport/styles.js";
import { esc, num, fmtDate } from "../opexReport/text.js";
import { LossReportModel, LossReportRecoveryRow, LossRateSource } from "../../utils/lossReportModel.js";

// HTML for the Loss Capacity executive report ("Kayıp Maliyet Analizi — Yönetici Raporu"): same
// design language, cover, page frame and A4-landscape Chromium pipeline as the OpEx executive
// report (src/server/opexReport). Every figure comes from the posted model (the Loss screen's own
// numbers); headlines and the management asks are rule-based on those figures. Pages without data
// say so instead of being filled.

const C = REPORT_CONFIG;
const LOGO = REPORT_LOGO_DATA_URI;

export const LOSS_REPORT = {
  kicker: "Kayıp Maliyet Analizi Raporu",
  titleLines: ["Kayıp Kapasite ve", "Maliyet Analizi"],
  subtitle: "Yönetici Raporu",
  // Rows per page before a table continues on the next page.
  stationRowsPerPage: 10,
  recoveryRowsPerPage: 10
};

// ---------- formatting ----------

const fmtInt = (v: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Number.isFinite(v) ? v : 0);
function money(m: LossReportModel, v: number): string {
  return `${fmtInt(v)} ${esc(m.currency)}`;
}
function moneyShort(m: LossReportModel, v: number): string {
  const a = Math.abs(v);
  const cur = esc(m.currency);
  if (a >= 1e9) return `${num(v / 1e9, 2)} Mr ${cur}`;
  if (a >= 1e6) return `${num(v / 1e6, 1)} Mn ${cur}`;
  if (a >= 1e3) return `${num(v / 1e3, 0)} Bin ${cur}`;
  return `${fmtInt(v)} ${cur}`;
}
const pct = (v: number, d = 1) => `%${num(v, d)}`;
const dash = (v: number, f: (x: number) => string) => (v > 0 ? f(v) : `<span class="na">—</span>`);
const SOURCE_LABEL: Record<Exclude<LossRateSource, null>, string> = { birim: "Girilen", vsm: "VSM", kart: "Şirket kartı" };
const SOURCE_COLOR: Record<Exclude<LossRateSource, null>, string> = { birim: "#1B2430", vsm: "#2F6FA8", kart: "#7C5CB8" };
const srcChip = (s: LossRateSource) => (s ? `<span class="chip" style="--c:${SOURCE_COLOR[s]}">${SOURCE_LABEL[s]}</span>` : `<span class="na">yok</span>`);
const SEVERITY: Record<string, [string, string]> = {
  Critical: ["Kritik", "#C8373B"], High: ["Yüksek", "#D9822B"], Medium: ["Orta", "#D9B43B"], Low: ["Düşük", "#8DB86B"]
};

// ---------- extra CSS ----------

const LOSS_CSS = `
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm}
.kpi-s{background:var(--soft);border-radius:3mm;padding:4mm 5mm;border-top:3px solid var(--c,#1B2430)}
.kpi-s .v{font-size:20pt;font-weight:700;margin:0;line-height:1.05;letter-spacing:-.01em} .kpi-s .d{font-size:8.2pt;color:var(--muted);margin:1.5mm 0 0;line-height:1.35}
.grid-2e{display:grid;grid-template-columns:1fr 1fr;gap:5mm;flex:1;min-height:0}
.grid-2e .facts{font-size:9.2pt} .grid-2e .facts li{padding:1.6mm 0} .grid-2e .facts b{font-size:10.5pt} .grid-2e .rank{font-size:9.2pt}
.kpi-s .v{font-size:18pt}
.grid-21{display:grid;grid-template-columns:1.45fr 1fr;gap:5mm;flex:1;min-height:0}
.tbl.num td.r,.tbl.num th.r{font-variant-numeric:tabular-nums}
.tbl tr.tot td{border-top:1.5px solid var(--ink);border-bottom:0;background:var(--soft);font-weight:700}
.tbl tr.grp td{background:#fff;font-size:7.4pt;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700;padding-top:2.2mm}
.tbl.sm td{font-size:7.9pt;padding:1.05mm 1.8mm} .tbl.sm th{padding:1.3mm 1.8mm}
.tbl.xs td{font-size:7.6pt;padding:.75mm 1.8mm;vertical-align:middle} .tbl.xs th{padding:1.1mm 1.8mm} .tbl.xs .src{font-size:6.8pt;color:var(--muted);margin-left:1.5mm;font-weight:400}
.tbl.xs tr.grp td{padding-top:1.4mm;padding-bottom:.6mm}
.heat{display:inline-block;min-width:16mm;text-align:right;border-radius:1mm;padding:.2mm 1.2mm}
.mini{font-size:7.2pt;color:var(--muted)}
.flow5{display:grid;grid-template-columns:repeat(5,1fr)}
.srcs{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}
.srcs div{background:#fff;border-left:4px solid var(--c);border-radius:1.5mm;padding:2.5mm 3mm} .srcs b{font-size:16pt;display:block} .srcs span{font-size:8pt;color:var(--muted)}
.fx{margin:0;padding:0;list-style:none;font-size:8.8pt;line-height:1.4} .fx li{padding:1.6mm 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:44mm 1fr;gap:3mm} .fx li:last-child{border:0} .fx b{font-weight:600}
.gaps{margin:0;padding-left:5mm;font-size:9pt;line-height:1.45} .gaps li{margin-bottom:1.4mm}
`;

// ---------- SVG charts ----------

function hBars(m: LossReportModel, items: { label: string; value: number; color?: string; note?: string }[], w = 560, rowH = 26): string {
  const max = Math.max(1, ...items.map(i => i.value));
  const labelW = 190, valW = 110, barW = w - labelW - valW;
  const h = Math.max(rowH, items.length * rowH + 6);
  const o = [`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">`];
  items.forEach((it, i) => {
    const y = i * rowH + 4;
    const bw = (it.value / max) * barW;
    o.push(`<text x="0" y="${y + 13}" class="t-s">${esc(it.label)}</text>`);
    if (it.note) o.push(`<text x="0" y="${y + 23}" class="t-xxs muted">${esc(it.note)}</text>`);
    o.push(`<rect x="${labelW}" y="${y + 3}" width="${barW}" height="14" rx="2" fill="#EEF0F2"/>`);
    if (bw > 0) o.push(`<rect x="${labelW}" y="${y + 3}" width="${bw.toFixed(1)}" height="14" rx="2" fill="${it.color || "#D7141A"}"/>`);
    o.push(`<text x="${w}" y="${y + 14}" text-anchor="end" class="t-s b">${it.value > 0 ? moneyShort(m, it.value) : "—"}</text>`);
  });
  o.push("</svg>");
  return o.join("");
}

function paretoSvg(m: LossReportModel, items: { label: string; value: number }[], w = 620, h = 250): string {
  const list = items.filter(i => i.value > 0).sort((a, b) => b.value - a.value);
  if (list.length === 0) return `<p class="empty">Fiyatlanmış kayıp yok.</p>`;
  const total = list.reduce((s, i) => s + i.value, 0);
  const padL = 46, padB = 70, padT = 14, padR = 36;
  const cw = (w - padL - padR) / list.length;
  const max = list[0].value;
  const y = (v: number) => padT + (h - padT - padB) * (1 - v / max);
  const yc = (p: number) => padT + (h - padT - padB) * (1 - p / 100);
  const o = [`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">`];
  [0, 25, 50, 75, 100].forEach(p => {
    o.push(`<line x1="${padL}" x2="${w - padR}" y1="${yc(p).toFixed(1)}" y2="${yc(p).toFixed(1)}" stroke="#E3E6EA" stroke-width=".7"/>`);
    o.push(`<text x="${w - padR + 4}" y="${(yc(p) + 3).toFixed(1)}" class="t-xxs muted">%${p}</text>`);
  });
  let cum = 0;
  const pts: string[] = [];
  list.forEach((it, i) => {
    const x = padL + i * cw;
    o.push(`<rect x="${(x + cw * 0.15).toFixed(1)}" y="${y(it.value).toFixed(1)}" width="${(cw * 0.7).toFixed(1)}" height="${(h - padB - y(it.value)).toFixed(1)}" fill="${i < 3 ? "#D7141A" : "#9AA3AE"}" rx="1.5"/>`);
    cum += it.value;
    pts.push(`${(x + cw / 2).toFixed(1)},${yc((cum / total) * 100).toFixed(1)}`);
    const lx = x + cw / 2, ly = h - padB + 8;
    o.push(`<text transform="translate(${lx.toFixed(1)},${ly}) rotate(40)" class="t-xxs">${esc(it.label.length > 22 ? it.label.slice(0, 21) + "…" : it.label)}</text>`);
  });
  o.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="#1B2430" stroke-width="1.4"/>`);
  pts.forEach(p => { const [px, py] = p.split(","); o.push(`<circle cx="${px}" cy="${py}" r="2.2" fill="#1B2430"/>`); });
  o.push(`<text x="${padL - 4}" y="${padT + 4}" text-anchor="end" class="t-xxs muted">${esc(moneyShort(m, max))}</text>`);
  o.push("</svg>");
  return o.join("");
}

function oeeStackSvg(m: LossReportModel, w = 620): string {
  const st = m.jipm.stations.filter(s => s.oee !== null && s.loadingMinutesPerDay > 0).slice(0, 12);
  if (st.length === 0) return `<p class="empty">OEE'si olan istasyon yok — OEE kayıp yapısı çizilemedi.</p>`;
  const rowH = 22, labelW = 150, barW = w - labelW - 70;
  const h = st.length * rowH + 30;
  const o = [`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">`];
  const parts: [keyof typeof st[number], string, string][] = [["availabilityLoss", "#C8373B", "Kullanılabilirlik"], ["performanceLoss", "#D9822B", "Performans"], ["qualityLoss", "#D9B43B", "Kalite"], ["unexplainedMinutesPerDay", "#9AA3AE", "Dağıtılamayan"]];
  st.forEach((s, i) => {
    const y = i * rowH;
    o.push(`<text x="0" y="${y + 14}" class="t-s">${esc(s.name.length > 24 ? s.name.slice(0, 23) + "…" : s.name)}</text>`);
    let x = labelW;
    const oeeW = ((s.oee as number) / 100) * barW;
    o.push(`<rect x="${x}" y="${y + 4}" width="${oeeW.toFixed(1)}" height="13" fill="#2F6FA8"/>`);
    x += oeeW;
    parts.forEach(([k, col]) => {
      const v = Number(s[k]) || 0;
      const pw = (v / s.loadingMinutesPerDay) * barW;
      if (pw > 0.3) { o.push(`<rect x="${x.toFixed(1)}" y="${y + 4}" width="${pw.toFixed(1)}" height="13" fill="${col}"/>`); x += pw; }
    });
    o.push(`<text x="${w}" y="${y + 14}" text-anchor="end" class="t-s b">OEE %${num(s.oee as number, 1)}</text>`);
  });
  const ly = st.length * rowH + 16;
  let lx = labelW;
  ([["#2F6FA8", "OEE"], ...parts.map(p => [p[1], p[2]])] as [string, string][]).forEach(([col, name]) => {
    o.push(`<rect x="${lx}" y="${ly - 8}" width="9" height="9" fill="${col}"/><text x="${lx + 12}" y="${ly}" class="t-xs">${esc(name)}</text>`);
    lx += Math.min(95, (w - labelW) / 5);
  });
  o.push("</svg>");
  return o.join("");
}

function copqBandSvg(m: LossReportModel, w = 560): string {
  const bands: [number, number, string, string][] = [[0, 2, "#3A9A5B", "Dünya klası <%2"], [2, 4, "#8DB86B", "%2–4"], [4, 8, "#D9B43B", "Tipik %4–8"], [8, 10, "#D9822B", "%8–10"], [10, 15, "#C8373B", "Kritik >%10"]];
  const max = 15, y = 20, bh = 14, h = 62;
  const o = [`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">`];
  bands.forEach(([a, b, col, name]) => {
    const x0 = (a / max) * w, x1 = (b / max) * w;
    o.push(`<rect x="${(x0 + 1).toFixed(1)}" y="${y}" width="${(x1 - x0 - 2).toFixed(1)}" height="${bh}" rx="2" fill="${col}" opacity=".85"/>`);
    o.push(`<text x="${((x0 + x1) / 2).toFixed(1)}" y="${y + bh + 15}" text-anchor="middle" class="t-xxs">${esc(name)}</text>`);
  });
  const v = Math.min(max, Math.max(0, m.totals.copqPctOfRevenue));
  const xv = (v / max) * w;
  o.push(`<path d="M${(xv - 6).toFixed(1)},${y - 12} L${(xv + 6).toFixed(1)},${y - 12} L${xv.toFixed(1)},${y - 2} Z" fill="#1B2430"/>`);
  o.push(`<text x="${(xv + 8).toFixed(1)}" y="${y - 5}" class="t-xs b">${pct(m.totals.copqPctOfRevenue)}</text></svg>`);
  return o.join("");
}

function profitSvg(m: LossReportModel, w = 520, h = 210): string {
  const pc = m.profitCurve;
  if (pc.length < 2) return `<p class="empty">Geri kazanım ya da faaliyet kârı oranı girilmediği için kâr eğrisi çizilemedi.</p>`;
  const max = Math.max(1, ...pc.map(p => p.margin)) * 1.15;
  const padB = 46, padT = 16, cw = w / pc.length;
  const o = [`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">`];
  pc.forEach((p, i) => {
    const bh = ((h - padB - padT) * Math.max(0, p.margin)) / max;
    const x = i * cw + cw * 0.18, bw = cw * 0.64;
    o.push(`<rect x="${x.toFixed(1)}" y="${(h - padB - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${i === 0 ? "#9AA3AE" : i === pc.length - 1 ? "#3A9A5B" : "#2F6FA8"}"/>`);
    o.push(`<text x="${(x + bw / 2).toFixed(1)}" y="${(h - padB - bh - 4).toFixed(1)}" text-anchor="middle" class="t-s b">%${num(p.margin, 1)}</text>`);
    const label = p.stage.length > 26 ? p.stage.slice(0, 25) + "…" : p.stage;
    o.push(`<text x="${(x + bw / 2).toFixed(1)}" y="${h - padB + 14}" text-anchor="middle" class="t-xxs">${esc(label)}</text>`);
  });
  o.push("</svg>");
  return o.join("");
}

// ---------- page frame ----------

class Pages {
  list: string[] = [];
  entries: { key: string; page: number }[] = [];
  private no = 1;
  constructor(private m: LossReportModel, public pageOf: Record<string, number> = {}) {}
  raw(html: string) { this.list.push(html); }
  entry(key: string) { this.entries.push({ key, page: this.no + 1 }); }
  page(body: string, section: string) {
    this.no += 1;
    this.list.push(`<section class="page">
<header class="ph"><img class="logo-s" src="${LOGO}" alt="${esc(C.company.shortName)}"><span class="sec">${esc(section)}</span></header>
${body}
<footer class="pf"><span>${esc(this.m.firm)} · ${esc(LOSS_REPORT.kicker)} · No ${esc(this.m.reportNo)}</span><span>${esc(C.report.footerConfidential)}</span><span>${this.no}</span></footer>
</section>`);
  }
}

// ---------- rule-based texts ----------

const lossOrder = (m: LossReportModel) => [...m.lossLines].filter(l => l.year > 0).sort((a, b) => b.year - a.year);
const topRecovery = (m: LossReportModel, n: number) => [...m.recovery].filter(r => r.avgGain > 0).sort((a, b) => b.avgGain - a.avgGain).slice(0, n);

function execHeadline(m: LossReportModel): string {
  const t = m.totals;
  const lines = lossOrder(m);
  if (t.lossYear <= 0) {
    return `Kayıp tutarı henüz hesaplanamıyor: <em>ölçülen kayıp verisi ya da birim maliyet eksik</em>. Rapordaki veri boşlukları tamamlandığında tutarlar oluşur.`;
  }
  const top = lines.slice(0, 2).map(l => esc(l.label.toLocaleLowerCase("tr-TR"))).join(" ve ");
  const share = m.revenue > 0 ? ` (cironun <em>${pct(t.lossPctOfRevenue)}</em>'i)` : "";
  return `Ölçülen operasyonel kayıplar yılda <em>${moneyShort(m, t.lossYear)}</em>${share}; en büyük pay ${top}. ` +
    (t.recoveryAvg > 0 ? `Geri kazanım matrisi bunun <em>${moneyShort(m, t.recoveryAvg)}</em>'lik kısmını hedefliyor.` : `Geri kazanım hedefi henüz oluşmadı.`);
}

function managementAsks(m: LossReportModel): string[] {
  const asks: string[] = [];
  topRecovery(m, 3).forEach((r, i) => {
    asks.push(`<b>Öncelik ${i + 1} — ${esc(r.subject)}:</b> ${esc(r.leanTool)} ile Kobetsu Kaizen projesi${r.projects > 0 ? ` (${r.projects} proje açık)` : " açılması"}; ortalama yıllık hedef ${moneyShort(m, r.avgGain)}`);
  });
  const unresolved = m.lossLines.filter(l => l.unresolved.length > 0);
  if (unresolved.length > 0 || m.rateSourceCounts.none > 0) {
    asks.push(`<b>Veri:</b> ${unresolved.length} kayıp kaleminde birim maliyet bulunamadı; birim maliyetlerin finans ile teyit edilip girilmesi`);
  }
  if (m.totals.stationsWithOee < m.totals.stationCount) {
    asks.push(`<b>Ölçüm:</b> ${m.totals.stationCount - m.totals.stationsWithOee} istasyonda OEE yok; vardiya bazında OEE ve duruş kaydının başlatılması`);
  }
  asks.push(`<b>Yönetim ritmi:</b> Kayıp maliyetinin aylık gözden geçirilmesi ve gerçekleşen tasarrufun CI projeleri üzerinden izlenmesi`);
  return asks.slice(0, 5);
}

// ---------- pages ----------

function coverPage(m: LossReportModel): string {
  const conf = C.report.confidentialityNote.replace("{firma}", esc(m.firm));
  return `<section class="page cover">
<svg class="cv-shape" viewBox="0 0 600 794" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
 <polygon points="120,0 600,0 600,794 470,794" fill="#ECEDEF"/>
 <polygon points="330,0 470,0 600,250 600,330" fill="#D7141A"/>
 <polygon points="560,330 600,330 600,410" fill="#D7141A"/>
 <polygon points="230,560 380,560 500,794 350,794" fill="#D7141A"/>
 <polygon points="140,560 230,560 250,600 160,600" fill="#D7141A" opacity=".85"/>
</svg>
<div class="cv-body">
 <img class="logo-l" src="${LOGO}" alt="${esc(C.company.shortName)}">
 <div class="cv-title">
  <p class="kicker">${esc(LOSS_REPORT.kicker)}</p>
  <h1>${LOSS_REPORT.titleLines.map(esc).join("<br>")}</h1>
  <p class="cv-sub">${esc(LOSS_REPORT.subtitle)}</p>
  <div class="cv-client"><span>Hazırlanan kurum</span><b>${esc(m.firm)}</b></div>
 </div>
 <table class="doc">
  <tr><th>Rapor no</th><td>${esc(m.reportNo)}</td><th>Rapor tarihi</th><td>${fmtDate(m.reportDate)}</td></tr>
  <tr><th>Kapsam</th><td>${esc(m.scopeLabel || "Tüm fabrika")}</td><th>Sektör</th><td>${esc(m.industry || "—")}</td></tr>
  <tr><th>Model cirosu</th><td>${m.revenue > 0 ? money(m, m.revenue) : "Girilmedi"}</td><th>İstasyon</th><td>${m.totals.stationCount}</td></tr>
  <tr><th>Hazırlayan</th><td colspan="3">${esc(m.preparedBy || "—")} — ${esc(C.company.shortName)}</td></tr>
  <tr><th>Gizlilik</th><td colspan="3">${conf}</td></tr>
 </table>
</div>
<footer class="cv-foot"><span>${esc(C.company.legalName)}</span><span>${esc(C.company.website)}</span></footer>
</section>`;
}

const TOC: { key: string; title: string; sub: string }[] = [
  { key: "exec", title: "Yönetici özeti", sub: "Yıllık kayıp, COPQ, geri kazanım hedefi ve yönetimden beklenen kararlar" },
  { key: "method", title: "Metod ve veri kaynakları", sub: "Ölçüm → birim maliyet → kayıp maliyeti; birim maliyetlerin kaynağı" },
  { key: "pool", title: "Kayıp havuzu", sub: "Kayıp kalemleri, yıllık tutar ve ciroya oran" },
  { key: "stations", title: "İstasyon bazında kayıplar", sub: "OEE, ölçülen kayıplar ve maliyetleri" },
  { key: "tpm", title: "Loss Cost analizi", sub: "16 büyük kayıp × maliyet unsuru, Pareto, OEE kayıp yapısı" },
  { key: "copq", title: "Kalitesizlik maliyeti (COPQ)", sub: "İç / dış hata, muayene, kapasite ve akış kayıpları; finansal matris" },
  { key: "recovery", title: "Geri kazanım matrisi", sub: "İyileştirme oranları, kazanç aralığı, yatırım ve geri ödeme" },
  { key: "roadmap", title: "Öncelikli yol haritası", sub: "En yüksek kazançlı üç alan ve açılan CI projeleri" },
  { key: "pl", title: "Finansal etki", sub: "Maliyet yapısı, faaliyet kârı ve marj etkisi" },
  { key: "assumptions", title: "Varsayımlar ve veri boşlukları", sub: "Hesapta kullanılan kabuller ve tamamlanması gereken veriler" }
];

function tocPage(p: Pages) {
  const known = Object.keys(p.pageOf).length > 0;
  const rows = TOC.filter(t => !known || p.pageOf[t.key])
    .map((t, i) => `<li><span class="toc-no">${i + 1}</span><div><b>${esc(t.title)}</b><small>${esc(t.sub)}</small></div><span class="toc-dots"></span><span class="toc-pg">${p.pageOf[t.key] ?? ""}</span></li>`)
    .join("");
  p.page(`<h2 class="headline">İçindekiler</h2><ol class="toc">${rows}</ol>`, "İçindekiler");
}

function execPage(p: Pages, m: LossReportModel) {
  p.entry("exec");
  const t = m.totals;
  const lines = lossOrder(m);
  const facts: string[] = [];
  facts.push(`<li><b>${moneyShort(m, t.copqYear)}</b> kalitesizlik maliyeti (COPQ)${m.revenue > 0 ? ` — cironun ${pct(t.copqPctOfRevenue)}'i` : ""}</li>`);
  facts.push(`<li><b>${t.avgOee !== null ? `%${num(t.avgOee, 1)}` : "—"}</b> ortalama OEE · ${t.stationsWithOee} / ${t.stationCount} istasyonda OEE ölçülü${t.oeeLossSharePct !== null ? ` · yükleme süresinin ${pct(t.oeeLossSharePct)}'i kayıp` : ""}</li>`);
  facts.push(`<li><b>${moneyShort(m, t.jipmTotal)}</b> Loss Cost analizi (16 büyük kayıp) toplamı${t.jipmContribution > 0 ? ` · ayrıca talep varsa ${moneyShort(m, t.jipmContribution)} kayıp katkı payı` : ""}</li>`);
  facts.push(`<li><b>${t.equivalentOperators > 0 ? `${num(t.equivalentOperators, 1)} kişi` : "—"}</b> gizli fabrikanın tam zamanlı operatör eşdeğeri</li>`);
  if (t.realizedSavings > 0) facts.push(`<li><b>${moneyShort(m, t.realizedSavings)}</b> tamamlanan CI projelerinde gerçekleşen tasarruf</li>`);
  const rank = lines.slice(0, 4).map(l => `<li><b>${esc(l.label)}</b><span>${moneyShort(m, l.year)}</span></li>`).join("");
  const asks = managementAsks(m).map(a => `<li>${a}</li>`).join("");
  p.page(`
<h2 class="headline sm">${execHeadline(m)}</h2>
<div class="kpis">
 <div class="kpi-s" style="--c:#D7141A"><p class="label">Yıllık kayıp</p><p class="v">${moneyShort(m, t.lossYear)}</p><p class="d">${m.revenue > 0 ? `Cironun ${pct(t.lossPctOfRevenue)}'i` : "Ciro girilmedi"}</p></div>
 <div class="kpi-s" style="--c:#C8373B"><p class="label">Kalitesizlik maliyeti</p><p class="v">${moneyShort(m, t.copqYear)}</p><p class="d">${esc(t.benchmarkStatus || "")}</p></div>
 <div class="kpi-s" style="--c:#3A9A5B"><p class="label">Geri kazanım hedefi (ort.)</p><p class="v">${moneyShort(m, t.recoveryAvg)}</p><p class="d">Aralık ${moneyShort(m, t.recoveryMin)} – ${moneyShort(m, t.recoveryMax)}</p></div>
 <div class="kpi-s" style="--c:#2F6FA8"><p class="label">Gerekli yatırım</p><p class="v">${moneyShort(m, t.investment)}</p><p class="d">${t.investment > 0 && t.recoveryAvg > 0 ? `Geri ödeme ≈ ${num((t.investment / t.recoveryAvg) * 12, 1)} ay` : "—"}</p></div>
</div>
<div class="grid-2e">
 <div class="card"><p class="label">Tek bakışta</p><ul class="facts">${facts.slice(0, 4).join("")}</ul>
  <p class="label mt">En büyük kayıp kalemleri (yıllık)</p>${rank ? `<ol class="rank bad">${rank}</ol>` : `<p class="note">Fiyatlanmış kayıp kalemi yok.</p>`}</div>
 <div class="card ask"><p class="label">Yönetimden beklenen kararlar</p><ol class="asks">${asks}</ol></div>
</div>`, "Yönetici özeti");
}

function methodPage(p: Pages, m: LossReportModel) {
  p.entry("method");
  const flow: [string, string][] = [
    ["Saha ölçümü", "VSM istasyon verisi: adet, C/T, duruş, hurda, stok"],
    ["Birim maliyet", "Girilen → VSM → şirket kartı (QLA)"],
    ["Kayıp maliyeti", "Ölçülen kayıp × birim maliyet"],
    ["COPQ & Loss Cost", "Kalitesizlik ve 16 büyük kayıp"],
    ["Geri kazanım", "İyileştirme oranı, yatırım, geri ödeme"]
  ];
  const flowHtml = flow.map(([t, d], i) => `<div class="fl"><span>${i + 1}</span><b>${esc(t)}</b><small>${esc(d)}</small></div>`).join("");
  const rc = m.rateSourceCounts;
  const srcs = `<div class="srcs">
   <div style="--c:${SOURCE_COLOR.birim}"><b>${rc.birim}</b><span>Danışmanın girdiği birim tutar</span></div>
   <div style="--c:${SOURCE_COLOR.vsm}"><b>${rc.vsm}</b><span>VSM Kurulum birim maliyeti</span></div>
   <div style="--c:${SOURCE_COLOR.kart}"><b>${rc.kart}</b><span>Şirket kartından türetilen (QLA)</span></div>
   <div style="--c:#C8373B"><b>${rc.none}</b><span>Bulunamayan (kayıp hesaba girmedi)</span></div></div>`;
  const cb = m.cardBasis;
  const cs = m.costStructure;
  p.page(`
<h2 class="headline">Metod: kayıplar sahada ölçülür, her istasyonda birim maliyetle fiyatlanır. Birim maliyet önce danışmanın girdiği tutardan, yoksa VSM'den, o da yoksa şirket kartından türetilir.</h2>
<div class="flow">${flowHtml}</div>
<div class="grid-2e">
 <div class="card"><p class="label">Birim maliyetlerin kaynağı (istasyon × 5 tutar)</p>${srcs}
  <p class="label mt">Şirket kartı tabanı</p>
  <ul class="fx">
   <li><b>Yıllık ciro / adet</b><span>${m.revenue > 0 ? money(m, m.revenue) : "girilmedi"} · ${m.annualVolume > 0 ? `${fmtInt(m.annualVolume)} adet` : "adet girilmedi"}</span></li>
   <li><b>Maliyet yapısı</b><span>Malzeme %${num(cs.material)} · İşçilik %${num(cs.labor)} · Enerji %${num(cs.energy)} · Bakım %${num(cs.maintenance)} · Genel %${num(cs.overhead)} · Faaliyet kârı %${num(cs.operatingProfit)}</span></li>
   <li><b>İşgücü</b><span>${cb.blueCollar || "—"} mavi yaka × ${cb.hoursPerPersonYear ? fmtInt(cb.hoursPerPersonYear) : "—"} saat/yıl · stok taşıma ${cb.holdingRatePct ? `%${num(cb.holdingRatePct)}` : "girilmedi"}</span></li>
  </ul></div>
 <div class="card"><p class="label">Şirket kartından türetilen birim maliyetler (Gemba QLA formülleri)</p>
  <ul class="fx">
   <li><b>Hurda / adet</b><span>${esc(cb.scrapUnit)}</span></li>
   <li><b>Rework / adet</b><span>${esc(cb.reworkUnit)}</span></li>
   <li><b>İşçilik / kişi-saat</b><span>${esc(cb.laborHour)}</span></li>
   <li><b>Makine / saat</b><span>${esc(cb.machineHour)}</span></li>
   <li><b>Stok / adet / yıl</b><span>${esc(cb.wipHolding)}</span></li>
  </ul>
  <p class="note">Duruş ve setup saati = makine saati × makine sayısı + işçilik saati × operatör. Makine saat maliyeti hat bazında girilir (her hattın maliyeti farklı).</p></div>
</div>`, "Metod ve veri kaynakları");
}

function poolPage(p: Pages, m: LossReportModel) {
  p.entry("pool");
  const lines = [...m.lossLines].sort((a, b) => b.year - a.year);
  const total = m.totals.lossYear;
  const rows = lines.map(l => `<tr><td><b>${esc(l.label)}</b>${l.real ? ` <span class="chip" style="--c:#2F6FA8">gerçek veri</span>` : ""}${l.unresolved.length ? `<span class="w">Hesaplanamadı: ${esc(l.unresolved.slice(0, 4).join(", "))}${l.unresolved.length > 4 ? ` +${l.unresolved.length - 4}` : ""}</span>` : ""}</td>` +
    `<td class="r">${dash(l.year / 260, v => money(m, v))}</td><td class="r">${dash(l.year * 22 / 260, v => money(m, v))}</td><td class="r b">${dash(l.year, v => money(m, v))}</td>` +
    `<td class="r">${total > 0 && l.year > 0 ? pct((l.year / total) * 100) : "—"}</td><td class="r">${m.revenue > 0 && l.year > 0 ? pct((l.year / m.revenue) * 100, 2) : "—"}</td></tr>`).join("");
  p.page(`
<h2 class="headline">Kayıp havuzu: yılda <em>${moneyShort(m, total)}</em>${m.revenue > 0 ? `, cironun ${pct(m.totals.lossPctOfRevenue)}'i` : ""}. Kalemler ölçülen kayıp × birim maliyetten; "gerçek veri" işaretliler müşterinin muhasebe rakamıdır.</h2>
<div class="grid-21">
 <div class="card flush"><table class="tbl num"><thead><tr><th>Kayıp kalemi</th><th class="r">Günlük</th><th class="r">Aylık</th><th class="r">Yıllık</th><th class="r">Pay</th><th class="r">Ciroya oran</th></tr></thead>
  <tbody>${rows}<tr class="tot"><td>Toplam</td><td class="r">${money(m, total / 260)}</td><td class="r">${money(m, total * 22 / 260)}</td><td class="r">${money(m, total)}</td><td class="r">%100</td><td class="r">${m.revenue > 0 ? pct(m.totals.lossPctOfRevenue, 2) : "—"}</td></tr></tbody></table>
  <p class="note">Gün = yıllık / 260 iş günü; ay = 22 iş günü. Fazla mesai, geç teslimat ve enerji yalnızca girilen gerçek tutarla yer alır.</p></div>
 <div class="card"><p class="label">Yıllık kayıp — büyükten küçüğe</p>${hBars(m, lines.filter(l => l.year > 0).map(l => ({ label: l.label, value: l.year })), 520, 26)}</div>
</div>`, "Kayıp havuzu");
}

function stationPages(p: Pages, m: LossReportModel) {
  p.entry("stations");
  const st = [...m.stations].sort((a, b) => {
    const ta = Object.values(a.costs).reduce((s, v) => s + (v || 0), 0), tb = Object.values(b.costs).reduce((s, v) => s + (v || 0), 0);
    return tb - ta;
  });
  if (st.length === 0) {
    p.page(`<h2 class="headline">İstasyon bazında kayıplar</h2><p class="empty">Maliyet tablosunda istasyon yok. VSM projesine proses girilip kaydedildiğinde istasyonlar burada listelenir.</p>`, "İstasyon bazında kayıplar");
    return;
  }
  const maxTotal = Math.max(1, ...st.map(s => Object.values(s.costs).reduce((a, v) => a + (v || 0), 0)));
  const heat = (v: number) => `background:rgba(215,20,26,${(0.08 + 0.5 * (v / maxTotal)).toFixed(2)})`;
  const per = LOSS_REPORT.stationRowsPerPage;
  for (let i = 0; i < st.length; i += per) {
    const chunk = st.slice(i, i + per);
    const rows = chunk.map(s => {
      const total = Object.values(s.costs).reduce((a, v) => a + (v || 0), 0);
      const c = (k: keyof typeof s.costs) => (s.costs[k] !== undefined ? (s.costs[k]! > 0 ? moneyShort(m, s.costs[k]!) : "0") : `<span class="na">—</span>`);
      return `<tr><td><b>${esc(s.name)}</b>${s.line ? `<span class="w">${esc(s.line)}</span>` : ""}${s.missingInputs ? `<span class="w">${s.missingInputs} girdi eksik</span>` : ""}</td>` +
        `<td class="r">${s.oee !== null ? `%${num(s.oee, 1)}` : `<span class="na">—</span>`}${s.oeeSource ? `<span class="w">${s.oeeSource}</span>` : ""}</td>` +
        `<td class="r">${fmtInt(s.scrapQty)} / ${fmtInt(s.reworkQty)}</td><td class="r">${num(s.breakdownMinPerDay, 0)} / ${num(s.setupMinPerDay, 0)}</td><td class="r">${fmtInt(s.wip)}</td>` +
        `<td class="r">${c("scrap")}</td><td class="r">${c("rework")}</td><td class="r">${c("downtime")}</td><td class="r">${c("setup")}</td><td class="r">${c("laborLoss")}</td><td class="r">${c("inventory")}</td>` +
        `<td class="r"><span class="heat" style="${heat(total)}"><b>${moneyShort(m, total)}</b></span></td></tr>`;
    }).join("");
    const head = i === 0
      ? `<h2 class="headline sm">İstasyon bazında kayıplar: en yüksek kayıp <em>${esc(st[0].name)}</em> istasyonunda. Adet ve dakikalar günlük, tutarlar yıllıktır; "—" birim maliyet bulunamayan kalemdir.</h2>`
      : "";
    const cont = st.length > per ? ` (${Math.floor(i / per) + 1}/${Math.ceil(st.length / per)})` : "";
    p.page(`${head}<table class="tbl num xs"><thead><tr><th>İstasyon</th><th class="r">OEE</th><th class="r">Hurda / Rework (adet/gün)</th><th class="r">Arıza / Setup (dk/gün)</th><th class="r">WIP</th><th class="r">Hurda</th><th class="r">Rework</th><th class="r">Arıza</th><th class="r">Setup</th><th class="r">Norm fazlası</th><th class="r">Stok</th><th class="r">Toplam / yıl</th></tr></thead><tbody>${rows}</tbody></table>`,
      `İstasyon bazında kayıplar${cont}`);
  }
}

function tpmPages(p: Pages, m: LossReportModel) {
  p.entry("tpm");
  const J = m.jipm;
  const groups = ["Ekipman", "İnsan", "Kaynak"];
  const rows = groups.map(g => {
    const ls = J.lines.filter(l => l.group === g);
    const sub = ls.reduce((s, l) => s + l.total, 0);
    return `<tr class="grp"><td colspan="9">${esc(g)} kayıpları · ${moneyShort(m, sub)}</td></tr>` + ls.map(l => {
      const time = l.no <= 8 ? (l.minutesPerDay > 0 ? `${num(l.minutesPerDay, 1)} dk` : "—") : l.no <= 13 ? (l.personHoursPerDay > 0 ? `${num(l.personHoursPerDay, 1)} kişi-sa` : "—") : "—";
      const tot = l.total > 0 ? moneyShort(m, l.total) : l.unpricedAt.length ? `<span class="na">hesaplanamadı</span>` : `<span class="na">—</span>`;
      return `<tr><td class="id">${l.no}</td><td><b>${esc(l.name)}</b><span class="src">${esc(l.sources.join(", ") || "veri yok")}</span></td><td class="r">${time}</td>` +
        `<td class="r">${dash(l.labor, v => moneyShort(m, v))}</td><td class="r">${dash(l.machine, v => moneyShort(m, v))}</td><td class="r">${dash(l.material, v => moneyShort(m, v))}</td><td class="r">${dash(l.direct, v => moneyShort(m, v))}</td>` +
        `<td class="r b">${tot}</td><td class="r">${dash(l.contribution, v => moneyShort(m, v))}</td></tr>`;
    }).join("");
  }).join("");
  const unexpl = J.unexplained.minutes > 0.05
    ? `<tr><td></td><td><b>Dağıtılamayan OEE kaybı</b><span class="w">OEE kaybı − ölçülen kayıplar</span></td><td class="r">${num(J.unexplained.minutes, 1)} dk</td><td colspan="4"></td><td class="r b">${dash(J.unexplained.cost, v => moneyShort(m, v))}</td><td></td></tr>` : "";
  p.page(`
<h2 class="headline sm">Loss Cost analizi (16 büyük kayıp): yılda <em>${moneyShort(m, m.totals.jipmTotal)}</em>; OEE kaybı kullanılabilirlik, performans ve kalite kayıplarına dağıtılır.</h2>
<table class="tbl num xs"><thead><tr><th>No</th><th>Kayıp (kaynak)</th><th class="r">Süre / gün</th><th class="r">İşçilik</th><th class="r">Makine</th><th class="r">Malzeme</th><th class="r">Enerji / takım</th><th class="r">Yıllık toplam</th><th class="r">Kayıp katkı payı*</th></tr></thead>
<tbody>${rows}${unexpl}<tr class="tot"><td></td><td>Toplam</td><td></td><td colspan="4"></td><td class="r">${moneyShort(m, m.totals.jipmTotal)}</td><td class="r">${dash(m.totals.jipmContribution, v => moneyShort(m, v))}</td></tr></tbody></table>
<p class="note">* Plana göre eksik üretim varsa kayıp sürede üretilebilecek adet × birim katkı payı; plan açığıyla sınırlıdır, toplama eklenmez. Süreler tüm istasyonların günlük toplamıdır.</p>`, "Loss Cost analizi");

  const pareto = paretoSvg(m, J.lines.map(l => ({ label: `${l.no}. ${l.name}`, value: l.total })).concat(J.unexplained.cost > 0 ? [{ label: "Dağıtılamayan OEE", value: J.unexplained.cost }] : []));
  const top3 = [...J.lines].filter(l => l.total > 0).sort((a, b) => b.total - a.total).slice(0, 3);
  const kk = top3.map((l, i) => `<li><b>${i + 1}. ${esc(l.name)}</b> — ${moneyShort(m, l.total)}<span class="w">${esc(l.tool)}</span></li>`).join("");
  p.page(`
<h2 class="headline sm">Kayıp Pareto'su ve OEE kayıp yapısı: ${top3.length ? `ilk üç kayıp (${top3.map(l => esc(l.name.toLocaleLowerCase("tr-TR"))).join(", ")}) Kobetsu Kaizen için önceliklidir.` : "fiyatlanmış kayıp yok."}</h2>
<div class="grid-21">
 <div class="card"><p class="label">Loss Cost Pareto'su (yıllık, kümülatif %)</p>${pareto}</div>
 <div class="card"><p class="label">Kobetsu Kaizen öncelikleri</p>${kk ? `<ol class="rank plain">${kk}</ol>` : `<p class="empty">—</p>`}
  <p class="label mt">İstasyon OEE kayıp yapısı (yükleme süresine göre)</p>${oeeStackSvg(m, 520)}</div>
</div>`, "Loss Cost analizi");
}

function copqPages(p: Pages, m: LossReportModel) {
  p.entry("copq");
  const groups: LossReportModel["copq"][number]["group"][] = ["İç hata", "Dış hata", "Muayene", "Kapasite & akış"];
  const rows = groups.map(g => {
    const items = m.copq.filter(c => c.group === g);
    const sub = items.reduce((s, c) => s + c.year, 0);
    return `<tr class="grp"><td colspan="3">${esc(g)} · ${moneyShort(m, sub)}</td></tr>` + items.map(c =>
      `<tr><td>${esc(c.label)}${c.entered ? ` <span class="chip" style="--c:#2F6FA8">müşteri verisi</span>` : ""}</td><td class="r">${c.year > 0 ? money(m, c.year) : `<span class="na">${c.entered ? "0" : "girilmedi"}</span>`}</td><td class="r">${m.revenue > 0 && c.year > 0 ? pct((c.year / m.revenue) * 100, 2) : "—"}</td></tr>`).join("");
  }).join("");
  const byGroup = groups.map(g => ({ label: g, value: m.copq.filter(c => c.group === g).reduce((s, c) => s + c.year, 0) }));
  p.page(`
<h2 class="headline sm">Kalitesizlik maliyeti (COPQ) yılda <em>${moneyShort(m, m.totals.copqYear)}</em>${m.revenue > 0 ? ` — cironun ${pct(m.totals.copqPctOfRevenue)}'i (${esc(m.totals.benchmarkStatus)})` : ""}. Dış hata ve muayene kalemleri yalnızca müşterinin verdiği tutarlardır.</h2>
<div class="grid-21">
 <div class="card flush"><table class="tbl num sm"><thead><tr><th>Kalem</th><th class="r">Yıllık</th><th class="r">Ciroya oran</th></tr></thead><tbody>${rows}<tr class="tot"><td>Toplam COPQ</td><td class="r">${money(m, m.totals.copqYear)}</td><td class="r">${m.revenue > 0 ? pct(m.totals.copqPctOfRevenue, 2) : "—"}</td></tr></tbody></table></div>
 <div class="card"><p class="label">Ciroya oranla konum</p>${m.revenue > 0 ? copqBandSvg(m) : `<p class="empty">Ciro girilmedi.</p>`}
  <p class="label mt">Gruplara göre</p>${hBars(m, byGroup, 500, 26)}</div>
</div>`, "Kalitesizlik maliyeti (COPQ)");

  const areas = Array.from(new Set(m.recovery.map(r => r.area)));
  const mrows = areas.map(a => `<tr class="grp"><td colspan="5">${esc(a)}</td></tr>` + m.recovery.filter(r => r.area === a).map(r =>
    `<tr><td><b>${esc(r.subject)}</b><span class="w">${esc(r.costGroup)}</span></td><td class="mini">${esc(r.basis)}</td><td class="r">${dash(r.lossMin, v => money(m, v))}</td><td class="r">${dash(r.lossMax, v => money(m, v))}</td><td class="r b">${dash(r.avgLoss, v => money(m, v))}</td></tr>`).join("")).join("");
  p.page(`
<h2 class="headline sm">COPQ finansal matrisi: her satır ölçülen ya da fiyatlanan kayıptır; aralık Gemba QLA'daki ±%20 belirsizlik bandıdır. Başka satırın kapsadığı kalemler çift sayılmamak için 0'dır.</h2>
<table class="tbl num sm"><thead><tr><th>Fırsat alanı / konu</th><th>Kaynak</th><th class="r">Min</th><th class="r">Max</th><th class="r">Ortalama</th></tr></thead><tbody>${mrows}</tbody></table>`, "COPQ finansal matrisi");
}

function recoveryPages(p: Pages, m: LossReportModel) {
  p.entry("recovery");
  const rows = [...m.recovery].sort((a, b) => b.avgGain - a.avgGain);
  const per = LOSS_REPORT.recoveryRowsPerPage;
  const fmtRow = (r: LossReportRecoveryRow) => {
    const [sev, col] = SEVERITY[r.severity] || ["—", "#9AA3AE"];
    return `<tr><td><b>${esc(r.subject)}</b><span class="w">${esc(r.leanTool)}</span></td><td><span class="prio" style="--c:${col}">${sev}</span></td>` +
      `<td class="r">${dash(r.avgLoss, v => moneyShort(m, v))}</td><td class="r">%${num(r.improvementMin, 0)}–${num(r.improvementMax, 0)}</td>` +
      `<td class="r">${dash(r.gainMin, v => moneyShort(m, v))} – ${dash(r.gainMax, v => moneyShort(m, v))}</td><td class="r b">${dash(r.avgGain, v => moneyShort(m, v))}</td>` +
      `<td class="r">${dash(r.investment, v => moneyShort(m, v))}</td><td class="r">${r.paybackMonths !== null && r.avgGain > 0 ? `${num(r.paybackMonths, 1)} ay` : "—"}</td>` +
      `<td class="r">${dash(r.realizedSavings, v => moneyShort(m, v))}</td><td class="c">${r.projects || "—"}</td></tr>`;
  };
  for (let i = 0; i < Math.max(1, rows.length); i += per) {
    const chunk = rows.slice(i, i + per);
    const last = i + per >= rows.length;
    const tot = last ? `<tr class="tot"><td>Toplam</td><td></td><td class="r">${moneyShort(m, rows.reduce((s, r) => s + r.avgLoss, 0))}</td><td></td><td class="r">${moneyShort(m, m.totals.recoveryMin)} – ${moneyShort(m, m.totals.recoveryMax)}</td><td class="r">${moneyShort(m, m.totals.recoveryAvg)}</td><td class="r">${moneyShort(m, m.totals.investment)}</td><td class="r">${m.totals.investment > 0 && m.totals.recoveryAvg > 0 ? `${num((m.totals.investment / m.totals.recoveryAvg) * 12, 1)} ay` : "—"}</td><td class="r">${dash(m.totals.realizedSavings, v => moneyShort(m, v))}</td><td></td></tr>` : "";
    const head = i === 0 ? `<h2 class="headline sm">Geri kazanım matrisi: ortalama yıllık hedef <em>${moneyShort(m, m.totals.recoveryAvg)}</em> (aralık ${moneyShort(m, m.totals.recoveryMin)} – ${moneyShort(m, m.totals.recoveryMax)}). İyileştirme oranları projeksiyon varsayımıdır; gerçekleşen tasarruf CI projelerinden gelir.</h2>` : "";
    p.page(`${head}<table class="tbl num xs"><thead><tr><th>Konu / yalın araç</th><th>Öncelik</th><th class="r">Yıllık kayıp</th><th class="r">İyileştirme</th><th class="r">Kazanç aralığı</th><th class="r">Ort. kazanç</th><th class="r">Yatırım</th><th class="r">Geri ödeme</th><th class="r">Gerçekleşen</th><th class="c">CI proje</th></tr></thead><tbody>${chunk.map(fmtRow).join("")}${tot}</tbody></table>`,
      `Geri kazanım matrisi${rows.length > per ? ` (${Math.floor(i / per) + 1}/${Math.ceil(rows.length / per)})` : ""}`);
  }
}

function roadmapPage(p: Pages, m: LossReportModel) {
  const top = topRecovery(m, 3);
  p.entry("roadmap");
  if (top.length === 0) {
    p.page(`<h2 class="headline">Öncelikli yol haritası</h2><p class="empty">Geri kazanım hedefi olan konu yok; kayıp verisi ve birim maliyetler tamamlandığında öncelikler oluşur.</p>`, "Öncelikli yol haritası");
    return;
  }
  const waves = top.map((r, i) => `<div class="wave"><p class="when">Öncelik ${i + 1}</p><h3>${esc(r.subject)}</h3><ul>
   <li><b>Yalın araç:</b> ${esc(r.leanTool)}</li>
   <li><b>Yıllık kayıp:</b> ${moneyShort(m, r.avgLoss)} <span class="mini">(${esc(r.basis)})</span></li>
   <li><b>Hedef kazanç:</b> ${moneyShort(m, r.gainMin)} – ${moneyShort(m, r.gainMax)} (ort. ${moneyShort(m, r.avgGain)})</li>
   <li><b>Yatırım / geri ödeme:</b> ${dash(r.investment, v => moneyShort(m, v))} · ${r.paybackMonths !== null ? `${num(r.paybackMonths, 1)} ay` : "—"}</li>
   <li><b>CI proje:</b> ${r.projects > 0 ? `${r.projects} proje açık` : "henüz açılmadı"}${r.realizedSavings > 0 ? ` · gerçekleşen ${moneyShort(m, r.realizedSavings)}` : ""}</li></ul>
   <p class="kpi-line"><b>İzleme ölçütü:</b> ${esc(r.subject)} kaynaklı yıllık kayıp (${esc(r.costGroup)})</p></div>`).join("");
  const rest = [...m.recovery].filter(r => r.avgGain > 0).sort((a, b) => b.avgGain - a.avgGain).slice(3, 9);
  const restRows = rest.map(r => `<tr><td>${esc(r.subject)}</td><td>${esc(r.leanTool)}</td><td class="r">${moneyShort(m, r.avgGain)}</td><td class="c">${r.projects || "—"}</td></tr>`).join("");
  p.page(`
<h2 class="headline">Öncelikli yol haritası: ${top.map(r => esc(r.subject.toLocaleLowerCase("tr-TR"))).join(", ")}. Sıra beklenen ortalama kazanca göredir; süre ya da sonuç taahhüdü içermez.</h2>
<div class="waves">${waves}</div>
${restRows ? `<table class="tbl xs"><thead><tr><th>Sonraki fırsatlar</th><th>Yalın araç</th><th class="r">Ort. kazanç</th><th class="c">CI proje</th></tr></thead><tbody>${restRows}</tbody></table>` : ""}`, "Öncelikli yol haritası");
}

function plPage(p: Pages, m: LossReportModel) {
  p.entry("pl");
  const cs = m.costStructure;
  const R = m.revenue;
  const items: [string, number][] = [["Direkt malzeme", cs.material], ["Direkt işçilik", cs.labor], ["Enerji", cs.energy], ["Bakım", cs.maintenance], ["Genel giderler", cs.overhead], ["Faaliyet kârı", cs.operatingProfit]];
  const rows = items.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="r">%${num(v)}</td><td class="r">${R > 0 && v > 0 ? money(m, (R * v) / 100) : "—"}</td></tr>`).join("");
  const ebitda = (R * cs.operatingProfit) / 100;
  const newEbitda = ebitda + m.totals.recoveryAvg;
  const filled = items.some(([, v]) => v > 0);
  p.page(`
<h2 class="headline">Finansal etki: geri kazanım hedefi faaliyet kârına eklenirse marj <em>%${num(cs.operatingProfit)}</em>'dan <em>%${num(R > 0 ? (newEbitda / R) * 100 : 0)}</em>'a çıkar${ebitda > 0 ? ` (faaliyet kârında %${num((m.totals.recoveryAvg / ebitda) * 100)} artış)` : ""}.</h2>
<div class="grid-2e">
 <div class="card flush"><p class="label">Maliyet yapısı (Ürün Maliyet Modeli, ciroya oran)</p>${filled ? `<table class="tbl num"><thead><tr><th>Kalem</th><th class="r">Oran</th><th class="r">Yıllık tutar</th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="empty">Maliyet yapısı girilmedi.</p>`}
  <ul class="fx" style="margin-top:4mm">
   <li><b>Mevcut faaliyet kârı</b><span>${money(m, ebitda)}</span></li>
   <li><b>Geri kazanım (ort.)</b><span>+ ${money(m, m.totals.recoveryAvg)}</span></li>
   <li><b>Hedef faaliyet kârı</b><span><b>${money(m, newEbitda)}</b></span></li>
  </ul></div>
 <div class="card"><p class="label">Faaliyet kârı marjı — en büyük fırsatlar sırayla</p>${profitSvg(m)}
  <p class="note">Aşamalar Geri Kazanım Matrisi'ndeki en büyük ortalama kazançların sırayla eklenmesidir; zaman planı değildir.</p></div>
</div>`, "Finansal etki");
}

function assumptionsPage(p: Pages, m: LossReportModel) {
  p.entry("assumptions");
  const assumptions = [
    "Hurda birim maliyeti (şirket kartı): malzeme + %50 × (işçilik + enerji) — hurdaya giden parçanın ortalama işlenmişliği (Gemba QLA).",
    "Rework birim maliyeti (şirket kartı): %50 × (işçilik + enerji) — yeniden işlemenin ilk işlemeye göre tükettiği emek (Gemba QLA).",
    "Yarı mamul değeri: malzeme + %50 dönüşüm maliyeti; taşıma oranı danışmanın girdiği yüzdedir.",
    "COPQ ve geri kazanım aralıkları: ölçülen kaybın ±%20'si (Gemba QLA belirsizlik bandı).",
    "Geri kazanım matrisi iyileştirme oranları konu başına projeksiyon varsayımıdır; ekranda düzenlenebilir.",
    "Duruşta operatör beklediği için duruş ve setup saati makine + işçilik saatiyle fiyatlanır; makine sayısı bilinmeyen istasyon tek makine sayılır.",
    "Yıl = 260 iş günü; istasyonların yıllık tutarı kendi haftalık çalışma günü × 52 ile hesaplanır."
  ].map(a => `<li>${esc(a)}</li>`).join("");
  const gaps = m.warnings.length ? m.warnings.map(w => `<li>${esc(w)}</li>`).join("") : `<li>Kritik veri boşluğu yok.</li>`;
  p.page(`
<h2 class="headline">Varsayımlar ve veri boşlukları: rapordaki tutarlar ölçülen veri ile aşağıdaki kabullerden oluşur; boşluklar tamamlandıkça tutarlar güncellenir.</h2>
<div class="grid-2e">
 <div class="card"><p class="label">Hesapta kullanılan kabuller</p><ul class="gaps">${assumptions}</ul></div>
 <div class="card"><p class="label">Tamamlanması gereken veriler</p><ul class="gaps">${gaps}</ul></div>
</div>`, "Varsayımlar ve veri boşlukları");
}

function backCover(): string {
  return `<section class="page back">
<svg class="cv-shape" viewBox="0 0 600 794" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
 <polygon points="120,0 600,0 600,794 470,794" fill="#ECEDEF"/>
 <polygon points="330,0 470,0 600,250 600,330" fill="#D7141A"/>
 <polygon points="230,560 380,560 500,794 350,794" fill="#D7141A"/>
</svg>
<div class="bk-body">
 <img class="logo-l" src="${LOGO}" alt="${esc(C.company.shortName)}">
 <div class="contact">
  <p class="co">${esc(C.company.legalName)}</p>
  <p>${C.company.addressLines.map(esc).join("<br>")}</p>
  <p>${C.company.phones.map(esc).join(" · ")}</p>
  <p>${esc(C.company.website)} · ${esc(C.company.email)}</p>
 </div>
</div>
</section>`;
}

function buildPages(m: LossReportModel, pageOf: Record<string, number>): Pages {
  const p = new Pages(m, pageOf);
  p.raw(coverPage(m));
  tocPage(p);
  execPage(p, m);
  methodPage(p, m);
  poolPage(p, m);
  stationPages(p, m);
  tpmPages(p, m);
  copqPages(p, m);
  recoveryPages(p, m);
  roadmapPage(p, m);
  plPage(p, m);
  assumptionsPage(p, m);
  p.raw(backCover());
  return p;
}

export function renderLossReportHtml(m: LossReportModel, opts: { autoPrint?: boolean } = {}): string {
  const first = buildPages(m, {});
  const pageOf: Record<string, number> = {};
  first.entries.forEach(e => { if (!(e.key in pageOf)) pageOf[e.key] = e.page; });
  const p = buildPages(m, pageOf);
  const print = opts.autoPrint ? `<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400));</script>` : "";
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(m.firm)} · ${esc(LOSS_REPORT.kicker)} · ${esc(m.reportNo)}</title>` +
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">` +
    `<style>${REPORT_CSS}${LOSS_CSS}</style></head><body>${p.list.join("")}${print}</body></html>`;
}
