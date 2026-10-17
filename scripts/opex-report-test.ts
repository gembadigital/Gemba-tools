// Executive report regression test: builds the report for three data sets and checks scores,
// page count, overflow/footer on every page and that no FUGA-specific text leaks into others.
//
//   npx esbuild scripts/opex-report-test.ts --bundle --platform=node --format=esm \
//     --external:puppeteer-core --external:@sparticuz/chromium --outfile=/tmp/opex-report-test.mjs
//   node /tmp/opex-report-test.mjs <out-dir>
//
// Needs a local Chrome (CHROME_PATH or the default install location).

import fs from "fs";
import path from "path";
import { OPEX_SEED_CATEGORIES, OPEX_SEED_QUESTIONS } from "../src/server/opexSeedData";
import { buildReportModel, ReportInput } from "../src/server/opexReport/model";
import { renderReportHtml, reportPageCount } from "../src/server/opexReport/render";
import { renderReportPdf } from "../src/server/opexReport/pdf";
import { computeOpexScores } from "../src/utils/opexScoring";
import fugaFixture from "./fixtures/opex-report-fuga.json";

const outDir = process.argv[2] || "./opex-report-out";
fs.mkdirSync(outDir, { recursive: true });

const questions = OPEX_SEED_QUESTIONS as any[];
const categories = OPEX_SEED_CATEGORIES as any[];
let failures = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) failures++;
};

// Deterministic pseudo-random generator so synthetic data sets are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function synthetic(name: string, seed: number, pickScore: (r: () => number, catIdx: number) => number, extras: Partial<any>): ReportInput {
  const r = rng(seed);
  const answers: Record<string, number> = {};
  questions.forEach(q => {
    answers[q.id] = q.defaultNotApplicable ? -2 : pickScore(r, categories.findIndex(c => c.id === q.categoryId));
  });
  return {
    customerName: name,
    reportNo: "261001",
    reportDate: "2026-10-17",
    questions, categories,
    assessment: {
      auditNo: 1, auditDate: "2026-10-10", status: "completed",
      assessorParticipants: "Değerlendirici A, Değerlendirici B",
      customerParticipants: "Fabrika Müdürü, Üretim Müdürü, Kalite Müdürü",
      answers, customRubrics: {}, categoryComments: {}, bestPractices: {}, roadmap: [], executiveSummary: "",
      ...extras,
    },
  };
}

// ACME: every criterion answered, overall ≈ 22, three evaluator-picked best practices,
// executive summary, area comments and a roadmap filled in — a complete report.
function acme(): ReportInput {
  let best: ReportInput | null = null;
  for (let seed = 1; seed < 400; seed++) {
    const input = synthetic("ACME SANAYİ A.Ş.", seed, (r, ci) => {
      const bias = ci % 6 === 0 ? 1 : 0; // a few slightly stronger areas
      const x = r();
      return Math.min(5, (x < 0.38 ? 0 : x < 0.8 ? 1 : x < 0.95 ? 2 : 3) + bias);
    }, {});
    const { overallScore } = computeOpexScores(questions, categories, input.assessment.answers);
    if (Math.abs(overallScore - 22) < 0.6) { best = input; break; }
  }
  if (!best) throw new Error("ACME: could not hit ~22");
  const a = best.assessment;
  a.targetScores = Object.fromEntries(categories.map(c => [c.id, 45])); // low-maturity firm → hedef B
  // Three best practices on criteria the evaluator scored 3 (raise one to 4 for variety).
  const threes = questions.filter(q => a.answers[q.id] === 3).slice(0, 3);
  if (threes.length < 3) throw new Error("ACME: not enough 3-point criteria for best practices");
  // Two best practices by score (5 points) and one picked by the evaluator at 4 points.
  a.answers[threes[0].id] = 5;
  a.answers[threes[1].id] = 4;
  a.answers[threes[2].id] = 5;
  const bpTexts = [
    ["Sahada düzenli takip edilen, sorumluları belli bir uygulama; veriye dayalı karar alınıyor.", "Aynı yapı diğer hatlara ve vardiyalara taşınarak standart hale getirilebilir."],
    ["Uygulama sahiplenilmiş ve görsel olarak sahada izlenebiliyor.", "Pilot hat dışındaki alanlarda aynı görsel yönetim kurgusu kullanılabilir."],
    ["Ekip içinde yerleşmiş bir alışkanlık; aksiyonlar kapatılana kadar takip ediliyor.", "Aksiyon takip mantığı kaizen ve öneri sistemine bağlanarak yaygınlaştırılabilir."],
  ];
  threes.forEach((q, i) => { a.bestPractices[q.id] = { selected: i === 1, why: bpTexts[i][0], how: bpTexts[i][1] }; });
  categories.forEach(c => {
    a.categoryComments[c.id] = "Temel uygulamalar kısmen başlatılmış ancak sistematik değil. Sorumluluklar ve takip mekanizması netleştirilmeli; pilot alanda standart oluşturulup yaygınlaştırılmalı.";
  });
  a.executiveSummary = "ACME yalın dönüşümün başında: kriterlerin büyük kısmında çalışma yok ya da yeni başlamış. 45 hedefi için önce yönetim ritmi, pilot hatta saha temeli ve bir iyileştirme sistemi kurulmalı.";
  const ids = (cat: string, n: number) => questions.filter(q => q.categoryId === cat && (a.answers[q.id] ?? 0) < 2).slice(0, n).map(q => q.id);
  a.roadmap = [
    { when: "0–30 gün", title: "Yönetim altyapısı ve ritim", items: ["Yalın koordinatör ve alan sorumlularının atanması", "Hedeflerin sahada panolarla izlenmesi", "Öneri sisteminin başlatılması"], kpi: "Aylık yönetim gözden geçirmesinin takvime bağlanması", criteria: [...ids("A", 3), ...ids("H", 2)] },
    { when: "30–60 gün", title: "Pilot hatta saha temeli", items: ["Pilot hatta 5S ve günlük lider kontrolü", "Görsel standartlar ve yönetim panoları"], kpi: "Pilot hatta 5S denetim puanının ölçülmeye başlanması", criteria: [...ids("E", 3), ...ids("F", 2)] },
    { when: "60–90 gün", title: "Standart iş ve bakım temelleri", items: ["Standart iş ve hat dengeleme", "Planlı bakım takvimi ve arıza kaydı"], kpi: "Standart iş formlarının sahada asılı ve güncel olması", criteria: [...ids("G", 3), ...ids("P", 2)] },
  ];
  return best;
}

function highScore(): ReportInput {
  const input = synthetic("ÖRNEK YÜKSEK SKOR A.Ş.", 7, r => 3 + Math.floor(r() * 3), {});
  const a = input.assessment;
  questions.filter(q => a.answers[q.id] === 4).slice(0, 5).forEach(q => {
    a.bestPractices[q.id] = { selected: true, why: "Uzun süredir sürdürülen, ölçülen ve iyileştirilen bir uygulama.", how: "Grup fabrikalarına referans uygulama olarak aktarılabilir." };
  });
  categories.forEach(c => { a.categoryComments[c.id] = `${c.name} alanında uygulamalar oturmuş; iyileştirme döngüsü çalışıyor.`; });
  a.targetScores = Object.fromEntries(categories.map(c => [c.id, 70]));
  return input;
}

const FUGA_TEXT = ["FUGA", "Fuga", "Süleyman", "Harun", "Planlama ve Lojistik (41"];

async function run(label: string, input: ReportInput, expect: (m: ReturnType<typeof buildReportModel>) => void, allowFuga = false) {
  console.log(`\n${label}`);
  const model = buildReportModel(input);
  expect(model);
  const res = await renderReportPdf(o => renderReportHtml(model, o));
  const html = res.html;
  fs.writeFileSync(path.join(outDir, `${label}.html`), html);
  fs.writeFileSync(path.join(outDir, `${label}.pdf`), res.pdf);
  check(res.pageCount === reportPageCount(html), `PDF sayfa sayısı = HTML (${res.pageCount})`);
  check(res.layoutIssues.length === 0, `taşma/altbilgi sorunu yok${res.layoutIssues.length ? ": " + res.layoutIssues.join("; ") : ""}`);
  if (!allowFuga) check(!FUGA_TEXT.some(t => html.includes(t)), "FUGA'ya özgü metin yok");
  if (model.warnings.length) console.log(`  · uyarılar: ${model.warnings.join(" | ")}`);
  console.log(`  · genel ${model.overall} (${model.level.name}), ${res.pageCount} sayfa, best practice ${model.bestPractices.length}`);
}

(async () => {
  const fuga: ReportInput = { ...(fugaFixture as any), questions, categories };
  await run("fuga", fuga, m => {
    const area = (id: string) => m.areas.find(a => a.id === id)!;
    check(area("N").score === 41.5, `Planlama ve Lojistik 41,5 (${area("N").score})`);
    check(area("H").score === 0, `İyileştirme / Gelişim 0 (${area("H").score})`);
    check(m.areas.length === 18, "18 alan");
    check(m.bestPractices.length === 2, "2 best practice (O8.1, A10.1 karşılıkları)");
    check(m.warnings.some(w => w.includes("Denetim tarihi")), "denetim tarihi > rapor tarihi uyarısı");
  }, true);

  await run("acme", acme(), m => {
    check(Math.abs(m.overall - 22) < 0.6, `genel skor ≈ 22 (${m.overall})`);
    check(m.criteria.every(c => c.status !== "unanswered"), "tüm sorular cevaplanmış");
    check(m.bestPractices.length === 3, "3 best practice");
    check(m.roadmap.length === 3 && !!m.executiveSummary, "yönetici özeti + yol haritası dolu");
  });

  await run("yuksek-skor", highScore(), m => {
    check(m.level.index >= 2, `seviye "Gelişime açık" veya üstü (${m.level.name})`);
    check(m.bestPractices.length > 4, `best practice birden çok sayfaya bölünüyor (${m.bestPractices.length})`);
  });

  console.log(failures ? `\n${failures} kontrol başarısız` : "\nTüm kontroller geçti");
  process.exit(failures ? 1 : 0);
})();
