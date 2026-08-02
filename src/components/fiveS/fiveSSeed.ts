// Starter content shown the first time a customer opens the 5S Audit module, so the workflow is
// immediately explorable instead of a blank shell — the same "seed once, then it's just real user
// data" approach already used by the PTR/SMED modules. Everything here is ordinary editable/
// deletable data through the normal CRUD screens, not a special read-only demo mode.

export const SEED_DEPARTMENTS = ["Üretim", "Kalite", "Bakım"];

export const SEED_AREAS: { department: string; name: string; responsible: string; difficultyLevel: string }[] = [
  { department: "Üretim", name: "Montaj Hattı A", responsible: "Mustafa Çelik (Usta)", difficultyLevel: "2" },
  { department: "Üretim", name: "Pres Atölyesi", responsible: "Gözde Tohumcu", difficultyLevel: "3" },
  { department: "Kalite", name: "Giriş Kalite Kontrol", responsible: "Barış Avcı", difficultyLevel: "1" },
  { department: "Bakım", name: "Bakım Atölyesi", responsible: "Ersan Sezgin", difficultyLevel: "2" }
];

export const SEED_PERSONNEL: { name: string; role: string; email: string; department: string; isAuditor: boolean; isAdmin: boolean }[] = [
  { name: "Mustafa Çelik (Usta)", role: "Hat Sorumlusu", email: "mustafa.celik@ornek.com", department: "Üretim", isAuditor: false, isAdmin: false },
  { name: "Gözde Tohumcu", role: "Üretim Mühendisi", email: "gozde.tohumcu@ornek.com", department: "Üretim", isAuditor: true, isAdmin: false },
  { name: "Barış Avcı", role: "Kalite Mühendisi", email: "baris.avci@ornek.com", department: "Kalite", isAuditor: true, isAdmin: false },
  { name: "Ersan Sezgin", role: "Bakım Şefi", email: "ersan.sezgin@ornek.com", department: "Bakım", isAuditor: true, isAdmin: false },
  { name: "Elif Aydın", role: "OPEX Danışmanı", email: "elif.aydin@gembapartner.com", department: "Danışmanlık", isAuditor: true, isAdmin: true }
];

export const SEED_PROBLEM_CATEGORIES = ["Güvenlik", "5S", "Bakım", "Malzeme Akışı", "Görsel Yönetim"];

// A full 5-level question set per seeded area (matched by department + difficulty tier) so every
// demo area is immediately scoreable — Kurulum > Soru Listesi is where real, additional questions
// get added for any new area/tier combination later.
export const SEED_QUESTIONS: { questionNo: number; level: "1S" | "2S" | "3S" | "4S" | "5S"; department: string; difficultyLevel: string; text: string }[] = [
  // Üretim / Zorluk 2 — Montaj Hattı A
  { questionNo: 1, level: "1S", department: "Üretim", difficultyLevel: "2", text: "Sahada kullanılmayan malzeme, kalıp veya ekipman var mı?" },
  { questionNo: 2, level: "2S", department: "Üretim", difficultyLevel: "2", text: "Her ekipmanın/aletin belirlenmiş sabit bir yeri ve gölge panosu var mı?" },
  { questionNo: 3, level: "3S", department: "Üretim", difficultyLevel: "2", text: "Zemin, tezgah ve ekipman yüzeyleri temiz ve yağ/kir lekesinden arındırılmış mı?" },
  { questionNo: 4, level: "4S", department: "Üretim", difficultyLevel: "2", text: "Temizlik ve düzen için görsel standartlar (checklist, işaretleme) tanımlı mı?" },
  { questionNo: 5, level: "5S", department: "Üretim", difficultyLevel: "2", text: "Periyodik 5S denetimleri düzenli yapılıyor ve sonuçlar takip ediliyor mu?" },
  // Bakım / Zorluk 2 — Bakım Atölyesi
  { questionNo: 6, level: "1S", department: "Bakım", difficultyLevel: "2", text: "Bakım atölyesinde arızalı/hurda parça birikimi var mı?" },
  { questionNo: 7, level: "2S", department: "Bakım", difficultyLevel: "2", text: "El aletleri ve yedek parçalar etiketli raflarda düzenli mi?" },
  { questionNo: 8, level: "3S", department: "Bakım", difficultyLevel: "2", text: "Yağ/gres sızıntıları için düzenli temizlik ve önleme yapılıyor mu?" },
  { questionNo: 9, level: "4S", department: "Bakım", difficultyLevel: "2", text: "Bakım periyotları ve kontrol listeleri görsel panoda standartlaştırılmış mı?" },
  { questionNo: 10, level: "5S", department: "Bakım", difficultyLevel: "2", text: "Ekip, 5S kurallarına uyumu kendiliğinden sürdürüyor mu (denetimsiz disiplin)?" },
  // Üretim / Zorluk 3 — Pres Atölyesi (yüksek riskli alan, daha sıkı sorular)
  { questionNo: 11, level: "1S", department: "Üretim", difficultyLevel: "3", text: "Kullanılmayan kalıplar/aparatlar sahadan kaldırılmış mı?" },
  { questionNo: 12, level: "2S", department: "Üretim", difficultyLevel: "3", text: "Pres kalıp değişim setleri sıralı ve etiketli şekilde konumlandırılmış mı?" },
  { questionNo: 13, level: "3S", department: "Üretim", difficultyLevel: "3", text: "Pres altı yağ toplama sistemleri temiz ve sızıntısız mı?" },
  { questionNo: 14, level: "4S", department: "Üretim", difficultyLevel: "3", text: "Pres güvenlik bariyerleri ve acil durdurma etiketleri standart ve görünür mü?" },
  { questionNo: 15, level: "5S", department: "Üretim", difficultyLevel: "3", text: "Vardiya devir teslimlerinde 5S kontrol listesi imzalanarak uygulanıyor mu?" },
  // Kalite / Zorluk 1 — Giriş Kalite Kontrol
  { questionNo: 16, level: "1S", department: "Kalite", difficultyLevel: "1", text: "Numune/red edilen parçalar için ayrı ve etiketli alan var mı?" },
  { questionNo: 17, level: "2S", department: "Kalite", difficultyLevel: "1", text: "Ölçüm aletleri kalibrasyon etiketleriyle sabit yerlerinde mi?" },
  { questionNo: 18, level: "3S", department: "Kalite", difficultyLevel: "1", text: "Kontrol masası ve ölçüm cihazları temiz ve düzenli mi?" },
  { questionNo: 19, level: "4S", department: "Kalite", difficultyLevel: "1", text: "Kabul/red kriterleri görsel standart olarak asılı mı?" },
  { questionNo: 20, level: "5S", department: "Kalite", difficultyLevel: "1", text: "Giriş kalite kontrol ekibi periyodik iç denetimlere düzenli katılıyor mu?" }
];
