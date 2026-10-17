// Executive report ("Yönetici Raporu") settings — everything that is the same for every audit
// lives here, so changing a value updates all future reports. Company-specific content (names,
// dates, scores, findings, best practices, roadmap) always comes from the assessment data.
// Level names/colours/descriptions are shared with the app screens: src/utils/opexScoring.ts.

export const REPORT_CONFIG = {
  company: {
    legalName: "GEMBA PARTNER MÜHENDİSLİK VE YAZILIM A.Ş.",
    website: "www.gembapartner.com",
    email: "info@gembapartner.com",
    addressLines: ["Esentepe Mh. Milangaz Cd. Monumento Plaza No:75/70", "Kartal / İstanbul"],
    phones: ["+90 216 212 08 77", "+90 532 626 94 84"],
    shortName: "Gemba Partner",
  },
  report: {
    kicker: "Süreç Değerlendirme Raporu",
    titleLines: ["Yalın Olgunluk", "Değerlendirmesi"],
    subtitle: "Yönetici Raporu",
    version: "1.0",
    footerConfidential: "GİZLİ — Yalnızca yönetim kullanımı içindir",
    // {firma} is replaced with the customer name.
    confidentialityNote: "<b>GİZLİ</b> — Yalnızca {firma} yönetimi ile paylaşılmak üzere hazırlanmıştır.",
    horizonMonths: 12,
  },
  // Criterion scoring scale (0-5).
  scale: [
    { score: 0, text: "Çalışma yok" },
    { score: 1, text: "Çalışma henüz başlamamış" },
    { score: 2, text: "Çalışma var ama etkin kullanılmıyor" },
    { score: 3, text: "Çalışma var ama standartlaştırılmamış" },
    { score: 4, text: "Başarılı – iyileştirmeye açık" },
    { score: 5, text: "Başarılı – en iyi uygulama" },
  ],
  // Target rule (A = 70 / B = 45) — mirrors the pre-assessment quiz in OpexAssessment.tsx.
  targetRule: {
    A: 70,
    B: 45,
    text:
      "Sürekli gelişim çalışmaları başlamış, kaizen kültürü sahaya yansımış ve vizyon izlenebilir düzeydeyse hedef <b>70 (A)</b>; " +
      "sürekli gelişim henüz başlamamış, hedefler ve sonuçlar izlenebilir değilse hedef <b>45 (B)</b> alınır.",
  },
  // Summary-table priority from the gap to target (target − area score).
  priority: { highGap: 30, mediumGap: 20 },
  // Decisions asked of management on the executive-summary page. {target}, {targetClass},
  // {targetLevel} and {months} are filled in from the data.
  managementDecisions: [
    "<b>Hedefin onayı:</b> {months} ay içinde {target} puan ({targetClass}{targetLevel})",
    "<b>Yalın organizasyon:</b> Tam zamanlı bir yalın koordinatör ve her alan için bir sorumlu atanması",
    "<b>Pilot hat:</b> Tüm temel uygulamaların önce tek bir hatta kurulup sonra yaygınlaştırılması",
    "<b>Yönetim ritmi:</b> Aylık yönetim gözden geçirmesi ve bu değerlendirmenin 6. ayda tekrarı",
  ],
  // Short area names for the radar / compact tables (by category id); unknown ids fall back to
  // the category's own name.
  shortAreaNames: {
    A: "Yönetim Desteği", B: "Değer & Maliyet", C: "Eğitim & İK", D: "Güvenlik & Ergonomi", E: "5S",
    F: "Görsel Fabrika", G: "Standart İş", H: "İyileştirme", I: "SMED", J: "Tek Parça Akışı",
    K: "Üretim Prosesi", L: "Saha Liderliği", M: "Kalite", N: "Planlama & Lojistik",
    O: "Çekme Sistemi", P: "Bakım Yönetimi", R: "Otonom Bakım", S: "Henkaten",
  } as Record<string, string>,
  // Abbreviations kept as-is when upper-case bank texts are converted to sentence/title case.
  keepAbbreviations: ["&", "/", "–", "5S", "SMED", "IK", "İK", "TL", "3M", "4M", "OEE", "VSM", "TND", "PDCA", "WIP", "FMEA", "C/O", "S/W", "İSG", "ISG", "KPI", "ERP", "MRP", "TPM", "FIFO"],
  // Recurring typos in question-bank / imported texts (exact substring → fix).
  typoFixes: [
    ["SEVİYELNDİRME", "SEVİYELENDİRME"], ["ETKNİLK", "ETKİNLİK"], ["MALİTET", "MALİYET"], ["NİTELİKİK", "NİTELİK"],
    ["TÖNETİMİ", "YÖNETİMİ"], ["başlamı.", "başlamamıştır."], ["bütçe edeki", "bütçedeki"], ["akışıı", "akışı"],
    ["Prosseste", "Proseste"], ["bulunmamamktadır", "bulunmamaktadır"], ["denkleştiriilen", "denkleştirilen"],
    ["blunmuyor", "bulunmuyor"], ["biligileri", "bilgileri"], ["insiyatife", "inisiyatife"], ["Darbogaz", "Darboğaz"],
    ["Stok alanlarini", "Stok alanlarını"], ["FAALİYETLRİ", "FAALİYETLERİ"], ["SİTEMİNİ", "SİSTEMİNİ"],
  ] as [string, string][],
  // Rows per area-detail page before the area is split over two pages.
  maxRowsPerDetailPage: 10,
  // Max rows in the "critical gaps" criteria table (keeps the page from overflowing).
  maxCriticalRows: 14,
  // Best-practice cards per page (2 × 2 grid).
  bestPracticesPerPage: 4,
};

export type ReportConfig = typeof REPORT_CONFIG;
