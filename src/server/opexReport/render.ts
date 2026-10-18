import { OPEX_LEVELS, getOpexLevel } from "../../utils/opexScoring.js";
import { REPORT_CONFIG } from "./config.js";
import { REPORT_LOGO_DATA_URI } from "./logo.js";
import { REPORT_CSS } from "./styles.js";
import { ReportModel, ReportArea, ReportCriterion } from "./model.js";
import { esc, fix, sentences, title, num, fmtDate, ordinal } from "./text.js";

// HTML for the executive report — A4 landscape pages, printed to PDF by headless Chromium
// (pdf.ts) or by the browser's own print dialog. Page order is fixed; page count follows the
// data (areas, long areas split in two, best-practice/roadmap pages hidden when empty).

const C = REPORT_CONFIG;
const LOGO = REPORT_LOGO_DATA_URI;

// ---------- small SVG helpers ----------

function bandSvg(m: ReportModel, w = 560): string {
  const h = 64, y = 22, bh = 14;
  const o = [`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Seviye bandı">`];
  for (const lv of OPEX_LEVELS) {
    const x0 = (lv.min / 100) * w, x1 = (lv.max / 100) * w;
    const on = m.level.index === lv.index;
    o.push(`<rect x="${(x0 + 1).toFixed(1)}" y="${y}" width="${(x1 - x0 - 2).toFixed(1)}" height="${bh}" rx="2" fill="${lv.color}" opacity="${on ? 1 : 0.25}"/>`);
    o.push(`<text x="${((x0 + x1) / 2).toFixed(1)}" y="${y + bh + 16}" text-anchor="middle" class="t-xs">${esc(lv.name)}</text>`);
  }
  const xv = (Math.min(100, Math.max(0, m.overall)) / 100) * w, xt = (m.target / 100) * w;
  o.push(`<line x1="${xt.toFixed(1)}" x2="${xt.toFixed(1)}" y1="${y - 6}" y2="${y + bh + 4}" stroke="#1B2430" stroke-dasharray="3 2" stroke-width="1.2"/>`);
  o.push(`<text x="${(xt + 4).toFixed(1)}" y="${y - 8}" class="t-xs">Hedef ${m.target}</text>`);
  o.push(`<path d="M${(xv - 6).toFixed(1)},${y - 12} L${(xv + 6).toFixed(1)},${y - 12} L${xv.toFixed(1)},${y - 2} Z" fill="#1B2430"/>`);
  o.push(`<text x="${(xv + 8).toFixed(1)}" y="${y - 6}" class="t-xs b">${num(m.overall)}</text></svg>`);
  return o.join("");
}

// Radar scale: the next 10 above the larger of (best area, target), plus one ring of headroom.
export function radarMax(m: ReportModel): number {
  const top = Math.max(m.target, ...m.areas.map(a => a.score), 10);
  return Math.min(100, Math.ceil(top / 10) * 10 + 10);
}

function radarSvg(m: ReportModel, size = 520, r = 175): string {
  const RMAX = radarMax(m);
  const W = size + 140, cx = W / 2, cy = size / 2;
  const n = m.areas.length;
  const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i: number, v: number): [number, number] => [cx + (r * v / RMAX) * Math.cos(ang(i)), cy + (r * v / RMAX) * Math.sin(ang(i))];
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const o = [`<svg viewBox="0 0 ${W} ${size}" width="100%" role="img" aria-label="Alan skorları radar grafiği">`];
  for (const lv of [...OPEX_LEVELS].reverse()) {
    if (lv.min < RMAX) o.push(`<polygon points="${poly(Array(n).fill(Math.min(lv.max, RMAX)))}" fill="${lv.color}" fill-opacity=".10" stroke="none"/>`);
  }
  for (let v = 10; v <= RMAX; v += 10) {
    const strong = OPEX_LEVELS.some(l => l.max === v);
    o.push(`<polygon points="${poly(Array(n).fill(v))}" fill="none" stroke="#C9CED6" stroke-width="${strong ? 1.1 : 0.6}"/>`);
  }
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, RMAX);
    o.push(`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#D5D9DE" stroke-width=".7"/>`);
  }
  for (let v = 10; v <= RMAX; v += 10) {
    o.push(`<text x="${cx + 3}" y="${(cy - (r * v) / RMAX + 9).toFixed(1)}" class="t-xxs muted">${v}</text>`);
  }
  o.push(`<polygon points="${poly(Array(n).fill(Math.min(m.target, RMAX)))}" fill="none" stroke="#1B2430" stroke-width="1.4" stroke-dasharray="5 3"/>`);
  const vals = m.areas.map(a => Math.min(a.score, RMAX));
  o.push(`<polygon points="${poly(vals)}" fill="#D7141A" fill-opacity=".18" stroke="#D7141A" stroke-width="2" stroke-linejoin="round"/>`);
  vals.forEach((v, i) => {
    const [x, y] = pt(i, v);
    o.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#D7141A"/>`);
  });
  m.areas.forEach((a, i) => {
    const [x, y] = pt(i, RMAX * 1.13);
    const c = Math.cos(ang(i));
    const anchor = Math.abs(c) < 0.2 ? "middle" : c > 0 ? "start" : "end";
    o.push(`<text x="${x.toFixed(1)}" y="${(y - 2).toFixed(1)}" text-anchor="${anchor}" class="t-s">${esc(a.short)}</text>`);
    o.push(`<text x="${x.toFixed(1)}" y="${(y + 10).toFixed(1)}" text-anchor="${anchor}" class="t-s b red">${num(a.score)}</text>`);
  });
  o.push("</svg>");
  return o.join("");
}

const miniBar = (m: ReportModel, v: number, w = 90) =>
  `<svg viewBox="0 0 ${w} 8" width="${w}" height="8"><rect width="${w}" height="8" rx="1.5" fill="#E3E6EA"/>` +
  `<rect width="${((Math.min(100, v) / 100) * w).toFixed(1)}" height="8" rx="1.5" fill="${getOpexLevel(v).color}"/>` +
  `<line x1="${((m.target / 100) * w).toFixed(1)}" x2="${((m.target / 100) * w).toFixed(1)}" y1="-1" y2="9" stroke="#1B2430" stroke-width="1"/></svg>`;

const dots = (score: number) => Array.from({ length: 5 }, (_, i) => `<i class="dot${i < score ? " on" : ""}"></i>`).join("");

// ---------- layout ----------

// Layout knobs. Defaults come from text-length estimates; the PDF renderer measures the real
// pages in Chromium and tightens these for any page that still overflows (see pdf.ts).
export interface LayoutOptions {
  areaBudget?: Record<string, number>; // per-area scale on the detail-table height budget (1 = default)
  summaryBudget?: number; // scale on the executive-summary table's per-page height budget (1 = default)
  bpPerPage?: number; // best-practice cards per page (4 = 2×2 grid)
  strongCount?: number; // "güçlü noktalar" items on the executive-summary page
  sectionsBudget?: number; // scale on the section-evaluation pages' height budget (1 = default)
  gapsCompact?: boolean; // tighter rows on the critical-gaps page
}

// Rough row-height model for the area-detail table (mm), from column widths and font sizes in
// styles.ts. Deliberately conservative; the measured feedback loop corrects what it misses.
const lines = (text: string, perLine: number) => Math.max(1, Math.ceil((text || "").length / perLine));
export function detailRowMm(c: ReportCriterion, dense: boolean): number {
  const lh = dense ? 3.2 : 3.45;
  const topic = lines(title(c.topic), dense ? 30 : 28) * lh + 3.0;
  const finding = lines(fix(c.finding) || "Çalışma görülmedi", dense ? 66 : 60) * lh;
  const ideal = lines(sentences(c.ideal), dense ? 80 : 74) * (dense ? 2.85 : 3.05);
  return Math.max(topic, finding, ideal, 5) + (dense ? 2.4 : 3.4);
}
export const DETAIL_BODY_MM = 131; // comment + table body height on an area-detail page (measured ≈ 130 mm)

function splitArea(a: ReportArea, dense: boolean, scale: number): ReportCriterion[][] {
  const budget = DETAIL_BODY_MM * scale;
  const chunks: ReportCriterion[][] = [[]];
  let used = 0;
  for (const c of a.criteria) {
    const h = detailRowMm(c, dense);
    if (chunks[chunks.length - 1].length > 0 && used + h > budget) {
      chunks.push([]);
      used = 0;
    }
    chunks[chunks.length - 1].push(c);
    used += h;
  }
  // Balance a two-page split so the second page isn't a lone row.
  if (chunks.length === 2 && chunks[1].length < Math.floor(a.criteria.length / 3)) {
    const half = Math.ceil(a.criteria.length / 2);
    return [a.criteria.slice(0, half), a.criteria.slice(half)];
  }
  return chunks;
}

function defaultBpPerPage(m: ReportModel): number {
  const len = (bp: ReportModel["bestPractices"][number]) =>
    (bp.criterion.finding || "").length + bp.why.length + bp.how.length + (bp.criterion.ideal || "").length;
  const longest = Math.max(0, ...m.bestPractices.map(len));
  return longest > 650 ? 2 : C.bestPracticesPerPage;
}

// ---------- page frame ----------

class Pages {
  list: string[] = [];
  entries: { key: string; page: number }[] = [];
  private no = 1;
  // pageOf: page numbers from a first rendering pass (for the table of contents / area index).
  constructor(private m: ReportModel, public pageOf: Record<string, number> = {}) {}
  raw(html: string) { this.list.push(html); }
  // Records that the next page starts section `key`.
  entry(key: string) { this.entries.push({ key, page: this.no + 1 }); }
  page(body: string, section: string, kind = "", key = "") {
    this.no += 1;
    this.list.push(`<section class="page" data-kind="${esc(kind)}" data-key="${esc(key)}">
<header class="ph"><img class="logo-s" src="${LOGO}" alt="${esc(C.company.shortName)}"><span class="sec">${esc(section)}</span></header>
${body}
<footer class="pf"><span>${esc(this.m.firm)} · ${esc(C.report.kicker)} · No ${esc(this.m.reportNo)}</span><span>${esc(C.report.footerConfidential)}</span><span>${this.no}</span></footer>
</section>`);
  }
}

// ---------- rule-based texts ----------

function levelCounts(m: ReportModel) {
  const counts = OPEX_LEVELS.map(() => 0);
  m.areas.forEach(a => counts[a.level.index]++);
  return counts;
}

function execHeadline(m: ReportModel): string {
  if (m.executiveSummary) return esc(m.executiveSummary);
  const n = m.scored.length, z = m.scoreCounts[0];
  const ranked = [...m.areas].sort((a, b) => a.score - b.score);
  const worst = ranked.slice(0, 3).map(a => esc(title(a.name))).join(", ");
  switch (m.level.index) {
    case 0:
      return z > 0
        ? `Fabrika yalın dönüşümün başlangıç noktasında: ${n} kriterin <em>${z} tanesinde hiç çalışma yok</em>. ${m.target} hedefi için önce saha temeli ve bir iyileştirme sistemi kurulmalı.`
        : `Fabrika yalın dönüşümün başlangıç noktasında: genel skor <em>${num(m.overall)}</em>. ${m.target} hedefi için önce saha temeli ve bir iyileştirme sistemi kurulmalı.`;
    case 1:
      return `Temel altyapı kurulmuş, genel skor <em>${num(m.overall)}</em>. ${m.target} hedefi için en zayıf alanlarda (${worst}) sistematik çalışma gerekiyor.`;
    case 2:
      return `Dönüşüm görünür düzeyde, genel skor <em>${num(m.overall)}</em>. Kazanımları standartlaştırmak ve ${worst} alanlarını güçlendirmek bir sonraki adım.`;
    default:
      return `Olgun bir yalın sistem: genel skor <em>${num(m.overall)}</em>. Odak, sürdürülebilirlik ve kalan boşlukların (${worst}) kapatılması.`;
  }
}

// "… basamak olan temel seviyeye çıkmak" — Turkish dative per level.
const LEVEL_DATIVE = ["israf yoğun seviyeye", "temel seviyeye", "gelişime açık seviyeye", "sürdürülebilir seviyeye", "mükemmellik seviyesine"];

// ---------- pages ----------

function coverPage(m: ReportModel): string {
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
  <p class="kicker">${esc(C.report.kicker)}</p>
  <h1>${C.report.titleLines.map(esc).join("<br>")}</h1>
  <p class="cv-sub">${esc(C.report.subtitle)}</p>
  <div class="cv-client"><span>Hazırlanan kurum</span><b>${esc(m.firm)}</b></div>
 </div>
 <table class="doc">
  <tr><th>Rapor no</th><td>${esc(m.reportNo)}</td><th>Versiyon</th><td>${esc(C.report.version)}</td></tr>
  <tr><th>Saha denetimi</th><td>${fmtDate(m.auditDate)}</td><th>Rapor tarihi</th><td>${fmtDate(m.reportDate)}</td></tr>
  <tr><th>Değerlendiriciler</th><td colspan="3">${esc(m.assessors || "—")} — ${esc(C.company.shortName)}</td></tr>
  <tr><th>Firma katılımcıları</th><td colspan="3">${esc(m.participants || "—")}</td></tr>
  <tr><th>Gizlilik</th><td colspan="3">${conf}</td></tr>
 </table>
</div>
<footer class="cv-foot"><span>${esc(C.company.legalName)}</span><span>${esc(C.company.website)}</span></footer>
</section>`;
}

function execSummaryPage(p: Pages, m: ReportModel, o: LayoutOptions) {
  p.entry("exec");
  const n = m.scored.length;
  const n01 = m.scoreCounts[0] + m.scoreCounts[1];
  const counts = levelCounts(m);
  const ranked = [...m.areas].sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const dom = counts.indexOf(Math.max(...counts));
  const zeroArea = [...m.areas].sort((a, b) => b.zeroCount / Math.max(1, b.scoredCount) - a.zeroCount / Math.max(1, a.scoredCount))[0];

  const facts: string[] = [];
  facts.push(`<li><b>${n01} / ${n}</b> kriter (%${n ? Math.round((n01 / n) * 100) : 0}) 0–1 puanda: çalışma yok ya da henüz başlamamış</li>`);
  facts.push(`<li><b>${counts[dom]} / ${m.areas.length}</b> alan “${esc(OPEX_LEVELS[dom].name)}” seviyesinde; en yüksek alan <b>${esc(title(best.name))}</b> (${num(best.score)})</li>`);
  if (zeroArea && zeroArea.zeroCount > 0) {
    facts.push(`<li><b>${esc(title(zeroArea.name))}</b> alanında ${zeroArea.scoredCount} kriterin ${zeroArea.zeroCount === zeroArea.scoredCount ? "hiçbirinde" : `${zeroArea.zeroCount} tanesinde`} sistematik çalışma yok${zeroArea.zeroCount === zeroArea.scoredCount ? " (skor 0)" : ""}</li>`);
  } else {
    const n45 = m.scoreCounts[4] + m.scoreCounts[5];
    facts.push(`<li><b>${n45} / ${n}</b> kriter 4–5 puanda: başarılı ve örnek uygulamalar</li>`);
  }

  // Strong points = the best practices (5 points or flagged by the evaluator), not merely high scores.
  const strong = m.bestPractices.slice(0, o.strongCount ?? 3).map(bp => bp.criterion);
  const strongHtml = strong.length
    ? `<ul class="rank plain">${strong.map(c => `<li><b>${esc(title(c.topic))}</b><span class="muted"> · ${esc(c.id)} · ${esc(m.areas.find(a => a.id === c.categoryId)?.short || "")}</span></li>`).join("")}</ul>${m.bestPractices.length > strong.length ? `<p class="note">+${m.bestPractices.length - strong.length} best practice daha</p>` : ""}`
    : `<p class="note">Best practice olarak işaretlenen ya da 5 puan alan kriter yok.</p>`;
  const weak = [...m.areas].sort((a, b) => a.score - b.score).slice(0, 3);
  const weakHtml = weak.map(a => `<li><b>${esc(title(a.name))}</b><span>${num(a.score)}</span></li>`).join("");

  const decisions = C.managementDecisions.map(d =>
    `<li>${d
      .replace("{months}", String(C.report.horizonMonths))
      .replace("{target}", String(m.target))
      .replace("{targetClass}", m.targetClass ? `Seviye ${m.targetClass}, ` : "")
      .replace("{targetLevel}", esc(m.targetLevel.name.toLocaleLowerCase("tr-TR")))}</li>`
  ).join("");

  p.page(`
<h2 class="headline">${execHeadline(m)}</h2>
<div class="grid-exec">
 <div class="card kpi">
  <p class="label">Genel olgunluk skoru</p>
  <p class="kpi-v">${num(m.overall)}<span> / 100</span></p>
  <p class="kpi-d">Seviye: <b>${esc(m.level.name)}</b> · Hedef ${m.target} · ${m.overall < m.target ? `Hedefe uzaklık <b>${num(m.target - m.overall)} puan</b>` : `Hedefin <b>${num(m.overall - m.target)} puan</b> üzerinde`}</p>
  ${bandSvg(m)}
 </div>
 <div class="card">
  <p class="label">Tek bakışta</p>
  <ul class="facts">${facts.join("")}</ul>
 </div>
 <div class="card">
  <p class="label">Üzerine inşa edilecek güçlü noktalar (best practice)</p>${strongHtml}
  <p class="label mt">En kritik alanlar</p><ol class="rank bad">${weakHtml}</ol>
 </div>
 <div class="card ask">
  <p class="label">Yönetimden beklenen kararlar</p>
  <ol class="asks">${decisions}</ol>
 </div>
</div>`, "Yönetici özeti", "exec");
}

function processPage(p: Pages, m: ReportModel) {
  const cur = m.level.index, tgt = m.targetLevel.index;
  const steps = OPEX_LEVELS.map((lv, i) => {
    let tag = "";
    if (i === cur) tag += `<span class="st-tag now">Bugün · ${num(m.overall)}</span>`;
    if (i === tgt) tag += `<span class="st-tag goal">${C.report.horizonMonths} ay hedefi · ${m.target}</span>`;
    const cls = i === cur ? " cur" : i === tgt ? " tgt" : "";
    return `<div class="step${cls}" style="--c:${lv.color};--h:${48 + i * 11}%"><div class="st-tags">${tag}</div>` +
      `<div class="st-bar"><span class="st-no">${i + 1}</span><span class="st-rg">${lv.range}</span><b>${esc(lv.name)}</b></div><p>${esc(lv.description)}</p></div>`;
  }).join("");
  const flow: [string, string][] = [
    ["Saha denetimi", `${fmtDate(m.auditDate)} · yerinde gözlem ve görüşme`],
    ["Kriter puanlama", `${m.scored.length} kriter · 0–5 ölçek`],
    ["Ağırlıklı alan skoru", `${m.areas.length} alan · 0–100`],
    ["Genel skor ve seviye", "Alan skorlarının ortalaması"],
    ["Yol haritası", "Öncelikler ve 90 günlük plan"],
  ];
  const flowHtml = flow.map(([t, d], i) => `<div class="fl"><span>${i + 1}</span><b>${esc(t)}</b><small>${esc(d)}</small></div>`).join("");
  const goal = tgt === cur
    ? `${C.report.horizonMonths} aylık hedef, bu basamakta ${m.target} puana ulaşmak.`
    : tgt > cur
      ? `${C.report.horizonMonths} aylık hedef, ${ordinal(tgt)} basamak olan ${LEVEL_DATIVE[tgt]} çıkmak.`
      : `Hedef ${m.target} puan aşılmış durumda; odak bu seviyeyi sürdürmek.`;
  p.page(`<h2 class="headline">Değerlendirme süreci ve olgunluk seviyeleri: ${esc(m.firm)} bugün 5 aşamalı yolculuğun <em>${ordinal(cur)} basamağında</em>. ${goal}</h2>` +
    `<div class="flow">${flowHtml}</div><div class="stairs">${steps}</div>` +
    `<div class="tgt-note"><b>Hedef puanın belirlenmesi:</b> ${C.targetRule.text} Bu değerlendirmede hedef <b>${m.target}</b> olarak belirlenmiştir.</div>`,
    "Değerlendirme metodu · Olgunluk seviyeleri");
}

function radarPage(p: Pages, m: ReportModel) {
  p.entry("radar");
  const RMAX = radarMax(m);
  const ranked = [...m.areas].sort((a, b) => b.score - a.score);
  // Listed in area order (A, B, C…) so it reads alongside the radar axes.
  const rows = m.areas.map(a => `<tr><td class="id">${esc(a.id)}</td><td>${esc(title(a.name))}</td><td>${miniBar(m, a.score)}</td><td class="r b">${num(a.score)}</td><td class="r muted">${num(a.score - m.target)}</td></tr>`).join("");
  const below = m.areas.filter(a => a.score < m.target).length;
  const best = ranked[0], worst = ranked[ranked.length - 1];
  const legendLevels = OPEX_LEVELS.filter(l => l.min < RMAX)
    .map(l => `<span class="lg"><i style="background:${l.color};opacity:.3"></i>${esc(l.name)} (${l.range})</span>`).join(" ");
  const head = below === m.areas.length
    ? `${m.areas.length} alanın tamamı ${m.target} puanlık hedef çizgisinin içinde.`
    : below === 0 ? `${m.areas.length} alanın tamamı ${m.target} puanlık hedefin üzerinde.`
      : `${m.areas.length} alanın ${below} tanesi ${m.target} puanlık hedefin altında.`;
  p.page(`
<h2 class="headline">Genel skor değerlendirmesi: ${head} En güçlü alan ${esc(title(best.name))}, en zayıf alan ${esc(title(worst.name))}.</h2>
<div class="grid-radar">
 <div class="card radar-card">
  <p class="label">Alan skorları — olgunluk radarı (ölçek 0–${RMAX})</p>
  ${radarSvg(m)}
  <p class="legend"><span class="lg"><i style="background:#D7141A;opacity:.6"></i>Gerçekleşen</span> <span class="lg"><i class="ln"></i>Hedef (${m.target})</span> ${legendLevels}</p>
 </div>
 <div class="card">
  <p class="label">Alan skorları (A–${esc(m.areas[m.areas.length - 1]?.id || "")})</p>
  <table class="tbl rk"><thead><tr><th></th><th>Alan</th><th>Skor / hedef</th><th class="r">Skor</th><th class="r">Fark</th></tr></thead><tbody>${rows}</tbody></table>
 </div>
</div>`, "Genel skor değerlendirmesi");
}

function priorityOf(m: ReportModel, score: number): [string, string] {
  const gap = m.target - score;
  if (gap > C.priority.highGap) return ["Yüksek", "#C8373B"];
  if (gap > C.priority.mediumGap) return ["Orta", "#E08A3C"];
  return ["Düşük", "#4E9A6A"];
}

// Executive-summary table: one row per area with the evaluator's full section summary (entered at
// the end of each section while scoring). Rows flow onto further pages when they don't fit.
const SUMMARY_BODY_MM = 158;
function summaryRowMm(a: ReportArea): number {
  const name = lines(title(a.name), 40) * 3.4;
  return Math.max(name, 4.2) + 2.3;
}

function summaryTablePage(p: Pages, m: ReportModel, o: LayoutOptions) {
  p.entry("summary");
  const budget = SUMMARY_BODY_MM * (o.summaryBudget ?? 1);
  const chunks: ReportArea[][] = [[]];
  let used = 0;
  m.areas.forEach(a => {
    const h = summaryRowMm(a);
    if (chunks[chunks.length - 1].length > 0 && used + h > budget) { chunks.push([]); used = 0; }
    chunks[chunks.length - 1].push(a);
    used += h;
  });
  const rowOf = (a: ReportArea) => {
    const i = m.areas.indexOf(a);
    const [pn, pc] = priorityOf(m, a.score);
    return `<tr><td class="id">${i + 1}</td><td><b>${esc(title(a.name))}</b></td>` +
      `<td class="r b">${num(a.score)}</td><td>${miniBar(m, a.score, 60)}</td>` +
      `<td><span class="chip" style="--c:${a.level.color}">${esc(a.level.name)}</span></td><td class="r muted">${num(a.score - m.target)}</td>` +
      `<td class="c">${a.zeroCount}/${a.scoredCount}</td>` +
      `<td><span class="prio" style="--c:${pc}">${pn}</span></td></tr>`;
  };
  const tot = `<tr class="tot"><td></td><td><b>Genel skor</b></td><td class="r b">${num(m.overall)}</td><td>${miniBar(m, m.overall, 60)}</td>` +
    `<td><span class="chip" style="--c:${m.level.color}">${esc(m.level.name)}</span></td><td class="r">${num(m.overall - m.target)}</td>` +
    `<td class="c">${m.scoreCounts[0]}/${m.scored.length}</td><td class="muted">Hedef ${m.target}${m.targetClass ? ` (Seviye ${m.targetClass})` : ""}</td></tr>`;
  chunks.forEach((chunk, i) => {
    const last = i === chunks.length - 1;
    const cont = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : "";
    p.page(`
<div class="card flush"><table class="tbl sumt"><thead><tr><th>#</th><th>Değerlendirme alanı</th><th class="r">Skor</th><th>Skor / hedef</th><th>Seviye</th><th class="r">Hedefe fark</th><th class="c">0 puanlı kriter</th><th>Öncelik</th></tr></thead>
<tbody>${chunk.map(rowOf).join("")}${last ? tot : ""}</tbody></table></div>
${last ? `<p class="note">Öncelik: hedefe fark &gt; ${C.priority.highGap} Yüksek · ${C.priority.mediumGap}–${C.priority.highGap} Orta · ≤ ${C.priority.mediumGap} Düşük. “0 puanlı kriter”: alandaki puanlanan kriterlerden kaçının 0 puan (“çalışma görülmedi”) aldığı. Bölüm değerlendirmelerinin tam metni “Yönetici özeti” bölümündedir.</p>` : ""}`,
      `Yönetici özet değerlendirme tablosu${cont}`, "summary");
  });
}

function bestPracticePages(p: Pages, m: ReportModel, o: LayoutOptions) {
  if (m.bestPractices.length === 0) return; // section hidden when nothing qualifies
  const per = o.bpPerPage ?? defaultBpPerPage(m);
  p.entry("bp");
  for (let i = 0; i < m.bestPractices.length; i += per) {
    const chunk = m.bestPractices.slice(i, i + per);
    const cards = chunk.map(bp => {
      const c = bp.criterion;
      return `<div class="bp">
 <div class="bp-h"><span class="bp-star">★</span><div><p class="kicker">${esc(c.id)} · ${esc(title(bp.areaName))}</p><h3>${esc(title(c.topic))}</h3></div><div class="bp-score">${dots(c.score as number)}<small>${c.score} / 5</small></div></div>
 ${c.finding ? `<div class="bp-row"><p class="label">Saha tespiti</p><p>${esc(fix(c.finding))}</p></div>` : ""}
 ${bp.why ? `<div class="bp-row"><p class="label">Neden örnek uygulama</p><p>${esc(fix(bp.why))}</p></div>` : ""}
 ${bp.how ? `<div class="bp-row hl"><p class="label">Yaygınlaştırma fırsatı</p><p>${esc(fix(bp.how))}</p></div>` : ""}
 <div class="bp-row"><p class="label">İdeal durum</p><p class="muted">${esc(sentences(c.ideal))}</p></div>
</div>`;
    }).join("");
    const lowOverall = m.level.index <= 1;
    const head = i === 0
      ? `<h2 class="headline">Best practice uygulamalar: ${lowOverall ? "Düşük genel skora rağmen sahada" : "Sahada"} üzerine inşa edilebilecek ${m.bestPractices.length} örnek uygulama tespit edildi. Bunlar yol haritasında yaygınlaştırma için başlangıç noktası olarak kullanılmalı.</h2>`
      : "";
    p.page(`${head}<div class="bps">${cards}</div>`, "Best practice uygulamalar", "bp");
  }
}

function criticalGapsPage(p: Pages, m: ReportModel, o: LayoutOptions) {
  const zr = [...m.areas].filter(a => a.zeroCount > 0)
    .sort((a, b) => b.zeroCount / b.scoredCount - a.zeroCount / a.scoredCount || a.id.localeCompare(b.id));
  const zbars = zr.map(a => `<tr><td>${esc(a.short)}</td><td><div class="zb"><i style="width:${((a.zeroCount / a.scoredCount) * 100).toFixed(0)}%"></i></div></td><td class="r"><b>${a.zeroCount}</b> / ${a.scoredCount}</td></tr>`).join("");

  // Highest-weight criteria with no work at all; when there are none, the biggest point losses.
  const byLoss = (a: ReportCriterion, b: ReportCriterion) => b.lost - a.lost || a.id.localeCompare(b.id);
  let crit = m.scored.filter(c => c.score === 0 && c.effWeight >= 3).sort(byLoss);
  const zeroMode = crit.length > 0;
  if (!zeroMode) crit = m.scored.filter(c => (c.score as number) <= 2).sort(byLoss);
  crit = crit.slice(0, C.maxCriticalRows);
  if (crit.length === 0 && zr.length === 0) return; // nothing critical to show
  p.entry("gaps");

  const areaShort = (id: string) => m.areas.find(a => a.id === id)?.short || id;
  const crow = crit.map(c => `<tr><td class="id">${esc(c.id)}</td><td><b>${esc(title(c.topic))}</b></td><td class="muted">${esc(areaShort(c.categoryId))}</td>${zeroMode ? "" : `<td class="c">${c.score}</td>`}</tr>`).join("");
  // Expected gain if each listed criterion reached 2/5: per-area points ÷ number of areas.
  const gain = crit.reduce((s, c) => s + Math.max(0, 2 - (c.score as number)) * (c.lost / Math.max(0.0001, 5 - (c.score as number))), 0) / m.areas.length;
  const head = zeroMode
    ? `En büyük puan kaybı, hiç başlanmamış konulardan geliyor. En yüksek ağırlıklı ${crit.length} kriterde çalışma yok; bunların her biri 2/5 seviyesine geldiğinde genel skor yaklaşık <em>+${num(gain)} puan</em> artar.`
    : `En büyük puan kaybı düşük puanlı (0–2) kriterlerden geliyor. Listelenen ${crit.length} kriter 2/5 seviyesinin altında kaldığı ölçüde iyileştirme önceliği taşıyor.`;
  p.page(`
<h2 class="headline">${head}</h2>
<div class="grid-2${o.gapsCompact ? " compact" : ""}">
 <div class="card"><p class="label">Alan bazında 0 puanlı kriterler</p>
  <p class="note" style="margin:-1mm 0 2mm">Her alanda kaç kriterin 0 puan (“çalışma görülmedi”) aldığını gösterir. Örneğin 5 / 13: alandaki 13 kriterin 5'inde hiç çalışma yok. Çubuk bu oranı gösterir.</p>
  ${zbars ? `<table class="tbl zt"><tbody>${zbars}</tbody></table>` : `<p class="empty">Tüm alanlarda en az bir çalışma görüldü.</p>`}</div>
 <div class="card"><p class="label">${zeroMode ? "Çalışma görülmeyen en yüksek ağırlıklı kriterler (ağırlık ≥ 3)" : "En çok puan kaybettiren kriterler"}</p>
  ${crow ? `<table class="tbl cr"><thead><tr><th>ID</th><th>Kriter</th><th>Alan</th>${zeroMode ? "" : `<th class="c">Puan</th>`}</tr></thead><tbody>${crow}</tbody></table>` : `<p class="empty">Kritik kriter yok.</p>`}</div>
</div>`, "Kritik boşluklar", "gaps");
}

function roadmapPage(p: Pages, m: ReportModel) {
  if (m.roadmap.length === 0) return; // only the evaluator's own plan is printed
  p.entry("roadmap");
  const qid = new Map(m.scored.map(c => [c.id, c]));
  const gainOf = (ids: string[]) =>
    ids.reduce((s, id) => {
      const c = qid.get(id);
      if (!c || (c.score as number) >= 2) return s;
      return s + (2 - (c.score as number)) * (c.lost / (5 - (c.score as number)));
    }, 0) / m.areas.length;
  const waves = m.roadmap.map(w => `<div class="wave"><p class="when">${esc(w.when)}</p><h3>${esc(w.title)}</h3><ul>${w.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>${w.kpi ? `<p class="kpi-line"><b>Başarı ölçütü:</b> ${esc(w.kpi)}</p>` : ""}</div>`).join("");
  const withCriteria = m.roadmap.filter(w => w.criteria.length > 0);
  const total = withCriteria.reduce((s, w) => s + gainOf(w.criteria), 0);
  const imp = withCriteria.map(w => `<tr><td class="b">${esc(w.when || w.title)}</td><td>${esc(w.criteria.join(", "))}</td><td class="r b">+${num(gainOf(w.criteria))}</td><td class="muted">—</td><td class="muted">—</td><td><span class="tag">Planlandı</span></td></tr>`).join("");
  const head = withCriteria.length
    ? `90 günlük yol haritası: ${m.roadmap.map(w => esc((w.title || "").toLocaleLowerCase("tr-TR"))).filter(Boolean).join(", ")}. İlk 90 günün beklenen etkisi <em>+${num(total)} puan</em>.`
    : `90 günlük yol haritası: ${m.roadmap.map(w => esc((w.title || "").toLocaleLowerCase("tr-TR"))).filter(Boolean).join(", ")}.`;
  p.page(`
<h2 class="headline">${head}</h2>
<div class="waves">${waves}</div>
${imp ? `<table class="tbl imp"><thead><tr><th>Dalga</th><th>Kapsanan kriterler</th><th class="r">Beklenen skor etkisi*</th><th>Sponsor</th><th>Bütçe</th><th>Durum</th></tr></thead><tbody>${imp}</tbody></table>
<p class="note">* İlgili kriterlerin 2/5 seviyesine (“çalışma var, henüz etkin değil”) çıktığı varsayımıyla. Sponsor ve bütçe yönetim toplantısında belirlenecektir.</p>` : ""}`,
    "Yol haritası");
}

function findingCell(c: ReportCriterion): string {
  if (c.status === "na") return `<span class="na">Kapsam dışı</span>`;
  if (c.status === "unanswered") return `<span class="na">Değerlendirilmedi</span>`;
  const f = fix(c.finding);
  if (!f || /^çalışma görülmedi\.?$/i.test(f)) return `<span class="muted">Çalışma görülmedi</span>`;
  if (/^not available\.?$/i.test(f)) return `<span class="na">Değerlendirilmedi</span>`;
  return esc(f);
}

function areaPages(p: Pages, m: ReportModel, o: LayoutOptions) {
  m.areas.forEach((a: ReportArea, idx) => {
    p.entry(`area:${a.id}`);
    const dense = a.criteria.length > C.maxRowsPerDetailPage;
    const rowHtml = (c: ReportCriterion) => `<tr><td class="id">${esc(c.id)}</td><td><b>${esc(title(c.topic))}</b><span class="w">${c.status === "scored" ? `ağırlık ${num(c.effWeight)}` : `ağırlık ${num(c.weight)} · skora katılmadı`}</span></td>` +
      `<td class="c">${c.status === "scored" ? dots(c.score as number) : "—"}</td><td>${findingCell(c)}</td><td class="ideal">${esc(sentences(c.ideal))}</td></tr>`;
    const chunks = splitArea(a, dense, o.areaBudget?.[a.id] ?? 1).map(ch => ch.map(rowHtml));
    const gapText = a.score < m.target ? `hedefin ${num(m.target - a.score)} puan altında` : `hedefin ${num(a.score - m.target)} puan üzerinde`;
    chunks.forEach((chunk, part) => {
      const cont = chunks.length > 1 ? ` (devam ${part + 1}/${chunks.length})` : "";
      p.page(`
<div class="detail-head">
 <div><p class="kicker">Alan ${idx + 1} / ${m.areas.length}${cont}</p><h2 class="h-area">${esc(title(a.name))}</h2></div>
 <div class="pill"><span style="background:${a.level.color}">${num(a.score)}</span>${esc(a.level.name)} · ${gapText} · ${a.zeroCount} / ${a.scoredCount} kriterde çalışma yok</div>
</div>
<div class="card flush"><table class="tbl det${dense ? " dense" : ""}"><thead><tr><th>ID</th><th>Kriter</th><th class="c">Puan</th><th>Saha tespiti</th><th>İdeal durum</th></tr></thead><tbody>${chunk.join("")}</tbody></table></div>`,
        `Alan detayı · ${a.id}`, "area", a.id);
    });
  });
}

// ---------- front matter: contents, method, section evaluations, detail index ----------

const TOC: { key: string; title: string; sub?: string }[] = [
  { key: "method", title: "Değerlendirme metodu", sub: "Hedef puan · puanlama ölçeği · değerlendirme konuları · olgunluk seviyeleri" },
  { key: "exec", title: "Yönetici özeti", sub: "Genel skor, tek bakışta bulgular, yönetimden beklenen kararlar" },
  { key: "sections", title: "Bölüm değerlendirmeleri", sub: "Her bölümün genel değerlendirmesi (denetçi)" },
  { key: "radar", title: "Genel skor değerlendirmesi", sub: "Olgunluk radarı ve alan skorları" },
  { key: "summary", title: "Özet değerlendirme tablosu", sub: "Alan skoru, seviye, hedefe fark, öncelik" },
  { key: "bp", title: "Best practice uygulamalar", sub: "5 puan alan ya da best practice olarak işaretlenen kriterler" },
  { key: "gaps", title: "Kritik boşluklar" },
  { key: "roadmap", title: "90 günlük yol haritası" },
  { key: "detail", title: "Detay rapor / Tespitler", sub: "Alan bazında kriter puanları ve saha tespitleri" },
];

function tocPage(p: Pages, m: ReportModel) {
  const known = Object.keys(p.pageOf).length > 0;
  const rows = TOC.filter(t => !known || p.pageOf[t.key])
    .map((t, i) => `<li><span class="toc-no">${i + 1}</span><div><b>${esc(t.title)}</b>${t.sub ? `<small>${esc(t.sub)}</small>` : ""}</div><span class="toc-dots"></span><span class="toc-pg">${p.pageOf[t.key] ?? ""}</span></li>`)
    .join("");
  p.page(`<h2 class="headline">İçindekiler</h2><ol class="toc">${rows}</ol>`, "İçindekiler", "toc");
}

function methodTargetPage(p: Pages, m: ReportModel) {
  p.entry("method");
  const cls = m.targetClass;
  const card = (k: "A" | "B", text: string) =>
    `<div class="tg${cls === k ? " on" : ""}"><span class="tg-k">${k}</span><span class="tg-v">${C.targetRule[k]}</span><p>${esc(text)}</p>${cls === k ? `<span class="tg-sel">Bu denetimde seçilen</span>` : ""}</div>`;
  const scale = C.scale.map(s => {
    const col = ["#C8373B", "#E08A3C", "#D9B43B", "#8DB86B", "#4E9A6A", "#2F6FA8"][s.score];
    return `<div class="sc" style="--c:${col}"><span class="sc-n">${s.score}</span><span class="sc-d">${dots(s.score)}</span><p>${esc(s.text)}</p></div>`;
  }).join("");
  p.page(`
<h2 class="headline">Değerlendirme metodu: her kriter sahada 0–5 arası puanlanır; hedef puan firmanın başlangıç seviyesine göre belirlenir.</h2>
<div class="grid-2 method">
 <div class="card"><p class="label">1 · Hedef puan belirleme</p>
  <div class="tgs">
   ${card("A", "Sürekli gelişim çalışmaları başlamış, kaizen kültürü sahaya yansımış, vizyon net ve izlenebilir.")}
   ${card("B", "Sürekli gelişim henüz başlamamış; hedefler ve sonuçlar izlenebilir değil.")}
  </div>
  <p class="tg-res">Hedef puan: <b>${m.target}</b>${cls ? ` (Seviye ${cls})` : ""}</p>
 </div>
 <div class="card"><p class="label">2 · Puanlama tanımı (kriter başına)</p><div class="scs">${scale}</div>
  <p class="note">Kapsam dışı (N/A) işaretlenen kriterler skora katılmaz; ağırlıkları aynı bölümdeki puanlanan kriterlere eşit dağıtılır.</p></div>
</div>`, "Değerlendirme metodu", "method");
}

function methodTopicsPage(p: Pages, m: ReportModel) {
  const tiles = m.areas.map((a, i) => {
    const total = a.criteria.reduce((s, c) => s + c.weight, 0);
    return `<div class="tp"><span class="tp-k">${esc(a.id)}</span><div><b>${esc(title(a.name))}</b><small>${a.criteria.length} kriter · ağırlık ${num(total)}</small></div><span class="tp-i">${i + 1}</span></div>`;
  }).join("");
  const weights = m.criteria.map(c => c.weight).filter(w => w > 0);
  const wMin = weights.length ? Math.min(...weights) : 0, wMax = weights.length ? Math.max(...weights) : 0;
  p.page(`
<h2 class="headline">Değerlendirme konuları: ${m.areas.length} alan, ${m.criteria.length} kriter. Her alan 0–100 arası skorlanır; genel skor ${m.areas.length} alan skorunun toplamının ${m.areas.length}'e bölünmesiyle bulunur.</h2>
<div class="tps">${tiles}</div>
<div class="formula">
 <div><span class="label">Kriter</span><b>puan (0–5) × ağırlık (${num(wMin)}–${num(wMax)})</b></div><i>→</i>
 <div><span class="label">Alan skoru</span><b>Σ(puan × ağırlık) ÷ (5 × Σ ağırlık) × 100</b></div><i>→</i>
 <div><span class="label">Genel skor</span><b>Σ alan skorları ÷ ${m.areas.length}</b></div><i>→</i>
 <div><span class="label">Seviye</span><b>${OPEX_LEVELS.map(l => esc(l.range)).join(" · ")}</b></div>
</div>`, "Değerlendirme metodu", "method");
}

// Section evaluations — the evaluator's "Genel Bölüm Değerlendirmesi" for every area, in full.
const SECTIONS_BODY_MM = 160;
function sectionBlockMm(a: ReportArea): number {
  return Math.max(15, lines(fix(a.comment) || "x", 150) * 4.3 + 7);
}
function sectionEvaluationPages(p: Pages, m: ReportModel, o: LayoutOptions) {
  const budget = SECTIONS_BODY_MM * (o.sectionsBudget ?? 1);
  const chunks: ReportArea[][] = [[]];
  let used = 22; // headline on the first page
  m.areas.forEach(a => {
    const h = sectionBlockMm(a);
    if (chunks[chunks.length - 1].length > 0 && used + h > budget) { chunks.push([]); used = 0; }
    chunks[chunks.length - 1].push(a);
    used += h;
  });
  const missing = m.areas.filter(a => !a.comment).length;
  p.entry("sections");
  chunks.forEach((chunk, i) => {
    const blocks = chunk.map(a => `<div class="se"><div class="se-h"><span class="se-k">${esc(a.id)}</span><div><b>${esc(title(a.name))}</b><span class="chip" style="--c:${a.level.color}">${num(a.score)} · ${esc(a.level.name)}</span></div></div>` +
      `<p>${a.comment ? esc(fix(a.comment)) : `<span class="muted">Bölüm değerlendirmesi girilmedi.</span>`}</p></div>`).join("");
    const head = i === 0
      ? `<h2 class="headline sm">Bölüm değerlendirmeleri: denetçilerin her bölüm sonunda yazdığı genel değerlendirmeler${missing ? ` (${missing} bölümde değerlendirme girilmedi)` : ""}.</h2>`
      : "";
    const cont = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : "";
    p.page(`${head}<div class="ses">${blocks}</div>`, `Yönetici özeti · Bölüm değerlendirmeleri${cont}`, "sections");
  });
}

function detailIndexPage(p: Pages, m: ReportModel) {
  p.entry("detail");
  const rows = m.areas.map(a => `<li><span class="se-k">${esc(a.id)}</span><b>${esc(title(a.name))}</b><span class="chip" style="--c:${a.level.color}">${num(a.score)}</span><span class="toc-dots"></span><span class="toc-pg">${p.pageOf[`area:${a.id}`] ?? ""}</span></li>`).join("");
  p.page(`<h2 class="headline">Detay rapor / Tespitler</h2>
<p class="note">Her alan için kriter puanları, saha tespitleri ve ideal durum. Alanlar A'dan ${esc(m.areas[m.areas.length - 1]?.id || "")}'ye sıralıdır.</p>
<ol class="didx">${rows}</ol>`, "Detay rapor / Tespitler", "detail");
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

function buildPages(m: ReportModel, opts: LayoutOptions, pageOf: Record<string, number>): Pages {
  const p = new Pages(m, pageOf);
  p.raw(coverPage(m));
  tocPage(p, m);
  methodTargetPage(p, m);
  methodTopicsPage(p, m);
  processPage(p, m);
  execSummaryPage(p, m, opts);
  sectionEvaluationPages(p, m, opts);
  radarPage(p, m);
  summaryTablePage(p, m, opts);
  bestPracticePages(p, m, opts);
  criticalGapsPage(p, m, opts);
  roadmapPage(p, m);
  detailIndexPage(p, m);
  areaPages(p, m, opts);
  p.raw(backCover());
  return p;
}

export function renderReportHtml(m: ReportModel, opts: LayoutOptions & { autoPrint?: boolean } = {}): string {
  // Pass 1 finds where each section starts; pass 2 prints those page numbers in the contents and
  // the detail index (both are single pages, so numbering is identical across passes).
  const first = buildPages(m, opts, {});
  const pageOf: Record<string, number> = {};
  first.entries.forEach(e => { if (!(e.key in pageOf)) pageOf[e.key] = e.page; });
  const p = buildPages(m, opts, pageOf);
  const print = opts.autoPrint ? `<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400));</script>` : "";
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(m.firm)} · ${esc(C.report.kicker)} · ${esc(m.reportNo)}</title>` +
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">` +
    `<style>${REPORT_CSS}</style></head><body>${p.list.join("")}${print}</body></html>`;
}

export function reportPageCount(html: string): number {
  return (html.match(/<section class="page/g) || []).length;
}
