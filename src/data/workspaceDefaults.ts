import { CompanyWorkspaceExtended } from "../types/workspace";

export const defaultWorkspaces: Record<string, CompanyWorkspaceExtended> = {
  arcelik_bolu: {
    customerId: "arcelik_bolu",
    taxNumber: "0780012450",
    taxOffice: "Bolu Vergi Dairesi",
    website: "https://www.arcelikglobal.com",
    country: "Türkiye",
    city: "Bolu",
    shortName: "Arçelik Pişirici",
    yearEstablished: 1977,
    logoUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=80&fit=crop&q=60",
    gpsCoordinates: "40.7329, 31.5833",
    factories: [
      {
        name: "Bolu Merkez Pişirici Cihazlar Fabrikası",
        plantCode: "FAC-BL-01",
        buildingName: "A Blok - Ana Üretim",
        factoryArea: 150000,
        closedArea: 100000,
        openArea: 50000,
        productionArea: 65000,
        warehouseArea: 25000,
        officeArea: 10000,
        floorsCount: 2,
        productionLines: ["Fırın Montaj Hattı 1", "Fırın Montaj Hattı 2", "Set Üstü Ocak Hattı 3", "Pres Sac Şekillendirme Hattı"],
        departments: ["Pres Atölyesi", "Emaye Kaplama", "Boyahane", "Ana Montaj", "Kalite Güvence", "Lojistik"],
        mainProcesses: ["Sac Şekillendirme", "Gaz Altı Kaynağı", "Elektrostatik Toz Emaye", "Montaj", "Son Sızdırmazlık Testi"],
        layoutFiles: ["FAC-BL-01-Layout-v3.dwg", "FAC-BL-01-ProcessFlow.pdf"]
      }
    ],
    operational: {
      annualProductionQuantity: 2500000,
      productFamilies: ["Ankastre Fırınlar", "Solo Fırınlar", "Set Üstü Ocaklar", "Masaüstü Mini Fırınlar"],
      mainCustomers: ["Arçelik Türkiye", "Beko Europe", "Grundig", "Defy South Africa"],
      productionStrategy: "MTO",
      assemblyType: "FlowLine"
    },
    workforce: {
      totalEmployees: 840,
      blueCollar: 680,
      whiteCollar: 160,
      engineers: 45,
      officeStaff: 65,
      operators: 520,
      maintenanceStaff: 50,
      qualityStaff: 40,
      contractWorkers: 35,
      temporaryWorkers: 15,
      shiftsCount: 3,
      shiftPattern: "3x8 Kesintisiz",
      workingDays: 6,
      dailyWorkingHours: 8,
      overtimePolicy: "Haftalık 45 saati aşan çalışmalar %50 zamlı ödenir, pazar mesaisi çift ücrettir."
    },
    opex: {
      leanMaturity: 78,
      oee: 72,
      currentImprovementProgram: "VSM Odaklı Çevrim Süresi Azaltma & OEE Artışı",
      kaizenSystem: "Öneri Değerlendirme Sistemi (ÖDS) - Aylık Kaizen Ödülleri",
      tpmLevel: "Seviye 2 - Planlı Bakım ve Otonom Bakım Entegrasyonu",
      fivesLevel: 4.1,
      visualManagement: "High",
      dailyManagement: "High",
      opexScore: 78,
      currentBottlenecks: ["Emaye Fırın Konveyör Hızı", "Pres Atölyesi Kalıp Değişim Süreleri (SMED İhtiyacı)", "Montaj Hattı-2 Dengeleme Kayıpları"],
      strategicObjectives: ["OEE Seviyesini %82'ye Çıkarmak", "Kalıp Değişim Sürelerini (SMED) 15 dakikanın altına indirmek", "Lojistik Taşıma Mesafelerini %20 azaltmak"]
    },
    contacts: {
      factoryManager: "Mehmet Soyer",
      generalManager: "Hakan Bulgurlu",
      productionManager: "Levent Sarı",
      maintenanceManager: "Eren Demir",
      qualityManager: "Selin Kaya",
      leanManager: "Barış Gökdemir",
      hrManager: "Aylin Öz",
      supplyChainManager: "Murat Güven",
      itManager: "Oğuz Şahin",
      purchasingManager: "Canan Çelik",
      financeManager: "Mustafa Koç",
      primaryContactName: "Barış Gökdemir",
      primaryContactEmail: "baris.gokdemir@arcelik.com",
      primaryContactPhone: "+90 532 123 45 67",
      secondaryContactName: "Mehmet Soyer",
      secondaryContactEmail: "mehmet.soyer@arcelik.com",
      secondaryContactPhone: "+90 374 215 11 22"
    },
    assets: [
      { id: "ast_1", name: "Schuler 400T Hidrolik Pres", code: "PR-SCH-400", type: "Machine", location: "Pres Atölyesi A", status: "Active", capacity: "90 vuruş/dakika", notes: "Sac şekillendirmede ana gövde basımı." },
      { id: "ast_2", name: "Eisenmann Elektrostatik Emaye Fırını", code: "FUR-EIS-01", type: "Machine", location: "Emaye Atölyesi", status: "Active", capacity: "450 m²/saat", notes: "Fabrikanın ana darboğaz istasyonu." },
      { id: "ast_3", name: "Fırın Montaj Hattı A (Ana Montaj)", code: "L-FRN-ASSY-A", type: "ProductionLine", location: "Montaj Sahanlığı B", status: "Active", capacity: "1200 fırın/vardiya" },
      { id: "ast_4", name: "Pres Kalıp Depolama Sahası", code: "W-MOLD-01", type: "Warehouse", location: "Pres Bölümü Yanı", status: "Active", capacity: "120 Kalıp Alanı" },
      { id: "ast_5", name: "Doğalgaz Jeneratör Odası (Kojenerasyon)", code: "UT-GEN-COG", type: "Utility", location: "Dış Saha Tesisler", status: "Active", capacity: "1.2 MW Elektrik" }
    ],
    projects: [
      { id: "p_1", name: "Pres Kalıphane SMED İyileştirme Projesi", code: "PRJ-SMED-01", objective: "Pres sac kalıplarının değişim sürelerinin 38 dakikadan 12 dakikanın altına düşürülmesi.", startDate: "2026-01-15", endDate: "2026-03-30", status: "Completed", budget: 45000, currency: "₺", roiPercent: 120, projectManager: "Barış Gökdemir" },
      { id: "p_2", name: "Emaye Hattı OEE Artış ve Darboğaz Çözümü", code: "PRJ-OEE-03", objective: "Emaye kaplama fırını duruşlarının azaltılarak istasyon OEE'sinin %65'ten %80'e çıkarılması.", startDate: "2026-04-01", endDate: "2026-08-30", status: "Active", budget: 110000, currency: "₺", roiPercent: 280, projectManager: "Eren Demir" },
      { id: "p_3", name: "Hücresel Montaj Hattı Hat Dengeleme", code: "PRJ-BAL-05", objective: "Fırın montaj hattı istasyonlarındaki çevrim süresi dalgalanmalarının giderilmesi ve dengesizlik kaybının azaltılması.", startDate: "2026-09-01", endDate: "2026-11-15", status: "Planned", budget: 25000, currency: "₺", roiPercent: 95, projectManager: "Levent Sarı" }
    ],
    timeline: [
      { id: "t_1", date: "2026-01-10", title: "Şirket Gemba Çalışma Alanı Oluşturuldu", type: "creation", description: "Arçelik Bolu tesisi için enterprise çalışma alanı aktif hale getirildi.", operator: "Hakan Bulgurlu" },
      { id: "t_2", date: "2026-02-15", title: "İlk Gemba Turları ve İsraf Analizi", type: "workshop", description: "Pres atölyesi ve montaj hatlarında 3 günlük Gemba yürüyüşü gerçekleştirilerek israf kalemleri tescil edildi.", operator: "Barış Gökdemir" },
      { id: "t_3", date: "2026-05-10", title: "Bolu Pres Sahanlığı 5S Audit", type: "audit", description: "Pres atölyesinde yapılan denetimde 5S skoru 65/100 olarak ölçüldü.", operator: "Selin Kaya" },
      { id: "t_4", date: "2026-05-11", title: "Montaj Hücre Zaman Etüdü Tescili", type: "analysis", description: "Ana montaj hatlarındaki 24 istasyon için video analizli zaman etütleri tamamlandı.", operator: "Barış Gökdemir" }
    ],
    documents: [
      { id: "d_1", name: "Bolu_Pres_Layout_v2.pdf", folder: "Layouts", size: "4.2 MB", uploadDate: "2026-05-11" },
      { id: "d_2", name: "Arcelik_Opex_Roadmap.pptx", folder: "Presentations", size: "8.5 MB", uploadDate: "2026-05-12" },
      { id: "d_3", name: "Pres_Atolyesi_SMED_Plan.xlsx", folder: "SMED", size: "1.8 MB", uploadDate: "2026-03-01" },
      { id: "d_4", name: "Emaye_Firin_Isi_Haritasi.png", folder: "Photos", size: "3.1 MB", uploadDate: "2026-04-15" }
    ],
    kpiHistory: [
      { year: "2024", oee: 62, transportationDistance: 4800, fivesScore: 52, leadTimeDays: 14 },
      { year: "2025", oee: 68, transportationDistance: 4100, fivesScore: 65, leadTimeDays: 11 },
      { year: "2026", oee: 74, transportationDistance: 3400, fivesScore: 78, leadTimeDays: 8 }
    ],
    aiSummaryCached: `### Yapay Zeka Yönetici Özeti (AI Executive Summary)

### 1. Mevcut Yalın Olgunluk Seviyesi Analizi
Arçelik Bolu Pişirici Cihazlar İşletmesi, %78 Yalın Olgunluk skoru ile sektör ortalamasının oldukça üzerinde, "Olgun" seviyede bir Gemba disiplinine sahiptir. Fabrikada oturmuş bir Günlük Yönetim sistemi mevcut olup, görsel kontrol panoları sahanın her alanında aktiftir.

### 2. Güçlü Yönler
* **Yüksek Görsel Yönetim:** Günlük yönetim süreçlerinin vardiya başlangıç toplantıları (Tier 1 & Tier 2) ile desteklenmesi.
* **Kojenerasyon ve Enerji Altyapısı:** Yardımcı tesislerin (1.2 MW Kojenerasyon) üretim taleplerine kesintisiz ve verimli yanıt vermesi.

### 3. Zayıf Yönler & Kritik İsraflar
* **Pres Kalıp Değişim Süreleri:** Pres atölyesindeki kalıp değişimlerinin (SMED öncesi 38 dk) yüksek parti büyüklüklerine ve WIP (Yarı mamul) yığılmasına sebep olması.
* **Dengeleme Kayıpları:** Montaj Hattı 2'deki istasyonlar arasında çevrim sürelerinde dengesizlikler ve buna bağlı operatör bekleme kayıpları.

### 4. En Büyük Kayıp Alanları & Darboğazlar
Eisenmann Elektrostatik Emaye Fırını fabrikanın temel darboğazıdır (%72 OEE). Bu istasyondaki plansız duruşlar ve konveyör hızı uyumsuzlukları tüm montaj hatlarının besleme hızını sınırlamaktadır.

### 5. Önerilen Sonraki Yalın Proje & Beklenen ROI / Tasarruf
* **Proje:** Emaye Fırını Otonom Bakım (TPM Seviye 2) Entegrasyonu.
* **Yıllık Tasarruf Hedefi:** $120,000 (Duruşların %30 azaltılmasıyla).
* **ROI:** %280 yatırım geri dönüşü.`
  },
  ford_otosan: {
    customerId: "ford_otosan",
    taxNumber: "3880017409",
    taxOffice: "Gölcük Vergi Dairesi",
    website: "https://www.fordotosan.com.tr",
    country: "Türkiye",
    city: "Kocaeli",
    shortName: "Ford Gölcük",
    yearEstablished: 1959,
    logoUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=80&fit=crop&q=60",
    gpsCoordinates: "40.7167, 29.8833",
    factories: [
      {
        name: "Gölcük Yeniköy Fabrikası",
        plantCode: "FAC-FO-YENI",
        buildingName: "Yeniköy Elektrikli Araç Gövde Üretim Tesisi",
        factoryArea: 320000,
        closedArea: 210000,
        openArea: 110000,
        productionArea: 145000,
        warehouseArea: 45000,
        officeArea: 20000,
        floorsCount: 3,
        productionLines: ["Elektrikli Transit Montaj Hattı A", "Batarya Montaj Hattı C", "Gövde Kaynak Robotik Hattı", "Yüzey Kaplama Boyahane"],
        departments: ["Pres Atölyesi", "Gövde Robotik Kaynak", "Boyahane", "Batarya Montaj", "Son Montaj", "Lojistik & AGV Yönetimi"],
        mainProcesses: ["Robotik Kaynak", "Plastik Enjeksiyon", "Katoforez Kaplama", "Sürekli Montaj Hattı", "Batarya Paketleme"],
        layoutFiles: ["FAC-FO-YENI-Layout.dwg", "AGV-Navigation-Map.dwg"]
      }
    ],
    operational: {
      annualProductionQuantity: 420000,
      productFamilies: ["Ford Transit Custom (Dizel/Hibrit)", "Ford E-Transit (Elektrikli)", "Batarya Paketleri"],
      mainCustomers: ["Ford Europe", "Ford UK", "Türkiye Ticari Filolar"],
      productionStrategy: "MTO",
      assemblyType: "Discrete"
    },
    workforce: {
      totalEmployees: 2450,
      blueCollar: 1980,
      whiteCollar: 470,
      engineers: 185,
      officeStaff: 120,
      operators: 1450,
      maintenanceStaff: 180,
      qualityStaff: 130,
      contractWorkers: 110,
      temporaryWorkers: 40,
      shiftsCount: 3,
      shiftPattern: "3x8 Kesintisiz Dönüşümlü",
      workingDays: 6,
      dailyWorkingHours: 8,
      overtimePolicy: "Hafta sonu mesaisi %100, resmi tatiller %200 ödenir, dinlenme süreleri korunur."
    },
    opex: {
      leanMaturity: 84,
      oee: 81,
      currentImprovementProgram: "Kayıp Ağacı Analizi & Lojistik AGV Akış Optimizasyonu",
      kaizenSystem: "Sürekli İyileştirme Öneri Havuzu & 6 Sigma Proje Kampanyaları",
      tpmLevel: "Seviye 3 - Toplam Üretken Bakım (Tüm Hatlarda Otonom ve Kestirimci Bakım)",
      fivesLevel: 4.4,
      visualManagement: "High",
      dailyManagement: "High",
      opexScore: 84,
      currentBottlenecks: ["Gövde Kaynak Robot Hücresi Çevrim Süresi", "Lojistik Boş Kasa Çevrim Hızı", "Batarya Montajı Hücresel Dengeleme"],
      strategicObjectives: ["OEE Seviyesini %85'e Yükseltmek", "Robot Durmalarını (Micro-stops) %50 Azaltmak", "Lojistik Alan İhtiyacını %15 Azaltmak"]
    },
    contacts: {
      factoryManager: "Cem Temel",
      generalManager: "Güven Özyurt",
      productionManager: "Fatih Fidan",
      maintenanceManager: "Tarık Şen",
      qualityManager: "Zeynep Karahan",
      leanManager: "Ali Yıldız",
      hrManager: "Seda Aksoy",
      supplyChainManager: "Uğur Arslan",
      itManager: "Serkan Yılmaz",
      purchasingManager: "Ender Demir",
      financeManager: "Hakan Şener",
      primaryContactName: "Zeynep Karahan",
      primaryContactEmail: "zkarahan@ford.com.tr",
      primaryContactPhone: "+90 533 987 65 43",
      secondaryContactName: "Cem Temel",
      secondaryContactEmail: "ctemel@ford.com.tr",
      secondaryContactPhone: "+90 262 315 50 00"
    },
    assets: [
      { id: "ast_6", name: "Kuka Robotik Kaynak Hücresi G1", code: "ROB-KUK-G1", type: "Machine", location: "Gövde Robotik Kaynak", status: "Active", capacity: "1.2 vuruş/dakika", notes: "Batarya şasi robot kaynak hattı." },
      { id: "ast_7", name: "Batarya Montaj Sürekli Bandı", code: "L-BATT-ASSY", type: "ProductionLine", location: "Batarya Montaj Bölümü", status: "Active", capacity: "80 batarya/saat", notes: "Temiz oda (Clean Room) standartlarında." },
      { id: "ast_8", name: "Ana Montaj Sürekli Pulsing Hattı", code: "L-MAIN-PULS", type: "ProductionLine", location: "Son Montaj Holü", status: "Active", capacity: "45 araç/saat" },
      { id: "ast_9", name: "Lojistik Süpermarket ve AGV Şarj Garajı", code: "W-AGV-GAR", type: "Warehouse", location: "Lojistik Holü C", status: "Active", capacity: "24 AGV Kapasitesi" },
      { id: "ast_10", name: "Kızılötesi Boya Kurutma Kabini", code: "UT-PAINT-IR", type: "Utility", location: "Boyahane", status: "Active", capacity: "650 kW Infrared Isıtma" }
    ],
    projects: [
      { id: "p_4", name: "Lojistik AGV Rota Optimizasyonu Projesi", code: "PRJ-AGV-02", objective: "Malzeme taşıma mesafelerinin AGV rotalarının ve kuyruk sürelerinin simüle edilerek azaltılması.", startDate: "2026-02-01", endDate: "2026-05-15", status: "Completed", budget: 85000, currency: "€", roiPercent: 180, projectManager: "Zeynep Karahan" },
      { id: "p_5", name: "Kuka Robot Hücrelerinde Mikroduruş Azaltımı", code: "PRJ-ROB-04", objective: "Kestirimci bakım sensörleri ile kaynak robotu eksen durmalarının %40 oranında azaltılması.", startDate: "2026-05-01", endDate: "2026-10-30", status: "Active", budget: 150000, currency: "€", roiPercent: 320, projectManager: "Tarık Şen" }
    ],
    timeline: [
      { id: "t_5", date: "2026-01-20", title: "Ford Otosan Çalışma Alanı Tescili", type: "creation", description: "Yeniköy tesisi için dijital Gemba çalışma alanı ve veri entegrasyonu tamamlandı." },
      { id: "t_6", date: "2026-06-01", title: "Ford Q1 Yalın Olgunluk Sezon Değerlendirmesi", type: "audit", description: "Fabrika genelinde yapılan denetimde OEE ve süreç kararlılığı test edildi. Denetim skoru: 88/100", operator: "Zeynep Karahan" }
    ],
    documents: [
      { id: "d_5", name: "Yenikoy_Gövde_Hatti_Layout.pdf", folder: "Layouts", size: "6.8 MB", uploadDate: "2026-01-22" },
      { id: "d_6", name: "Ford_Q1_Maturity_Scores.xlsx", folder: "Audits", size: "3.4 MB", uploadDate: "2026-06-02" }
    ],
    kpiHistory: [
      { year: "2024", oee: 75, transportationDistance: 6200, fivesScore: 68, leadTimeDays: 7 },
      { year: "2025", oee: 78, transportationDistance: 5500, fivesScore: 78, leadTimeDays: 5 },
      { year: "2026", oee: 81, transportationDistance: 4800, fivesScore: 84, leadTimeDays: 4 }
    ],
    aiSummaryCached: `### Yapay Zeka Yönetici Özeti (AI Executive Summary)

### 1. Mevcut Yalın Olgunluk Seviyesi Analizi
Ford Otosan Gölcük/Yeniköy Fabrikası, %84 Yalın Olgunluk Skoru ile platform genelinde en yüksek skorlardan birine sahiptir. Fabrika Endüstri 4.0 ve Otomasyon seviyelerinde olgunlaşmış, AGV lojistiği ve robotik üretim hatları tamamen dijitalleştirilmiştir.

### 2. Güçlü Yönler
* **Yüksek Derecede Otomasyon:** Kuka robotlarının ve AGV malzeme taşıma sistemlerinin hatlara %95+ uyumla hizmet vermesi.
* **TPM Seviye 3:** Kestirimci bakım ve planlı otonom bakım sistemlerinin kusursuz entegrasyonu.

### 3. Zayıf Yönler & Kritik İsraflar
* **Mikro Duruşlar (Micro-stops):** Gövde kaynak robotlarındaki eksen sıkışmaları ve parça besleme tolerans hataları nedeniyle yaşanan saniyelik duraklamalar.
* **Batarya Montajı Hat Dengeleme:** Batarya paketleme hatlarında hücre montaj zamanlarındaki varyasyonlar nedeniyle oluşan istasyon bekleme süreleri.

### 4. En Büyük Kayıp Alanları & Darboğazlar
Gövde kaynak robot hücreleri ile plastik enjeksiyon tampon atölyesi arasındaki lojistik boş kasa çevrim hızı lojistik akışta zaman zaman darboğaza yol açmaktadır.

### 5. Önerilen Sonraki Yalın Proje & Beklenen ROI / Tasarruf
* **Proje:** Yapay Zeka Destekli Kaynak Robotu Mikroduruş Kestirimci Bakım Algoritmaları.
* **Yıllık Tasarruf Hedefi:** €180,000 (Mikroduruşların %50 düşürülmesiyle).
* **ROI:** %320 yatırım geri dönüşü.`
  }
};

export const getWorkspaceData = (customerId: string): CompanyWorkspaceExtended => {
  return defaultWorkspaces[customerId] || {
    customerId,
    factories: [],
    operational: {
      annualProductionQuantity: 0,
      productFamilies: [],
      mainCustomers: [],
      productionStrategy: "MTO",
      assemblyType: "Discrete"
    },
    workforce: {
      totalEmployees: 0,
      blueCollar: 0,
      whiteCollar: 0,
      engineers: 0,
      officeStaff: 0,
      operators: 0,
      maintenanceStaff: 0,
      qualityStaff: 0,
      contractWorkers: 0,
      temporaryWorkers: 0,
      shiftsCount: 1,
      shiftPattern: "1x8",
      workingDays: 5,
      dailyWorkingHours: 8,
      overtimePolicy: ""
    },
    opex: {
      leanMaturity: 50,
      oee: 50,
      currentImprovementProgram: "",
      kaizenSystem: "",
      tpmLevel: "",
      fivesLevel: 3,
      visualManagement: "Medium",
      dailyManagement: "Medium",
      opexScore: 50,
      currentBottlenecks: [],
      strategicObjectives: []
    },
    contacts: {
      factoryManager: "",
      generalManager: "",
      productionManager: "",
      maintenanceManager: "",
      qualityManager: "",
      leanManager: "",
      hrManager: "",
      supplyChainManager: "",
      itManager: "",
      purchasingManager: "",
      financeManager: "",
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      secondaryContactName: "",
      secondaryContactEmail: "",
      secondaryContactPhone: ""
    },
    assets: [],
    projects: [],
    timeline: [
      { id: "init", date: new Date().toISOString().split("T")[0], title: "Şirket Gemba Çalışma Alanı Oluşturuldu", type: "creation", description: "Firma için dijital çalışma alanı aktif edildi." }
    ],
    documents: [],
    kpiHistory: []
  };
};
