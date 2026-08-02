import { SmedProject } from "./smedTypes";

export function calculateDurationFromTimes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  let diffMin = (eh * 60 + em) - (sh * 60 + sm);
  if (diffMin < 0) diffMin += 1440; // wrap around midnight
  return diffMin;
}

export const initialSmedProjects: SmedProject[] = [
  {
    id: "proj-1",
    code: "PRJ-SMD-01",
    name: "Pres-1 Kalıp Değişimi A22→B15",
    leader: "Mustafa Yılmaz",
    team: "S. Kaya, T. Demir, K. Arslan",
    startDate: "2026-07-01",
    targetEndDate: "2026-07-30",
    factory: "İstanbul Fabrika",
    productionLine: "Pres Hattı 1",
    machineNo: "Pres-1 (200T)",
    moldNo: "M-A22",
    productCode: "A22",
    productName: "Kapı Paneli",
    currentSetupTime: 82,
    targetSetupTime: 25,
    activities: [
      { id: 1, sequence: 1, name: "Sonraki kalıp bilgilerini al", startTime: "14:00", endTime: "14:05", dur: 5, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Hazırlık", waste: "Arama", opportunity: "⭐⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 2, sequence: 2, name: "Soğutucu bağlantıları söküm", startTime: "14:05", endTime: "14:13", dur: 8, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Sökme", waste: "—", opportunity: "⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 3, sequence: 3, name: "Yeni kalıbı forklift ile getir", startTime: "14:13", endTime: "14:25", dur: 12, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.2", category: "Taşıma", waste: "Taşıma", opportunity: "⭐⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 4, sequence: 4, name: "Kalıp yüzey temizliği", startTime: "14:25", endTime: "14:32", dur: 7, type: "external", originalType: "external", operatorCount: 1, operator: "Op.3", category: "Temizlik", waste: "—", opportunity: "⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 5, sequence: 5, name: "Kalıp bağlama (cıvata)", startTime: "14:32", endTime: "14:47", dur: 15, type: "internal", originalType: "internal", operatorCount: 2, operator: "Op.1 & Op.2", category: "Kurulum", waste: "Aşırı İşlem", opportunity: "⭐⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 6, sequence: 6, name: "Sıcaklık ayarı bekleme", startTime: "14:47", endTime: "14:57", dur: 10, type: "internal", originalType: "internal", operatorCount: 0, operator: "—", category: "Ayarlama", waste: "Bekleme", opportunity: "⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 7, sequence: 7, name: "Basınç parametreleri girişi", startTime: "14:57", endTime: "15:03", dur: 6, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Ayarlama", waste: "—", opportunity: "⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 8, sequence: 8, name: "Malzeme hazırlama", startTime: "15:03", endTime: "15:11", dur: 8, type: "external", originalType: "external", operatorCount: 1, operator: "Op.3", category: "Hazırlık", waste: "—", opportunity: "⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 9, sequence: 9, name: "İlk parça deneme koşumu", startTime: "15:11", endTime: "15:16", dur: 5, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Deneme", waste: "—", opportunity: "—", ecrsSteps: [], ecrsGains: {} },
      { id: 10, sequence: 10, name: "Ölçüm ve doğrulama", startTime: "15:16", endTime: "15:18", dur: 2, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Doğrulama", waste: "—", opportunity: "—", ecrsSteps: [], ecrsGains: {} },
    ],
    actions: [
      { id: 1, title: "Setup arabası tasarımı", priority: "High", assignee: "M. Yılmaz", dueDate: "30 Haz 2026", benefit: "-15 dk", column: "open" },
      { id: 2, title: "Quick clamp tedarik", priority: "High", assignee: "S. Kaya", dueDate: "15 Tem 2026", benefit: "-10 dk", column: "open" },
      { id: 3, title: "Görsel kontrol listesi", priority: "Medium", assignee: "T. Demir", dueDate: "25 Haz 2026", benefit: "-5 dk", column: "open" },
      { id: 4, title: "Operatör SMED eğitimi", priority: "Medium", assignee: "K. Arslan", dueDate: "05 Tem 2026", benefit: "Standart", column: "progress" },
      { id: 5, title: "Standart iş talimatı yazılması", priority: "Medium", assignee: "M. Yılmaz", dueDate: "12 Tem 2026", benefit: "Doküman", column: "progress" },
      { id: 6, title: "Yeni forklift yolu planlaması", priority: "Medium", assignee: "Bakım Ekibi", dueDate: "20 Tem 2026", benefit: "Lojistik", column: "hold" },
      { id: 7, title: "Otomatik ısıtma ünitesi", priority: "Low", assignee: "Mühendislik", dueDate: "15 Ağu 2026", benefit: "-10 dk", column: "hold" },
      { id: 8, title: "5S setup bölgesi markalama", priority: "High", assignee: "Yalın Ekip", dueDate: "Tamamlandı", benefit: "-8 dk", column: "done" },
      { id: 9, title: "Takım etiketleme panosu", priority: "Medium", assignee: "Gözlemci", dueDate: "Tamamlandı", benefit: "-3 dk", column: "done" },
      { id: 10, title: "Robotik otomatik kalıp değişimi", priority: "Low", assignee: "Mühendislik", dueDate: "İptal Edildi", benefit: "Yüksek Maliyet", column: "cancel" },
    ]
  },
  {
    id: "proj-2",
    code: "PRJ-SMD-02",
    name: "Pres-2 Kalıp Değişimi",
    leader: "Ahmet Yılmaz",
    team: "Mehmet Demir, Canan Kaya",
    startDate: "2026-07-05",
    targetEndDate: "2026-08-05",
    factory: "İstanbul Fabrika",
    productionLine: "Pres Hattı 2",
    machineNo: "Pres-2 (400T)",
    moldNo: "M-P12",
    productCode: "P12",
    productName: "Çamurluk Sacı",
    currentSetupTime: 95,
    targetSetupTime: 30,
    activities: [
      { id: 11, sequence: 1, name: "Yeni kalıp getirme", startTime: "09:00", endTime: "09:15", dur: 15, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.2", category: "Taşıma", waste: "Taşıma", opportunity: "⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 12, sequence: 2, name: "Eski kalıbın sökülmesi", startTime: "09:15", endTime: "09:30", dur: 15, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Sökme", waste: "Gereksiz Hareket", opportunity: "⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 13, sequence: 3, name: "Yeni kalıbın vinç ile yerleştirilmesi", startTime: "09:30", endTime: "09:50", dur: 20, type: "internal", originalType: "internal", operatorCount: 2, operator: "Op.1 & Op.2", category: "Kurulum", waste: "—", opportunity: "⭐⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 14, sequence: 4, name: "Cıvataların sıkılması", startTime: "09:50", endTime: "10:05", dur: 15, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Kurulum", waste: "Aşırı İşlem", opportunity: "⭐⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 15, sequence: 5, name: "Hortumların bağlanması", startTime: "10:05", endTime: "10:15", dur: 10, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.2", category: "Kurulum", waste: "—", opportunity: "⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 16, sequence: 6, name: "Isıtma ve parametre kontrolü", startTime: "10:15", endTime: "10:35", dur: 20, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Ayarlama", waste: "Bekleme", opportunity: "⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 17, sequence: 7, name: "Deneme basımı ve ilk parça onayı", startTime: "10:35", endTime: "10:45", dur: 10, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "İlk Parça Onayı", waste: "—", opportunity: "—", ecrsSteps: [], ecrsGains: {} },
    ],
    actions: []
  },
  {
    id: "proj-3",
    code: "PRJ-SMD-03",
    name: "Enjeksiyon Hat-3 Renk Değişimi",
    leader: "Selin Kaya",
    team: "Mühendis Hakan, Setter Ömer",
    startDate: "2026-07-10",
    targetEndDate: "2026-08-10",
    factory: "İstanbul Fabrika",
    productionLine: "Enjeksiyon Hattı",
    machineNo: "Enj-3",
    moldNo: "M-E45",
    productCode: "E45",
    productName: "Arka Tampon",
    currentSetupTime: 75,
    targetSetupTime: 20,
    activities: [
      { id: 21, sequence: 1, name: "Hammadde besleme boşaltma", startTime: "11:00", endTime: "11:10", dur: 10, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Hazırlık", waste: "Bekleme", opportunity: "⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 22, sequence: 2, name: "Silindir temizliği ve purge işlemi", startTime: "11:10", endTime: "11:30", dur: 20, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Temizlik", waste: "Hata", opportunity: "⭐⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 23, sequence: 3, name: "Yeni renk hammaddenin yüklenmesi", startTime: "11:30", endTime: "11:40", dur: 10, type: "external", originalType: "external", operatorCount: 1, operator: "Op.2", category: "Hazırlık", waste: "—", opportunity: "⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 24, sequence: 4, name: "Sıcaklık ve enjeksiyon parametre ayarı", startTime: "11:40", endTime: "11:55", dur: 15, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Ayarlama", waste: "—", opportunity: "⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 25, sequence: 5, name: "Deneme üretimi ve renk kontrolü", startTime: "11:55", endTime: "12:15", dur: 20, type: "internal", originalType: "internal", operatorCount: 2, operator: "Op.1 & Op.2", category: "Deneme", waste: "Hata", opportunity: "⭐", ecrsSteps: [], ecrsGains: {} },
    ],
    actions: []
  },
  {
    id: "proj-4",
    code: "PRJ-SMD-04",
    name: "Montaj Hattı Model Değişimi",
    leader: "Gökhan Demir",
    team: "A. Yıldız, B. Kara",
    startDate: "2026-07-12",
    targetEndDate: "2026-08-12",
    factory: "İstanbul Fabrika",
    productionLine: "Montaj Hattı 3",
    machineNo: "Montaj-3",
    moldNo: "—",
    productCode: "M90",
    productName: "Ön Panel Montajı",
    currentSetupTime: 75,
    targetSetupTime: 15,
    activities: [
      { id: 31, sequence: 1, name: "Eski model aparatlarının sökülmesi", startTime: "13:30", endTime: "13:45", dur: 15, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "Sökme", waste: "Arama", opportunity: "⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 32, sequence: 2, name: "Hattın temizlenmesi ve düzenlenmesi", startTime: "13:45", endTime: "13:55", dur: 10, type: "external", originalType: "external", operatorCount: 1, operator: "Op.2", category: "Temizlik", waste: "—", opportunity: "⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 33, sequence: 3, name: "Yeni model aparatlarının takılması", startTime: "13:55", endTime: "14:20", dur: 25, type: "internal", originalType: "internal", operatorCount: 2, operator: "Op.1 & Op.2", category: "Kurulum", waste: "Aşırı İşlem", opportunity: "⭐⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 34, sequence: 4, name: "Sensör ve pnömatik ayarları", startTime: "14:20", endTime: "14:35", dur: 15, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.2", category: "Ayarlama", waste: "—", opportunity: "⭐⭐", ecrsSteps: [], ecrsGains: {} },
      { id: 35, sequence: 5, name: "İlk parça üretimi ve fikstür kontrolü", startTime: "14:35", endTime: "14:45", dur: 10, type: "internal", originalType: "internal", operatorCount: 1, operator: "Op.1", category: "İlk Parça Onayı", waste: "—", opportunity: "—", ecrsSteps: [], ecrsGains: {} },
    ],
    actions: []
  }
];
