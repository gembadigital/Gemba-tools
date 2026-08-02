export interface ActivityItem {
  id: number;
  sequence: number; // Sıra No
  name: string; // Gözlenen İşlem Adımı
  startTime: string; // Başlangıç Saati e.g. "15:30"
  endTime: string; // Bitiş Saati e.g. "15:38"
  dur: number; // Süre (dk) - Otomatik hesaplanmalı
  type: "internal" | "external"; // İşlem Tipi
  originalType: "internal" | "external"; // Baseline type to calculate conversion
  operatorCount: number; // Operatör / Setter Sayısı
  operator: string; // Operatör Açıklaması
  category: string; // Faaliyet Kategorisi
  waste: string; // İsraf Türü (if any)
  opportunity: string; // İyileşme Yıldızı
  ciKaizenId?: string; // Linked CI Proje Yönetimi kaizen card id, once exported
  ciExportedAt?: string; // ISO timestamp of export to CI
  ecrsSteps?: ("E" | "C" | "R" | "S")[]; // ECRS İyileştirme Adımı (multi-select)
  ecrsGains?: { // For each checked step, how many minutes are gained
    E?: number;
    C?: number;
    R?: number;
    S?: number;
  };
  ecrsDescriptions?: { // Improvement descriptions for each step
    E?: string;
    C?: string;
    R?: string;
    S?: string;
  };
  ecrsAction?: string; // Alt faaliyet tanımlaması
  ecrsResponsible?: string; // Sorumlu
  ecrsDate?: string; // Tarih
  ecrsStatus?: "Açık" | "Kapalı" | "Devam Ediyor"; // Durum
}

export interface SmedProject {
  id: string;
  code: string; // Proje Kodu
  name: string; // Proje Adı
  leader: string; // Proje Lideri
  team: string; // Proje Ekibi
  startDate: string; // Başlangıç Tarihi
  targetEndDate: string; // Hedef Bitiş Tarihi
  
  // Operasyon Bilgileri
  factory: string; // Fabrika
  productionLine: string; // Üretim Hattı
  machineNo: string; // Makine No
  moldNo: string; // Kalıp No
  productCode: string; // Ürün Kodu
  productName: string; // Ürün Adı
  
  // Setup Bilgileri
  currentSetupTime: number; // Mevcut Setup Süresi (dk)
  targetSetupTime: number; // Hedef Setup Süresi (dk)

  // Activities list
  activities: ActivityItem[];
  actions: ActionCard[]; // İyileştirme Aksiyon Takip Kanban (proje bazlı)
  isArchived?: boolean;

  // VSM Entegrasyonu — düşük OEE / uzun setup süresi olan bir prosesten başlatılan projeler için
  linkedProcessId?: string;
  linkedProcessName?: string;
  linkedProcessOee?: number; // OEE değeri, proses bağlandığı andaki (snapshot)
  linkedProcessDowntimeCost?: number; // Yıllık duruş maliyeti (snapshot)
}

export interface ActionCard {
  id: number;
  title: string;
  priority: "High" | "Medium" | "Low";
  assignee: string;
  dueDate: string;
  benefit: string;
  column: "open" | "progress" | "hold" | "done" | "cancel";
}
