// A4 landscape print stylesheet for the executive report (ported from the reference report.css).
export const REPORT_CSS = `
@page{size:A4 landscape;margin:0}
:root{--ink:#1B2430;--muted:#66717E;--line:#E3E6EA;--bg:#FFFFFF;--soft:#F5F6F8;--red:#D7141A}
*{box-sizing:border-box}
body{margin:0;background:#D9DCE0;font-family:"Inter","Helvetica Neue",Arial,sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:297mm;height:210mm;margin:8mm auto;background:var(--bg);padding:12mm 14mm 10mm;position:relative;display:flex;flex-direction:column;gap:5mm;overflow:hidden;page-break-after:always}
@media print{body{background:#fff}.page{margin:0}}
.ph{display:flex;justify-content:space-between;align-items:center;font-size:8.5pt;color:var(--muted);border-bottom:1px solid var(--line);padding-bottom:3mm}
.brand{letter-spacing:.14em;font-size:9pt;color:var(--ink)} .brand b{color:var(--red);font-weight:700}
.sec{text-transform:uppercase;letter-spacing:.12em;font-size:8pt}
.pf{margin-top:auto;display:flex;justify-content:space-between;font-size:7.5pt;color:var(--muted);border-top:1px solid var(--line);padding-top:2.5mm}
.headline{font-size:17pt;line-height:1.3;font-weight:600;margin:0;max-width:245mm;letter-spacing:-.01em}
.headline em{font-style:normal;color:var(--red)}
.card{background:var(--soft);border-radius:3mm;padding:5mm}
.card.flush{padding:0;background:none}
.label{font-size:7.5pt;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:0 0 2.5mm;font-weight:600}
.label.mt{margin-top:4mm}
.grid-exec{display:grid;grid-template-columns:1.25fr 1fr;grid-template-rows:auto 1fr;gap:4mm;flex:1;min-height:0}
.grid-2{display:grid;grid-template-columns:1.2fr 1fr;gap:5mm;flex:1}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm}
.kpi-v{font-size:46pt;font-weight:700;margin:0;line-height:1;letter-spacing:-.02em} .kpi-v span{font-size:14pt;color:var(--muted);font-weight:500}
.kpi-d{font-size:10pt;margin:2mm 0 3mm}
.facts{margin:0;padding:0;list-style:none;font-size:10pt;line-height:1.4} .facts li{padding:2.2mm 0;border-bottom:1px solid var(--line)} .facts li:last-child{border:0}
.facts b{font-size:12pt}
.rank{margin:0;padding:0;list-style:none;font-size:10pt} .rank li{display:flex;justify-content:space-between;padding:1.4mm 0;border-bottom:1px solid var(--line)}
.rank b{font-weight:500} .rank span{font-weight:700} .rank.good span{color:#2F6FA8} .rank.bad span{color:#C8373B}
.ask{background:var(--ink);color:#fff} .ask .label{color:#AFB7C2}
.asks{margin:0;padding-left:5mm;font-size:10pt;line-height:1.45} .asks li{margin-bottom:2mm}
svg text{font-family:inherit;fill:var(--ink)} .t-xs{font-size:9px} .t-xxs{font-size:8px} .t-s{font-size:10px} .b{font-weight:700} .muted{color:var(--muted);fill:var(--muted)}
.legend{font-size:8pt;color:var(--muted);display:flex;gap:4mm;align-items:center;margin:2mm 0 0}
.legend i{display:inline-block;width:3mm;height:3mm;border-radius:1px;margin-right:-2.5mm} .legend i.ln{width:5mm;height:0;border-top:1.5px dashed var(--ink)}
.tbl{width:100%;border-collapse:collapse;font-size:8.6pt} .tbl th{text-align:left;font-size:7.3pt;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600;padding:1.6mm 2mm;border-bottom:1.5px solid var(--ink)}
.tbl td{padding:1.35mm 2mm;border-bottom:1px solid var(--line);vertical-align:top} .r{text-align:right} .c{text-align:center}
.sw{display:inline-block;width:2.6mm;height:2.6mm;margin:0 .5mm 0 2mm;vertical-align:-1px}
.tbl.gap td{padding:1.9mm 2mm} .id{font-weight:700;color:var(--muted);white-space:nowrap}
.tbl.det td{font-size:8pt;padding:1.6mm 2mm} .tbl.det td:nth-child(4){width:34%} .tbl.det td:nth-child(5){width:34%;font-size:7.4pt}
.w{display:block;font-size:7pt;color:var(--muted)}
.dot{display:inline-block;width:2.4mm;height:2.4mm;border-radius:50%;border:1px solid #9AA3AE;margin:0 .3mm} .dot.on{background:var(--ink);border-color:var(--ink)}
.note{font-size:7.8pt;color:var(--muted);margin:0}
.waves{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
.wave{border-top:3px solid var(--red);background:var(--soft);padding:5mm;border-radius:0 0 3mm 3mm;display:flex;flex-direction:column}
.wave .when{font-size:8pt;letter-spacing:.1em;text-transform:uppercase;color:var(--red);font-weight:700;margin:0}
.wave h3{font-size:13pt;margin:1.5mm 0 3mm} .wave ul{margin:0;padding-left:4.5mm;font-size:9.6pt;line-height:1.5} .wave li{margin-bottom:1.6mm}
.tag{display:inline-block;font-size:7.4pt;background:#fff;border:1px solid var(--line);border-radius:10mm;padding:.5mm 2.5mm;white-space:nowrap}
.kpi-line{margin-top:auto;font-size:8.8pt;border-top:1px solid var(--line);padding-top:3mm}
.detail-head{display:flex;justify-content:space-between;align-items:flex-end}
.kicker{font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:var(--red);font-weight:700;margin:0 0 1.5mm} .kicker.light{color:#AFB7C2}
.h-area{font-size:20pt;margin:0}
.pill{display:flex;align-items:center;gap:3mm;font-size:9.5pt;background:var(--soft);border-radius:20mm;padding:2mm 5mm 2mm 2mm}
.pill span{background:#D9B43B;color:var(--ink);font-weight:700;font-size:13pt;border-radius:20mm;padding:1mm 3.5mm}
.summary{font-size:10pt;margin:0;line-height:1.45;max-width:240mm}
.lv{display:flex;align-items:center;gap:3mm;font-size:10pt;padding:2mm 0;border-bottom:1px solid var(--line)} .lv i{width:4mm;height:4mm;border-radius:1px} .lv b{width:16mm}
.scope{columns:3;margin:0;padding:0;list-style:none;font-size:9.4pt} .scope li{padding:1.3mm 0;border-bottom:1px solid var(--line);break-inside:avoid} .scope b{display:inline-block;width:5mm;color:var(--red)}
.body{font-size:9.6pt;line-height:1.5;margin:0 0 3mm}

.logo-s{height:9mm}
.red{fill:#D7141A}
.rank.plain li{display:block}
.grid-radar{display:grid;grid-template-columns:1.15fr 1fr;gap:5mm;flex:1;min-height:0}
.radar-card{display:flex;flex-direction:column;align-items:center} .radar-card svg{max-height:118mm}
.radar-card .label,.radar-card .legend{align-self:stretch}
.lv-inline{margin-left:auto;display:flex;gap:2.5mm;align-items:center} .lv-inline i{display:inline-block;width:2.6mm;height:2.6mm;margin-right:-1.5mm}
.tbl.rk td{padding:1.15mm 2mm;font-size:8.4pt;vertical-align:middle}
.zt td{vertical-align:middle;padding:1.5mm 2mm} .zb{background:#E3E6EA;height:3mm;border-radius:1px;width:70mm} .zb i{display:block;height:100%;background:#C8373B;border-radius:1px}
.tbl.cr td{padding:1.25mm 2mm;font-size:8.6pt}
.tbl.det td.ideal{color:var(--muted);font-size:7.2pt}
.tbl.det.dense td{padding:1.1mm 2mm;font-size:7.6pt} .tbl.det.dense td.ideal{font-size:6.8pt;line-height:1.3}
.summary{background:var(--soft);border-left:3px solid var(--red);padding:3mm 4mm;font-size:9pt;max-width:none}
/* kurumsal kapak */
.cover,.back{padding:0;gap:0}
.cv-shape{position:absolute;right:0;top:0;height:100%;width:56%}
.cv-body{position:relative;z-index:1;flex:1;padding:16mm 18mm 8mm;display:flex;flex-direction:column;justify-content:space-between;width:56%}
.logo-l{width:72mm}
.cv-title h1{font-size:38pt;line-height:1.05;margin:0 0 3mm;letter-spacing:-.02em}
.cv-sub{font-size:13pt;color:var(--muted);margin:0 0 8mm}
.cv-client{border-left:4px solid var(--red);padding:1mm 0 1mm 5mm} .cv-client span{display:block;font-size:7.5pt;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)} .cv-client b{font-size:22pt;letter-spacing:.02em}
.doc{border-collapse:collapse;font-size:8.6pt;width:100%;background:#fff}
.doc th,.doc td{border:1px solid #C9CED6;padding:1.7mm 2.5mm;text-align:left} .doc th{background:var(--soft);font-weight:600;color:var(--muted);font-size:7.4pt;text-transform:uppercase;letter-spacing:.06em;width:30mm}
.cv-foot{position:relative;z-index:1;display:flex;justify-content:space-between;background:var(--ink);color:#fff;font-size:7.5pt;letter-spacing:.12em;padding:3mm 18mm}
.bk-body{position:relative;z-index:1;padding:20mm 18mm;display:flex;flex-direction:column;gap:22mm}
.contact p{margin:0 0 3mm;font-size:11pt;line-height:1.45} .contact .co{font-weight:700;font-size:12pt;margin-bottom:5mm}

.flow{display:grid;grid-template-columns:repeat(5,1fr)}
.fl{background:var(--soft);padding:3mm 6mm 3mm 9mm;clip-path:polygon(0 0,calc(100% - 5mm) 0,100% 50%,calc(100% - 5mm) 100%,0 100%,5mm 50%);margin-right:-3mm}
.fl:first-child{clip-path:polygon(0 0,calc(100% - 5mm) 0,100% 50%,calc(100% - 5mm) 100%,0 100%);padding-left:5mm}
.fl span{display:inline-flex;width:5mm;height:5mm;border-radius:50%;background:var(--ink);color:#fff;font-size:7pt;align-items:center;justify-content:center;margin-right:2mm;font-weight:700}
.fl b{font-size:9pt} .fl small{display:block;font-size:7.6pt;color:var(--muted);margin-top:1mm}
.stairs{flex:1;display:grid;grid-template-columns:repeat(5,1fr);gap:3mm;align-items:end;min-height:0}
.step{height:var(--h);display:flex;flex-direction:column;justify-content:flex-end}
.st-tags{display:flex;flex-direction:column;gap:1.5mm;margin-bottom:2mm;align-items:flex-start}
.st-tag{font-size:8pt;font-weight:700;border-radius:10mm;padding:1mm 3mm}
.st-tag.now{background:var(--ink);color:#fff} .st-tag.goal{border:1.5px dashed var(--ink);color:var(--ink)}
.st-bar{background:var(--c);color:#fff;padding:3mm 4mm;border-radius:2mm 2mm 0 0;display:flex;flex-direction:column;gap:.5mm;flex:1;opacity:.4}
.step.cur .st-bar,.step.tgt .st-bar{opacity:1}
.st-no{font-size:22pt;font-weight:700;line-height:1} .st-rg{font-size:9pt;font-weight:600} .st-bar b{font-size:12pt}
.step p{margin:0;background:var(--soft);padding:2.5mm 3mm;font-size:8.2pt;line-height:1.4;min-height:17mm}
.step.cur p,.step.tgt p{background:#fff;box-shadow:inset 0 0 0 1px var(--ink)}
.step.tgt p{box-shadow:inset 0 0 0 1.5px var(--ink)} 
.tgt-note{font-size:8.6pt;background:var(--soft);border-left:3px solid var(--ink);padding:2.5mm 4mm;line-height:1.45}
.step{position:relative} .st-tags{position:absolute;bottom:100%;left:0;margin-bottom:2mm}

.headline.sm{font-size:15pt}
.tbl.sumt td{padding:1.25mm 1.8mm;font-size:8pt;vertical-align:middle} .tbl.sumt th{padding:1.4mm 1.8mm}
.tbl.sumt td.fnd{font-size:7.5pt;color:#3A4450;line-height:1.3}
.tbl.sumt tr.tot td{border-top:1.5px solid var(--ink);border-bottom:0;background:var(--soft);font-size:8.6pt}
.chip{display:inline-block;font-size:7.2pt;padding:.5mm 2.2mm;border-radius:10mm;background:color-mix(in srgb,var(--c) 18%,white);color:#1B2430;border:1px solid var(--c);white-space:nowrap}
.prio{display:inline-flex;align-items:center;gap:1.2mm;font-size:7.6pt;font-weight:600;white-space:nowrap} .prio::before{content:"";width:2.4mm;height:2.4mm;border-radius:50%;background:var(--c)}
.bps{display:grid;grid-template-columns:1fr 1fr;gap:6mm;flex:1}
.bp{background:var(--soft);border-radius:3mm;padding:5mm 6mm;display:flex;flex-direction:column;gap:3mm;border-top:3px solid #4E9A6A}
.bp-h{display:flex;gap:3mm;align-items:flex-start} .bp-h h3{margin:0;font-size:13pt} .bp-h>div:nth-child(2){flex:1}
.bp-star{font-size:16pt;color:#4E9A6A;line-height:1}
.bp-score{text-align:right} .bp-score small{display:block;font-size:7.5pt;color:var(--muted);margin-top:1mm}
.bp-row p{margin:0;font-size:9pt;line-height:1.45} .bp-row .label{margin-bottom:1mm}
.bp-row.hl{background:#fff;border-left:3px solid #4E9A6A;padding:2.5mm 3.5mm}
.bp-row p.muted{font-size:8pt}

.tbl.sumt td{padding:1.05mm 1.8mm}

/* gemba-tools additions */
.empty{font-size:9.5pt;color:var(--muted);background:var(--soft);border-radius:3mm;padding:6mm;text-align:center}
.na{color:var(--muted);font-style:italic}
.legend{flex-wrap:wrap;row-gap:1.5mm;column-gap:4mm} .legend .lg{white-space:nowrap;display:inline-flex;align-items:center;gap:1.5mm} .legend .lg i{margin-right:0}
.warn{font-size:8pt;color:#9A3412;background:#FFF7ED;border-left:3px solid #EA580C;padding:2mm 3mm;margin:0}
.ask p.free{font-size:10pt;line-height:1.5;margin:0;white-space:pre-line}
`;
