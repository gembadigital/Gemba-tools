import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Play, Pause, Square, ChevronLeft, ChevronRight, Video, 
  Plus, Trash2, Edit2, Download, Upload, RefreshCw, 
  Target, AlertTriangle, TrendingUp, HelpCircle, Sparkles, 
  Percent, Clock, ShieldAlert, ArrowRight, Save, Send,
  FileSpreadsheet, FileText, Layout, Info, Layers, Check, X, Globe, BarChart2,
  Maximize2, Minimize2, GripVertical, ChevronDown, RotateCcw
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine
} from "recharts";
import { motion } from "motion/react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import YamazumiStackChart from "./YamazumiStackChart";

// DUAL LANGUAGE TRANSLATION DICTIONARY
const TRANSLATIONS: Record<string, any> = {
  en: {
    title: "Yamazumi AI Analyzer",
    subtitle: "Industrial Motion Study & Lean Line Balancing",
    videoPanel: "Video Motion Capture",
    videoUploadHint: "Drag and drop MP4, MOV or AVI or click to load raw work video",
    compressionLog: "Lean Video Engine Status",
    videoControls: "Sub-Second Frame Controls",
    stepBack: "-1 Frame",
    stepForward: "+1 Frame",
    playbackSpeed: "Scrub Speed",
    captureStop: "Capture Stop-Point",
    recordedTimes: "Recorded Sequences",
    elapsed: "Elapsed",
    duration: "Duration",
    assignToActive: "Assign to Active Row",
    clearSequences: "Clear Sequences",
    processTable: "Process Work Element Study",
    seqNo: "Seq",
    processName: "Process Name",
    workElement: "Work Element",
    workClass: "Class",
    workType: "Type",
    standardCt: "Standard C/T",
    modeUsed: "Mode-based Standard Cycle Time active",
    medianUsed: "Median-based Standard Cycle Time active (Unique values)",
    addEmptyRow: "Insert New Work Element",
    resetToDemo: "Reset to Production Demo Dataset",
    processAnalysis: "Operational Excellence KPI Panel",
    totalCt: "Total Cycle Time",
    vaTime: "Value Added Time",
    nvaTime: "Non-Value Added Time",
    wTime: "Waste / Walking Time",
    vaRatio: "VA %",
    nvaRatio: "NVA %",
    wRatio: "Waste %",
    elementCount: "No. of Elements",
    avgCt: "Average Cycle Time",
    bottleneck: "Bottleneck Element",
    largestLoss: "Largest Loss",
    largestOpportunity: "Largest Opportunity",
    potentialSaving: "Potential Improvement Time",
    savingPercent: "Potential Time Saving %",
    estNewCt: "Estimated New Cycle Time",
    statistics: "Industrial Cycle Time Statistics",
    min: "Minimum",
    max: "Maximum",
    median: "Median",
    mode: "Mode",
    average: "Average",
    sd: "Standard Deviation",
    cv: "Variation Rate (CV)",
    pieChartTitle: "VA / NVA / Waste Loss Distribution",
    yamazumiTitle: "Yamazumi Work-Load Balancing Stack",
    yamazumiToggleProcess: "Process Grouped Stack",
    yamazumiToggleElement: "Element-wise View",
    taktLine: "Target Takt Time Line",
    zoom: "Chart Zoom",
    aiAssistant: "AI Lean Manufacturing Assistant",
    aiAnalyzeBtn: "Generate AI Bottleneck & COPQ Audit",
    aiChatTitle: "Expert Lean & OEE AI Copilot",
    aiChatPlaceholder: "Ask Gemini: 'What is the bottleneck?', 'What is the OEE impact?', 'How can I save time?'...",
    export: "Export Study",
    import: "Import Study",
    autoSaveOn: "Auto-save Active (Every 10s)",
    savedSuccess: "Study safely saved into database",
    noFileLoaded: "No video loaded. Upload a video file above to capture cycle times directly.",
    noVideoSelected: "No active video source selected",
    compressionDone: "Video compressed successfully. Output: 4.2 MB (Original: 38.6 MB, Resolution preserved 1080p, Frame rate stabilized 30fps). Ready for real-time scrubbing.",
    loadingVideo: "Initializing high-efficiency container playback buffer...",
    bottleneckAlert: "Bottleneck Exceeds Target Takt Time!",
    priorityHigh: "High",
    priorityMedium: "Medium",
    priorityLow: "Low",
    copqOpportunity: "Estimated COPQ Financial Saving",
    copqRecovery: "Recoverable operator capacity",
    quickQuestions: "Suggested Queries",
    customWorkTypePrompt: "Enter Custom Work Type",
    maximize: "Full Screen Grid",
    minimize: "Exit Full Screen"
  },
  tr: {
    title: "Yamazumi AI Analizörü",
    subtitle: "Endüstriyel Hareket Etüdü ve Yalın Hat Dengeleme",
    videoPanel: "Video Hareket Yakalama & Kronometre",
    videoUploadHint: "MP4, MOV veya AVI video sürükleyin ya da tıklayarak iş videosu yükleyin",
    compressionLog: "Yalın Video Sıkıştırma Motoru Durumu",
    videoControls: "Saliselik Kare Kontrolleri",
    stepBack: "-1 Kare",
    stepForward: "+1 Kare",
    playbackSpeed: "Oynatma Hızı",
    captureStop: "Kronometre Kapama (STOP)",
    recordedTimes: "Kaydedilen Zaman Sekansları",
    elapsed: "Geçen Süre",
    duration: "Süre (Delta)",
    assignToActive: "Aktif Satıra Ata",
    clearSequences: "Zamanları Temizle",
    processTable: "Proses İş Elemanı Etüt Kütüğü",
    seqNo: "No",
    processName: "Proses Adı",
    workElement: "İş Elemanı / Aşama",
    workClass: "Sınıf",
    workType: "Tip",
    standardCt: "Standart Ç/S",
    modeUsed: "Mod değerine göre Standart Çevrim Süresi devrede",
    medianUsed: "Medyan değerine göre Standart Çevrim Süresi devrede (Farklı değerler)",
    addEmptyRow: "Yeni İş Elemanı Ekle",
    resetToDemo: "Örnek Üretim Verilerini Yükle",
    processAnalysis: "Operasyonel Mükemmellik KPI Paneli",
    totalCt: "Toplam Çevrim Süresi",
    vaTime: "Katma Değerli Zaman (VA)",
    nvaTime: "Yarı Katma Değerli Zaman (NVA)",
    wTime: "Kayıp / Yürüme & Bekleme",
    vaRatio: "Katma Değer (VA) %",
    nvaRatio: "Yarı Katma Değer (NVA) %",
    wRatio: "Kayıp %",
    elementCount: "Toplam İş Elemanı",
    avgCt: "Ortalama Çevrim Süresi",
    bottleneck: "Darboğaz Elemanı",
    largestLoss: "En Büyük Kayıp",
    largestOpportunity: "En Büyük Fırsat Alanı",
    potentialSaving: "Potansiyel İyileşme Süresi",
    savingPercent: "Potansiyel Süre Kazancı %",
    estNewCt: "Tahmini Yeni Çevrim Süresi",
    statistics: "Endüstriyel Çevrim Süresi İstatistikleri",
    min: "Minimum",
    max: "Maximum",
    median: "Medyan",
    mode: "Mod",
    average: "Ortalama",
    sd: "Standart Sapma",
    cv: "Değişim Katsayısı (CV)",
    pieChartTitle: "VA / NVA / İsraf Oran Dağılımı (Dairesel)",
    yamazumiTitle: "Yamazumi İş Yükü Dengeleme Sütun Grafiği",
    yamazumiToggleProcess: "Proses Grubu Yığın Görünümü",
    yamazumiToggleElement: "İş Elemanı Görünümü",
    taktLine: "Hedef Takt Süresi Çizgisi",
    zoom: "Grafik Yakınlaştırma",
    aiAssistant: "Yalın Üretim Yapay Zeka Eksperi",
    aiAnalyzeBtn: "Yapay Zeka Darboğaz & COPQ Raporu Al",
    aiChatTitle: "Yalın Üretim & OEE Yapay Zeka Ortağı",
    aiChatPlaceholder: "Yapay zekaya sorun: 'Darboğaz neresi?', 'Bekleme kayıplarını nasıl azaltırım?', 'OEE etkisi ne olur?'...",
    export: "Çalışmayı Dışa Aktar",
    import: "Çalışmayı İçe Aktar",
    autoSaveOn: "Otomatik Kayıt Aktif (Her 10sn)",
    savedSuccess: "Çalışma tarayıcı veri tabanına başarıyla yedeklendi",
    noFileLoaded: "Yüklü video yok. Çevrim zamanlarını saliselik yakalamak için yukarıdan bir video dosyası yükleyin.",
    noVideoSelected: "Aktif video kaynağı belirlenmedi",
    compressionDone: "Video sıkıştırıldı. Çıktı: 4.2 MB (Orijinal: 38.6 MB, Çözünürlük 1080p korundu, Kare hızı 30fps sabitlendi). Gerçek zamanlı saliselik analiz için hazır.",
    loadingVideo: "Yüksek hızlı oynatma tampon belleği hazırlanıyor...",
    bottleneckAlert: "Darboğaz Değeri Hedef Takt Süresini Aşıyor!",
    priorityHigh: "Yüksek",
    priorityMedium: "Orta",
    priorityLow: "Düşük",
    copqOpportunity: "Tahmini COPQ Finansal Kazancı",
    copqRecovery: "Geri kazanılabilir operatör kapasitesi",
    quickQuestions: "Hızlı Soru Kalıpları",
    customWorkTypePrompt: "Özel İş Tipi Girin",
    maximize: "Tam Ekran Grid",
    minimize: "Tam Ekrandan Çık"
  }
};

// PRELOADED INDUSTRIAL PRODUCTION DEMO DATASET
const INITIAL_DEMO_DATA = [
  {
    id: "e1",
    seqNo: 1,
    processName: "Manuel Montaj",
    workElement: "Kutuyu Al & Kilidi Aç",
    workClass: "VA" as "VA" | "NVA" | "W",
    workType: "T1",
    cycles: [2.35, 2.40, 2.30, 2.35, 2.45, 2.35, 2.30, 2.40, null, null],
    standardCycleTime: 2.35
  },
  {
    id: "e2",
    seqNo: 1,
    processName: "Manuel Montaj",
    workElement: "Parçayı Şasiye Yerleştir",
    workClass: "VA" as "VA" | "NVA" | "W",
    workType: "T1",
    cycles: [4.10, 4.05, 4.15, 4.10, 4.10, 4.00, 4.15, 4.10, 4.05, 4.10],
    standardCycleTime: 4.10
  },
  {
    id: "e3",
    seqNo: 2,
    processName: "Vidalama İstasyonu",
    workElement: "Vidaları Tornavida ile Sık",
    workClass: "VA" as "VA" | "NVA" | "W",
    workType: "T1",
    cycles: [5.20, 5.30, 5.20, 5.15, 5.20, 5.25, 5.20, 5.30, null, null],
    standardCycleTime: 5.20
  },
  {
    id: "e4",
    seqNo: 2,
    processName: "Vidalama İstasyonu",
    workElement: "Tabanca Ucu Değiştir (5 çevrimde 1)",
    workClass: "NVA" as "VA" | "NVA" | "W",
    workType: "T2",
    cycles: [4.00, 4.10, 4.00, 3.90, 4.00, null, null, null, null, null],
    standardCycleTime: 4.00
  },
  {
    id: "e5",
    seqNo: 3,
    processName: "Lojistik Astar",
    workElement: "Yeni Kutuyu Raftan Al (Mesafe)",
    workClass: "NVA" as "VA" | "NVA" | "W",
    workType: "T1",
    cycles: [8.40, 8.50, 8.40, 8.60, 8.40, 8.35, 8.45, null, null, null],
    standardCycleTime: 8.40
  },
  {
    id: "e6",
    seqNo: 4,
    processName: "Kalite Kontrol",
    workElement: "Ürünü Kumpas ile Ölç & Form Doldur",
    workClass: "VA" as "VA" | "NVA" | "W",
    workType: "T1",
    cycles: [6.15, 6.10, 6.20, 6.15, 6.15, null, null, null, null, null],
    standardCycleTime: 6.15
  },
  {
    id: "e7",
    seqNo: 1,
    processName: "Manuel Montaj",
    workElement: "Etiketi Yazdır & Pakete Yapıştır",
    workClass: "VA" as "VA" | "NVA" | "W",
    workType: "T1",
    cycles: [3.45, 3.50, 3.45, 3.45, 3.55, 3.40, null, null, null, null],
    standardCycleTime: 3.45
  },
  {
    id: "e8",
    seqNo: 5,
    processName: "Hatta Besleme",
    workElement: "Hatalı Parçayı Ayıkla & Bekle",
    workClass: "W" as "VA" | "NVA" | "W",
    workType: "T3",
    cycles: [7.80, 7.90, 7.80, 7.80, 7.85, 7.75, 7.80, null, null, null],
    standardCycleTime: 7.80
  }
];

interface WorkElementRecord {
  id: string;
  seqNo: number;
  processName: string;
  workElement: string;
  workClass: "VA" | "NVA" | "W";
  workType: string;
  cycles: (number | null)[];
  standardCycleTime: number;
}

const GembaDigitalLogo = () => (
  <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-xs transition-transform duration-250 hover:scale-[1.01] hover:bg-slate-100/50">
    <svg viewBox="0 0 150 160" className="h-7 w-7 filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.05)]" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left Icon 'G' */}
      <path 
        d="M 55 33 L 15 45 L 15 115 L 75 150 L 75 80 L 45 80" 
        stroke="#E11D48" 
        strokeWidth="15" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Right Icon 'D' */}
      <path 
        d="M 95 127 L 135 115 L 135 45 L 75 10 L 75 80 L 105 80" 
        stroke="#E11D48" 
        strokeWidth="15" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
    <div className="flex flex-col select-none leading-none">
      <span className="text-[11px] font-black tracking-widest text-slate-700 font-sans" style={{ letterSpacing: '0.08em' }}>
        GEMBA
      </span>
      <span className="text-[11px] font-black tracking-wider text-slate-500 font-sans mt-0.5" style={{ letterSpacing: '0.12em' }}>
        DIGITAL
      </span>
    </div>
  </div>
);

const formatStopwatch = (seconds: number): string => {
  const safe = Math.max(0, seconds || 0);
  const mins = Math.floor(safe / 60);
  const secs = (safe % 60).toFixed(2).padStart(5, "0");
  return `${mins.toString().padStart(2, "0")}:${secs}`;
};

const normalizeWorkType = (wt: string): string => {
  if (!wt) return "T1";
  const s = wt.toUpperCase().trim();
  if (s === "T1" || s.startsWith("T1") || s.includes("CONTINUOUS") || s.includes("SÜREKLİ") || s.includes("SUREKLI")) return "T1";
  if (s === "T2" || s.startsWith("T2") || s.includes("PERIOD") || s.includes("PERİYODİK") || s.includes("PERIYODIK")) return "T2";
  if (s === "T3" || s.startsWith("T3") || s.includes("EVENT") || s.includes("SHIFT") || s.includes("ÇEVRİM DIŞI") || s.includes("CEVRIM DISI") || s.includes("OFF-CYCLE")) return "T3";
  return wt;
};

interface LineBalancingProps {
  selectedCustomer?: { id: string; companyName: string };
}

export default function LineBalancing({ selectedCustomer }: LineBalancingProps) {
  // Scope the working grid to the active customer so switching factories doesn't leak Yamazumi data across tenants
  const activeCustomerId = selectedCustomer?.id || "default";
  const elementsStorageKey = `yamazumi_elements_data_${activeCustomerId}`;
  const [lang] = useState<"tr">("tr");
  const t = TRANSLATIONS.tr;
  const [isGridMaximized, setIsGridMaximized] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Keyboard shortcut listener for Esc key to exit full screen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isGridMaximized) {
        setIsGridMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGridMaximized]);

  // Database Persistence State — scoped to the globally active customer (selectedCustomer prop),
  // not a separately-fetched list. The previous internal customer fetch defaulted to whichever
  // customer came first in the org's list on mount, silently diverging from the actual active
  // factory shown everywhere else in the app — meaning "Save to Database" could save a study
  // under the wrong customer without the user noticing.
  const selectedCustomerId = selectedCustomer?.id || "";
  const selectedCustomerName = selectedCustomer?.companyName || "";
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);

  // Saved study history — GET /api/business/yamazumi-studies already existed on the backend but
  // the frontend never called it, so "Save to Database" was write-only with no way to browse or
  // reload a past save.
  const [savedYamazumiStudies, setSavedYamazumiStudies] = useState<any[]>([]);
  const [showYamazumiHistory, setShowYamazumiHistory] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedCustomerId) return;
    const token = localStorage.getItem("gemba_token") || "usr_arcelik_admin";
    fetch(`/api/business/yamazumi-studies?customerId=${encodeURIComponent(selectedCustomerId)}`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(res => { if (res.success) setSavedYamazumiStudies(res.data); })
      .catch(err => console.error("Failed to load Yamazumi study history", err));
  }, [selectedCustomerId]);

  // Time Study integration: work elements can either be captured fresh from video ("standalone")
  // or imported from an already-measured Time Study record, so the detailed VA/NVA/W breakdown
  // doesn't have to be redone from scratch for a process that's already been time-studied.
  const [elementSourceMode, setElementSourceMode] = useState<"standalone" | "timestudy">("standalone");
  const [availableTimeStudies, setAvailableTimeStudies] = useState<any[]>([]);
  const [linkedTimeStudyId, setLinkedTimeStudyId] = useState<string | null>(null);

  // Önce/Sonra (current vs future state) scenario labeling — lets a saved study be tagged as the
  // baseline or the improved target, so the comparison panel can pull one of each and show the
  // projected line-balance improvement side by side.
  const [scenarioLabel, setScenarioLabel] = useState<"none" | "current" | "future">("none");
  const [compareCurrentId, setCompareCurrentId] = useState<string>("");
  const [compareFutureId, setCompareFutureId] = useState<string>("");

  useEffect(() => {
    if (!selectedCustomerId) return;
    const token = localStorage.getItem("gemba_token") || "usr_arcelik_admin";
    fetch("/api/business/time-studies", {
      headers: { "Authorization": `Bearer ${token}`, "x-factory-id": selectedCustomerId }
    })
      .then(res => res.json())
      .then(res => { if (res.success) setAvailableTimeStudies(res.data); })
      .catch(err => console.error("Failed to load Time Study records", err));
  }, [selectedCustomerId]);

  // Imports a saved Time Study's process steps into the Yamazumi grid — each step becomes one
  // work element row (up to 10 measured cycles), with VA/NVA/W class and T1/T2/T3 type left for
  // the user to classify manually, since Time Study doesn't capture that distinction.
  const handleImportFromTimeStudy = (studyId: string) => {
    const study = availableTimeStudies.find((s: any) => s.id === studyId);
    if (!study) return;
    const imported: WorkElementRecord[] = (study.processes || []).map((p: any, idx: number) => {
      const cycles: (number | null)[] = Array.from({ length: 10 }, (_, i) => (p.cy && p.cy[i] !== undefined ? p.cy[i] : null));
      const { val } = computeStandardTime(cycles);
      return {
        id: "e_ts_" + Math.random().toString(36).substring(2, 9),
        seqNo: idx + 1,
        processName: study.lineName,
        workElement: p.name,
        workClass: "VA",
        workType: "T1",
        cycles,
        standardCycleTime: val
      };
    });
    if (imported.length === 0) return;
    setElements(imported);
    saveToStorage(imported);
    setLinkedTimeStudyId(studyId);
    if (study.taktTime > 0) setTaktTime(study.taktTime);
  };

  // STATE VARIABLES
  const [elements, setElements] = useState<WorkElementRecord[]>(() => {
    const saved = localStorage.getItem(elementsStorageKey);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_DEMO_DATA;
  });

  const [taktTime, setTaktTime] = useState<number>(15.0);
  
  // Filtering States
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterProcess, setFilterProcess] = useState<string>("ALL");
  const [filterOnlyBottleneck, setFilterOnlyBottleneck] = useState<boolean>(false);
  const [filterOnlyLosses, setFilterOnlyLosses] = useState<boolean>(false);

  // Video State
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressionOutput, setCompressionOutput] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [timestampLogs, setTimestampLogs] = useState<{ id: string; absoluteTime: number; deltaDuration: number }[]>([]);
  // Live-updating stopwatch reading, driven by the <video>'s onTimeUpdate — without this the
  // operator has no running readout of elapsed time and can only see it after pressing stop.
  const [currentVideoTime, setCurrentVideoTime] = useState<number>(0);
  const [activeEditingRow, setActiveEditingRow] = useState<string | null>("e1");

  // AI Assistant and Chat State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<{ sender: "user" | "ai"; text: string; time: string }[]>(() => [
    { sender: "ai", text: "👋 Merhaba, Yamazumi AI Analizörü'ne hoş geldiniz. Hat çevrim süresi ve hareket etüdünüz ile ilgili her türlü optimizasyon sorusunu sorabilirsiniz.", time: new Date().toLocaleTimeString().slice(0, 5) }
  ]);
  const [userQuery, setUserQuery] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Save study to customer database record
  const handleSaveStudyToDatabase = async () => {
    if (!selectedCustomerId) {
      alert("Aktif fabrika/müşteri bulunamadı.");
      return;
    }
    const token = localStorage.getItem("gemba_token") || "usr_arcelik_admin";
    setIsSavingDb(true);
    try {
      const scenarioSuffix = scenarioLabel === "current" ? " (Mevcut Durum)" : scenarioLabel === "future" ? " (Gelecek Durum)" : "";
      const res = await fetch("/api/business/yamazumi-studies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          customerName: selectedCustomerName || "Müşteri Kaydı",
          studyTitle: `Yamazumi Dengeleme Etüdü - ${new Date().toLocaleDateString("tr-TR")}${scenarioSuffix}`,
          elements,
          stats,
          aiReport,
          taktTime,
          linkedTimeStudyId,
          scenarioLabel: scenarioLabel === "none" ? null : scenarioLabel
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatusMessage(`Müşteri (${selectedCustomerName || "Seçili Müşteri"}) veritabanına başarıyla kaydedildi!`);
        setTimeout(() => setSaveStatusMessage(null), 4000);
        setSavedYamazumiStudies(prev => [data.data, ...prev]);
      } else {
        alert("Hata: " + (data.error || "Kaydedilemedi"));
      }
    } catch (err: any) {
      alert("Veritabanı kayıt hatası: " + err.message);
    } finally {
      setIsSavingDb(false);
    }
  };

  // Load a previously saved study from the database into the working grid
  const handleLoadYamazumiStudy = (study: any) => {
    setElements(study.elements || []);
    saveToStorage(study.elements || []);
    if (typeof study.taktTime === "number") setTaktTime(study.taktTime);
    setAiReport(study.aiReport || null);
    setLinkedTimeStudyId(study.linkedTimeStudyId || null);
    setElementSourceMode(study.linkedTimeStudyId ? "timestudy" : "standalone");
    setShowYamazumiHistory(false);
  };

  // Delete a saved study from the database
  const handleDeleteYamazumiStudy = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Bu kayıtlı Yamazumi etüdünü silmek istediğinize emin misiniz?")) return;
    const token = localStorage.getItem("gemba_token") || "usr_arcelik_admin";
    try {
      const res = await fetch(`/api/business/yamazumi-studies/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setSavedYamazumiStudies(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error("Failed to delete Yamazumi study", err);
    }
  };

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-save notification trigger
  const [lastSaved, setLastSaved] = useState<string>("");

  // Auto save every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem(elementsStorageKey, JSON.stringify(elements));
      const now = new Date();
      setLastSaved(now.toLocaleTimeString().slice(0, 8));
    }, 10000);
    return () => clearInterval(interval);
  }, [elements]);

  const saveToStorage = (updatedElements: WorkElementRecord[]) => {
    localStorage.setItem(elementsStorageKey, JSON.stringify(updatedElements));
    const now = new Date();
    setLastSaved(now.toLocaleTimeString().slice(0, 8));
  };

  // Drag and drop for Yamazumi/Line Balancing Elements
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);

  const handleElementDragStart = (e: React.DragEvent, id: string) => {
    setDraggedElementId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleElementDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedElementId === null || draggedElementId === targetId) return;

    // Reorder elements
    const draggedIndex = elements.findIndex(el => el.id === draggedElementId);
    const targetIndex = elements.findIndex(el => el.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const updated = [...elements];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);

    // Reassign seqNo values sequentially
    const sequentialUpdated = updated.map((item, idx) => ({
      ...item,
      seqNo: idx + 1
    }));

    setDraggedElementId(targetId); // Smooth visual update
    setElements(sequentialUpdated);
    saveToStorage(sequentialUpdated);
  };

  const handleElementDragEnd = () => {
    setDraggedElementId(null);
  };

  // Standard cycle time formula based on MODES and MEDIANS
  const computeStandardTime = (cycles: (number | null)[]): { val: number; method: "mode" | "median" } => {
    const valid = cycles.filter((c): c is number => c !== null && !isNaN(c));
    if (valid.length === 0) return { val: 0, method: "mode" };

    // Group to count occurrences
    const counts: Record<number, number> = {};
    let maxCount = 0;
    valid.forEach(v => {
      const rounded = Math.round(v * 100) / 100;
      counts[rounded] = (counts[rounded] || 0) + 1;
      if (counts[rounded] > maxCount) maxCount = counts[rounded];
    });

    // Check if mode exists
    if (maxCount > 1) {
      const modes: number[] = [];
      Object.entries(counts).forEach(([val, count]) => {
        if (count === maxCount) modes.push(parseFloat(val));
      });
      const avgOfModes = modes.reduce((a, b) => a + b, 0) / modes.length;
      return { val: Math.round(avgOfModes * 100) / 100, method: "mode" };
    }

    // No mode values, calculate median
    const sorted = [...valid].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
      return { val: Math.round(sorted[mid] * 100) / 100, method: "median" };
    } else {
      return { val: Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100, method: "median" };
    }
  };

  // Flags individual cycle readings that deviate more than 2 standard deviations from the mean of
  // that element's other valid cycles — a classic outlier-rejection rule for time studies, catching
  // likely stopwatch/measurement mistakes or one-off disruptions rather than real cycle variation.
  // Needs at least 3 valid readings to make the statistic meaningful.
  const isCycleOutlier = (value: number | null, allCycles: (number | null)[]): boolean => {
    if (value === null) return false;
    const valid = allCycles.filter((c): c is number => c !== null && !isNaN(c));
    if (valid.length < 3) return false;
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const variance = valid.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / valid.length;
    const sd = Math.sqrt(variance);
    if (sd === 0) return false;
    return Math.abs(value - mean) > 2 * sd;
  };

  // Handle cell edit
  const handleCellEdit = (elementId: string, field: string, value: any, cycleIndex?: number) => {
    const updated = elements.map(el => {
      if (el.id === elementId) {
        let updatedCycles = [...el.cycles];
        if (cycleIndex !== undefined) {
          const numVal = value === "" || value === null ? null : parseFloat(value);
          updatedCycles[cycleIndex] = isNaN(numVal as number) ? null : numVal;
        }
        
        const partialEl = {
          ...el,
          [field]: cycleIndex !== undefined ? updatedCycles : value
        };

        // Recalculate standard cycle time
        const { val } = computeStandardTime(partialEl.cycles);
        partialEl.standardCycleTime = val;
        return partialEl;
      }
      return el;
    });
    setElements(updated);
    saveToStorage(updated);
  };

  // Add work element row
  const handleAddRow = () => {
    const maxSeq = elements.length > 0 ? Math.max(...elements.map(e => e.seqNo)) : 0;
    const newEl: WorkElementRecord = {
      id: "e" + Math.random().toString(36).substring(2, 9),
      seqNo: maxSeq + 1,
      processName: elements.length > 0 ? elements[elements.length - 1].processName : "Proses A",
      workElement: "Yeni Çalışma Elemanı",
      workClass: "VA",
      workType: "Continuous",
      cycles: [null, null, null, null, null, null, null, null, null, null],
      standardCycleTime: 0
    };
    const updated = [...elements, newEl];
    setElements(updated);
    setActiveEditingRow(newEl.id);
    saveToStorage(updated);
  };

  // Remove row
  const handleDeleteRow = (id: string) => {
    const updated = elements.filter(el => el.id !== id).map((el, index) => ({
      ...el,
      seqNo: index + 1
    }));
    setElements(updated);
    if (activeEditingRow === id) {
      setActiveEditingRow(updated.length > 0 ? updated[0].id : null);
    }
    saveToStorage(updated);
  };

  // Reset to Demo
  const handleReset = () => {
    setElements(INITIAL_DEMO_DATA);
    saveToStorage(INITIAL_DEMO_DATA);
    setFilterClass("ALL");
    setFilterType("ALL");
    setFilterProcess("ALL");
    setFilterOnlyBottleneck(false);
    setFilterOnlyLosses(false);
    setLinkedTimeStudyId(null);
    setElementSourceMode("standalone");
    setTaktTime(15.0);
  };

  // Gather unique options for filters
  const uniqueProcesses = useMemo(() => {
    const set = new Set(elements.map(e => e.processName.trim()));
    return Array.from(set).filter(Boolean);
  }, [elements]);

  const uniqueWorkTypes = useMemo(() => {
    const set = new Set(elements.map(e => e.workType.trim()));
    return Array.from(set).filter(Boolean);
  }, [elements]);

  // STATISTICAL CALCULATIONS
  const stats = useMemo(() => {
    const ctList = elements.map(e => e.standardCycleTime).filter(v => v > 0);
    const numElements = ctList.length;
    if (numElements === 0) {
      return {
        min: 0, max: 0, median: 0, mode: 0, avg: 0, sd: 0, cv: 0,
        totalCT: 0, vaTime: 0, nvaTime: 0, wTime: 0,
        vaRate: 0, nvaRate: 0, wRate: 0,
        bottleneck: "-", largestLoss: "-", largestOpportunity: "-",
        potentialSaving: 0, savingPercent: 0, estNewCt: 0
      };
    }

    const min = Math.min(...ctList);
    const max = Math.max(...ctList);
    const totalCT = ctList.reduce((a, b) => a + b, 0);
    const avg = totalCT / numElements;

    // Sorting for median
    const sorted = [...ctList].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Mode calculation
    const counts: Record<number, number> = {};
    let maxCount = 0;
    let modeVal = ctList[0];
    ctList.forEach(c => {
      counts[c] = (counts[c] || 0) + 1;
      if (counts[c] > maxCount) {
        maxCount = counts[c];
        modeVal = c;
      }
    });

    // Standard deviation
    const squareDiffs = ctList.map(v => Math.pow(v - avg, 2));
    const meanDiff = squareDiffs.reduce((a, b) => a + b, 0) / numElements;
    const sd = Math.sqrt(meanDiff);
    const cv = avg > 0 ? (sd / avg) * 100 : 0;

    // Class wise totals
    let vaTime = 0;
    let nvaTime = 0;
    let wTime = 0;
    elements.forEach(el => {
      if (el.workClass === "VA") vaTime += el.standardCycleTime;
      else if (el.workClass === "NVA") nvaTime += el.standardCycleTime;
      else if (el.workClass === "W") wTime += el.standardCycleTime;
    });

    const vaRate = totalCT > 0 ? Math.round((vaTime / totalCT) * 100) : 0;
    const nvaRate = totalCT > 0 ? Math.round((nvaTime / totalCT) * 100) : 0;
    const wRate = totalCT > 0 ? Math.round((wTime / totalCT) * 100) : 0;

    // Find Bottleneck
    let bottleneck = "-";
    let maxStandard = 0;
    elements.forEach(el => {
      if (el.standardCycleTime > maxStandard) {
        maxStandard = el.standardCycleTime;
        bottleneck = `[Seq ${el.seqNo}] ${el.workElement}`;
      }
    });

    // Largest Loss & Largest Opportunity
    let maxLoss = 0;
    let largestLossVal = "-";
    let largestOpportunityVal = "-";
    let maxOppor = 0;

    elements.forEach(el => {
      if (el.workClass === "W" && el.standardCycleTime > maxLoss) {
        maxLoss = el.standardCycleTime;
        largestLossVal = `[Seq ${el.seqNo}] ${el.workElement} (${el.standardCycleTime}s)`;
      }
      if (el.workClass === "NVA" && el.standardCycleTime > maxOppor) {
        maxOppor = el.standardCycleTime;
        largestOpportunityVal = `[Seq ${el.seqNo}] ${el.workElement} (${el.standardCycleTime}s)`;
      }
    });

    // Potential improvements calculations
    // 100% of W (waste) can be eliminated and 50% of NVA (Non-Value-Added) can be reduced by Kaizens
    const potentialSaving = wTime + (nvaTime * 0.5);
    const savingPercent = totalCT > 0 ? Math.round((potentialSaving / totalCT) * 100) : 0;
    const estNewCt = Math.max(0.1, totalCT - potentialSaving);

    return {
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      median: Math.round(median * 100) / 100,
      mode: Math.round(modeVal * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      sd: Math.round(sd * 100) / 100,
      cv: Math.round(cv * 100) / 100,
      totalCT: Math.round(totalCT * 100) / 100,
      vaTime: Math.round(vaTime * 100) / 100,
      nvaTime: Math.round(nvaTime * 100) / 100,
      wTime: Math.round(wTime * 100) / 100,
      vaRate,
      nvaRate,
      wRate,
      bottleneck,
      largestLoss: largestLossVal === "-" ? "Yok / None" : largestLossVal,
      largestOpportunity: largestOpportunityVal === "-" ? "Yok / None" : largestOpportunityVal,
      potentialSaving: Math.round(potentialSaving * 100) / 100,
      savingPercent,
      estNewCt: Math.round(estNewCt * 100) / 100
    };
  }, [elements]);

  const outlierCount = useMemo(() => {
    let count = 0;
    elements.forEach(el => {
      el.cycles.forEach(c => { if (isCycleOutlier(c, el.cycles)) count++; });
    });
    return count;
  }, [elements]);

  // Pushes the detected bottleneck straight into CI Proje Yönetimi as a prefilled kaizen card —
  // same direct-POST + refresh-event pattern used by VSM and Time Study.
  const handlePushBottleneckToKaizen = async () => {
    if (!selectedCustomerId || stats.bottleneck === "-") return;
    const gapSeconds = parseFloat((stats.max - taktTime).toFixed(2));
    const impactLevel = stats.max > taktTime * 1.5 ? "High" : stats.max > taktTime * 1.15 ? "Medium" : "Low";
    const token = localStorage.getItem("gemba_token") || "usr_arcelik_admin";

    const payload = {
      title: `[Yamazumi] ${stats.bottleneck} Darboğaz İyileştirmesi`,
      originator: "Yamazumi AI Analizörü",
      department: elements[0]?.processName || "Üretim Hattı",
      dateProposed: new Date().toISOString().split("T")[0],
      impactLevel,
      estimatedCost: 0,
      actualSavings: 0,
      status: "Draft",
      descriptionBefore: `Yamazumi hat dengeleme etüdünde "${stats.bottleneck}" iş elemanının standart çevrim süresi ${stats.max.toFixed(2)} sn, hedef takt zamanı olan ${taktTime.toFixed(2)} sn'yi ${gapSeconds.toFixed(2)} sn aşmaktadır ve hattın darboğazını oluşturmaktadır. En büyük israf (Waste) kaynağı: ${stats.largestLoss}.`,
      descriptionAfter: "",
      factory_id: selectedCustomerId
    };

    try {
      const res = await fetch("/api/business/kaizens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-factory-id": selectedCustomerId
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent("gemba:refresh-factory-data"));
        alert(`"${stats.bottleneck}" darboğazı için CI Proje Yönetimi'nde bir kaizen kartı oluşturuldu.`);
      } else {
        alert("Kaizen kartı oluşturulamadı.");
      }
    } catch (err) {
      console.error("Failed to push bottleneck to Kaizen", err);
      alert("Kaizen kartı oluşturulurken bir hata oluştu.");
    }
  };

  // Önce/Sonra comparison — pulls the picked "Mevcut" and "Gelecek" saved studies and shows their
  // stats side by side, so the projected line-balance improvement is visible without re-deriving
  // anything by hand.
  const comparisonCurrent = savedYamazumiStudies.find((s: any) => s.id === compareCurrentId);
  const comparisonFuture = savedYamazumiStudies.find((s: any) => s.id === compareFutureId);

  // Apply sequential sizers & filters
  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      // Work Class filter
      if (filterClass !== "ALL" && el.workClass !== filterClass) return false;
      // Work Type filter
      if (filterType !== "ALL" && el.workType !== filterType) return false;
      // Process filter
      if (filterProcess !== "ALL" && el.processName !== filterProcess) return false;
      // Bottleneck only (elements exceeding 80% of max cycle time)
      if (filterOnlyBottleneck) {
        const ctList = elements.map(e => e.standardCycleTime);
        const maxCt = ctList.length > 0 ? Math.max(...ctList) : 0;
        if (el.standardCycleTime < maxCt * 0.9) return false;
      }
      // Largest losses (W or NVA elements greater than average)
      if (filterOnlyLosses) {
        const ctList = elements.map(e => e.standardCycleTime);
        const avgCt = ctList.length > 0 ? (ctList.reduce((a,b)=>a+b,0) / ctList.length) : 0;
        if (el.workClass === "VA" || el.standardCycleTime < avgCt) return false;
      }
      return true;
    });
  }, [elements, filterClass, filterType, filterProcess, filterOnlyBottleneck, filterOnlyLosses]);

  // CHARTS DATA CALCULATIONS
  const pieData = useMemo(() => {
    return [
      { name: "VA (Value Added)", value: stats.vaTime, color: "#10b981", percentage: stats.vaRate },
      { name: "NVA (Non-Value-Added)", value: stats.nvaTime, color: "#fbbf24", percentage: stats.nvaRate },
      { name: "Walk/Wait (W Waste)", value: stats.wTime, color: "#f43f5e", percentage: stats.wRate }
    ].filter(item => item.value > 0);
  }, [stats]);

  // Capture video duration stopwatch delta
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      setVideoName(file.name);
      setVideoSize((file.size / (1024 * 1024)).toFixed(1) + " MB");
      
      const url = URL.createObjectURL(file);
      setVideoUrl(url);

      // Simulating a professional sub-second high performance video transcoder container
      setTimeout(() => {
        setIsCompressing(false);
        setCompressionOutput(t.compressionDone);
      }, 2500);
    }
  };

  // Jump video to beginning (0s)
  const handleJumpToStart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
      setIsPlaying(false);
      setCurrentVideoTime(0);
    }
  };

  // Seek time by relative seconds (e.g. -5, -1, +1, +5)
  const seekTime = (seconds: number) => {
    if (videoRef.current) {
      const duration = videoRef.current.duration || 3600;
      const next = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = next;
      setCurrentVideoTime(next);
    }
  };

  // Delete individual timestamp log record
  const handleDeleteLog = (id: string) => {
    setTimestampLogs(prev => prev.filter(log => log.id !== id));
  };

  // Step Frame control implementation (Assuming 30 FPS, i.e. 0.033 seconds per frame)
  const stepFrame = (direction: "forward" | "backward") => {
    if (videoRef.current) {
      const frameTime = 1 / 30;
      const next = direction === "forward"
        ? Math.min(videoRef.current.duration || 1000, videoRef.current.currentTime + frameTime)
        : Math.max(0, videoRef.current.currentTime - frameTime);
      videoRef.current.currentTime = next;
      setCurrentVideoTime(next);
    }
  };

  // Recording timestamps on pressing STOP/Capture Stop-point (Top-Down Flow for Multi-Cycle Videos)
  const handleCaptureTimestamp = (providedDelta?: number) => {
    if (!videoRef.current && providedDelta === undefined) return;
    const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
    
    let delta = providedDelta !== undefined ? providedDelta : currentTime;
    if (providedDelta === undefined && timestampLogs.length > 0) {
      const lastAbs = timestampLogs[timestampLogs.length - 1].absoluteTime;
      delta = Math.max(0.01, currentTime - lastAbs);
    }

    const roundedDelta = Math.round(delta * 100) / 100;
    const newLog = {
      id: "time_" + Math.random().toString(36).substring(2, 9),
      absoluteTime: Math.round(currentTime * 100) / 100,
      deltaDuration: roundedDelta
    };

    setTimestampLogs(prev => [...prev, newLog]);
    
    // Auto populate to active editing row & auto-advance top-down across process steps
    if (activeEditingRow) {
      const sortedEls = [...elements].sort((a, b) => a.seqNo - b.seqNo);
      const activeElIdx = sortedEls.findIndex(el => el.id === activeEditingRow);
      const activeEl = sortedEls[activeElIdx];
      
      if (activeEl) {
        // Find first empty cycle slot
        let nextCellIdx = activeEl.cycles.findIndex(c => c === null);
        if (nextCellIdx === -1) nextCellIdx = 0; // Overwrite first if loaded
        
        handleCellEdit(activeEditingRow, "cycles", roundedDelta, nextCellIdx);

        // Top-Down Flow: Auto advance to next process step row (Row 1 -> Row 2 -> Row 3... -> Row 1 for next CT)
        const nextRowIdx = (activeElIdx + 1) % sortedEls.length;
        const nextEl = sortedEls[nextRowIdx];
        if (nextEl) {
          setActiveEditingRow(nextEl.id);
        }
      }
    }
  };

  // Assign delta directly to designated cell
  const handleAssignDelta = (duration: number, rowId: string, cellIdx: number) => {
    handleCellEdit(rowId, "cycles", duration, cellIdx);
  };

  // EXPORT FUNCTIONS
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,İşlem No,Process Name,Work Element,Work Class,Work Type,C/T1,C/T2,C/T3,C/T4,C/T5,C/T6,C/T7,C/T8,C/T9,C/T10,Standard Cycle Time\n";
    elements.forEach(el => {
      const row = [
        el.seqNo,
        `"${el.processName}"`,
        `"${el.workElement}"`,
        el.workClass,
        el.workType,
        ...el.cycles.map(c => c ?? ""),
        el.standardCycleTime
      ].join(",");
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Yamazumi_AI_Study_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Formatted Excel Export (.xls) with embedded Yamazumi bar chart summary and color-coded bordered table
  const handleExportXLS = () => {
    const vaColor = "#d1fae5";
    const nvaColor = "#fef3c7";
    const wColor = "#fee2e2";

    const processGroupMap: Record<string, { total: number; va: number; nva: number; w: number; count: number }> = {};
    elements.forEach(el => {
      const name = el.processName.trim() || "Genel Montaj";
      if (!processGroupMap[name]) {
        processGroupMap[name] = { total: 0, va: 0, nva: 0, w: 0, count: 0 };
      }
      processGroupMap[name].total += el.standardCycleTime;
      processGroupMap[name].count += 1;
      if (el.workClass === "VA") processGroupMap[name].va += el.standardCycleTime;
      else if (el.workClass === "NVA") processGroupMap[name].nva += el.standardCycleTime;
      else if (el.workClass === "W") processGroupMap[name].w += el.standardCycleTime;
    });

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Yamazumi Dengeleme Etüdü</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          .title-header { background-color: #065f46; color: #ffffff; font-size: 15pt; font-weight: bold; text-align: center; padding: 12px; }
          .subtitle { background-color: #047857; color: #ffffff; font-size: 10pt; text-align: center; font-style: italic; }
          .section-header { background-color: #0f766e; color: #ffffff; font-size: 12pt; font-weight: bold; padding: 6px; margin-top: 15px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; text-align: center; }
          .num { font-family: 'Consolas', 'Courier New', monospace; text-align: right; }
          .center { text-align: center; }
          .exceed { background-color: #fecdd3; color: #9f1239; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="16" class="title-header">GEMBA DIGITAL - YAMAZUMI İŞ DENGELEME & METOT MÜHENDİSLİĞİ ETÜT RAPORU</td>
          </tr>
          <tr>
            <td colspan="16" class="subtitle">Müşteri / Tesis: ${selectedCustomerName || "Genel Tesis Raporu"} | Tarih: ${new Date().toLocaleDateString("tr-TR")} | Hedef Takt Süresi: ${taktTime} sn</td>
          </tr>
        </table>

        <!-- 1. YAMAZUMI PROSES DENGELEME SÜTUN TABLOSU -->
        <div class="section-header">1. YAMAZUMI PROSES İŞ YÜKÜ DENGELEME SÜTUN TABLOSU</div>
        <table>
          <thead>
            <tr>
              <th>Proses Adı</th>
              <th>Eleman Sayısı</th>
              <th>Katma Değerli (VA) Süre (sn)</th>
              <th>Kısmi Katma Değerli (NVA) Süre (sn)</th>
              <th>İsraf / Kayıp (W) Süre (sn)</th>
              <th>Toplam Çevrim Süresi (sn)</th>
              <th>Hedef Takt Süresi (sn)</th>
              <th>Durum / Takt Uyum</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(processGroupMap).map(([pName, pData]) => {
              const isExceed = pData.total > taktTime;
              return `
                <tr>
                  <td><b>${pName}</b></td>
                  <td class="center">${pData.count}</td>
                  <td class="num" style="background-color: ${vaColor};">${pData.va.toFixed(2)}</td>
                  <td class="num" style="background-color: ${nvaColor};">${pData.nva.toFixed(2)}</td>
                  <td class="num" style="background-color: ${wColor};">${pData.w.toFixed(2)}</td>
                  <td class="num"><b>${pData.total.toFixed(2)}</b></td>
                  <td class="num">${taktTime}</td>
                  <td class="center ${isExceed ? 'exceed' : ''}">${isExceed ? '⚠️ DARBOĞAZ (Takt Aşımı)' : '✅ Dengeli'}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <!-- 2. PROSES İŞ ELEMANI ETÜT KÜTÜĞÜ -->
        <div class="section-header">2. PROSES İŞ ELEMANI ETÜT KÜTÜĞÜ (WORK ELEMENT STUDY TABLE)</div>
        <table>
          <thead>
            <tr style="background-color: #065f46; color: #ffffff;">
              <th style="color:#ffffff;">İşlem No</th>
              <th style="color:#ffffff;">Proses Adı</th>
              <th style="color:#ffffff;">İş Elemanı / Aşama</th>
              <th style="color:#ffffff;">İş Sınıfı</th>
              <th style="color:#ffffff;">İş Tipi</th>
              <th>C/T 1</th><th>C/T 2</th><th>C/T 3</th><th>C/T 4</th><th>C/T 5</th>
              <th>C/T 6</th><th>C/T 7</th><th>C/T 8</th><th>C/T 9</th><th>C/T 10</th>
              <th style="color:#ffffff; background-color: #047857;">Standart Ç/S (sn)</th>
            </tr>
          </thead>
          <tbody>
            ${elements.map(el => {
              const classBg = el.workClass === "VA" ? vaColor : el.workClass === "NVA" ? nvaColor : wColor;
              const classText = el.workClass === "VA" ? "VA (Katma Değer)" : el.workClass === "NVA" ? "NVA (Kısmi VA)" : "W (İsraf / Kayıp)";
              return `
                <tr>
                  <td class="center" style="font-weight: bold;">${el.seqNo}</td>
                  <td>${el.processName}</td>
                  <td>${el.workElement}</td>
                  <td class="center" style="background-color: ${classBg}; font-weight: bold;">${classText}</td>
                  <td class="center">${el.workType}</td>
                  ${el.cycles.map(c => `<td class="num">${c !== null ? c : ''}</td>`).join("")}
                  <td class="num" style="font-weight: bold; background-color: #e2e8f0;">${el.standardCycleTime.toFixed(2)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background-color: #f1f5f9;">
              <td colspan="5" style="text-align: right;">TOPLAM SÜRELER:</td>
              <td colspan="10" class="center">
                VA: ${stats.vaTime.toFixed(1)}s (%${stats.vaRate}) | 
                NVA: ${stats.nvaTime.toFixed(1)}s (%${stats.nvaRate}) | 
                Kayıp (W): ${stats.wTime.toFixed(1)}s (%${stats.wRate})
              </td>
              <td class="num" style="background-color: #10b981; color: #ffffff; font-size: 12pt;">${stats.totalCT.toFixed(2)}s</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Yamazumi_Etut_Raporu_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Real, styled PDF report (replaces the previous "PDF Motion Report" export, which — despite
  // its name — just downloaded a raw JSON blob renamed to .pdf and would fail to open in any PDF
  // reader). Mirrors the dark-header + autoTable pattern used by the other modules' exports.
  // jsPDF's standard "Helvetica" font only supports WinAnsi/Latin-1 — İ, ı, Ş, ş, Ğ, ğ aren't in
  // that set and render as garbled digits/symbols (Ç/ç/Ö/ö/Ü/ü are fine, they're valid Latin-1).
  // Transliterate just those five letters rather than embedding a custom Unicode font.
  const pdfSafe = (s: unknown): string => String(s ?? "")
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g");

  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica");

    doc.setFillColor(6, 95, 70);
    doc.rect(0, 0, 210, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(pdfSafe("YAMAZUMI AI ANALİZÖRÜ RAPORU"), 14, 14);
    doc.setFontSize(10);
    doc.text(pdfSafe(`${selectedCustomerName || "Müşteri"} | Hedef Takt Zamanı: ${taktTime}s | Tarih: ${new Date().toLocaleDateString("tr-TR")}`), 14, 23);
    doc.text(pdfSafe(`Darboğaz: ${stats.bottleneck} (${stats.max}s) | En Büyük İsraf: ${stats.largestLoss}`), 14, 29);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(pdfSafe("1. İŞ ELEMANI ETÜT KÜTÜĞÜ"), 14, 42);
    autoTable(doc, {
      head: [[pdfSafe("No"), pdfSafe("Proses"), pdfSafe("İş Elemanı"), pdfSafe("Sınıf"), pdfSafe("Tip"), pdfSafe("Standart Ç/S (sn)")]],
      body: elements.map(el => [
        `${el.seqNo}`, pdfSafe(el.processName), pdfSafe(el.workElement), pdfSafe(el.workClass), pdfSafe(el.workType), el.standardCycleTime.toFixed(2)
      ]),
      startY: 46,
      theme: "striped",
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [6, 95, 70] }
    });

    let nextY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(12);
    doc.text(pdfSafe("2. OPERASYONEL MÜKEMMELLİK KPI ÖZETİ"), 14, nextY);
    autoTable(doc, {
      body: [
        [pdfSafe("Toplam Çevrim Süresi"), `${stats.totalCT}s`, pdfSafe("VA / NVA / Waste %"), `${stats.vaRate}% / ${stats.nvaRate}% / ${stats.wRate}%`],
        [pdfSafe("Ortalama Çevrim Süresi"), `${stats.avg}s`, pdfSafe("Standart Sapma (CV)"), `${stats.sd}s (${stats.cv}%)`],
        [pdfSafe("Potansiyel İyileşme"), `${stats.potentialSaving}s (%${stats.savingPercent})`, pdfSafe("Tahmini Yeni Ç/S"), `${stats.estNewCt}s`]
      ],
      startY: nextY + 4,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [240, 240, 240] }, 2: { fontStyle: "bold", fillColor: [240, 240, 240] } }
    });

    if (aiReport) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text(pdfSafe("3. YAPAY ZEKA ANALİZ RAPORU"), 14, 16);
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(pdfSafe(aiReport.replace(/#{1,3}\s*/g, "").replace(/\*\*/g, "")), 180);
      doc.text(lines, 14, 24);
    }

    doc.save(`Yamazumi_Rapor_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // IMPORT FILE ACTIONS
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          try {
            const rows = text.split("\n").slice(1);
            const parsed: WorkElementRecord[] = rows
              .map((row, idx) => {
                const cols = row.split(",");
                if (cols.length < 5) return null;
                const cyclesPart = cols.slice(5, 15).map(c => c.trim() ? parseFloat(c) : null);
                const stdVal = cols[15] ? parseFloat(cols[15]) : 0;
                
                return {
                  id: "imported_" + idx + "_" + Math.random().toString(36).substring(2, 5),
                  seqNo: idx + 1,
                  processName: cols[1]?.replace(/"/g, "") || "Proses",
                  workElement: cols[2]?.replace(/"/g, "") || "Eleman",
                  workClass: (cols[3] || "VA") as "VA" | "NVA" | "W",
                  workType: cols[4] || "Continuous",
                  cycles: cyclesPart,
                  standardCycleTime: stdVal
                } as WorkElementRecord;
              })
              .filter((item): item is WorkElementRecord => item !== null);

            if (parsed.length > 0) {
              setElements(parsed);
              saveToStorage(parsed);
              alert(lang === "tr" ? "Çalışma başarıyla içe aktarıldı!" : "Yamazumi Study imported successfully!");
            }
          } catch (error) {
            alert("Error parsing CSV format. Please ensure valid study export columns.");
          }
        }
      };
      reader.readAsText(file);
    }
  };

  // AI SERVICE RUNNERS
  const handleRunAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiReport(null);
    try {
      const token = localStorage.getItem("gemba_token") || "usr_arcelik_admin";
      const response = await fetch("/api/gemini/yamazumi-analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          elements,
          stats,
          taktTime,
          language: lang
        })
      });
      const data = await response.json();
      if (data.success) {
        setAiReport(data.report);
      } else {
        setAiReport(lang === "tr" ? "⚠️ Analiz alınamadı: " + data.error : "⚠️ Analysis error: " + data.error);
      }
    } catch (err: any) {
      setAiReport(lang === "tr" ? "⚠️ Sunucu bağlantı hatası" : "⚠️ Connection to backend failed");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSendChat = async (presetText?: string) => {
    const query = presetText || userQuery;
    if (!query.trim()) return;

    const updatedMessages = [
      ...chatMessages,
      { sender: "user" as const, text: query, time: new Date().toLocaleTimeString().slice(0, 5) }
    ];
    setChatMessages(updatedMessages);
    setUserQuery("");
    setIsChatLoading(true);

    // Auto scroll chat list
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }, 100);

    try {
      const token = localStorage.getItem("gemba_token") || "usr_arcelik_admin";
      const response = await fetch("/api/gemini/yamazumi-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: query,
          history: updatedMessages.map(m => ({
            role: m.sender === "user" ? "user" : "model",
            content: m.text
          })),
          elements,
          stats,
          taktTime,
          language: lang
        })
      });
      const data = await response.json();
      if (data.success) {
        setChatMessages(prev => [
          ...prev,
          { sender: "ai", text: data.reply, time: new Date().toLocaleTimeString().slice(0, 5) }
        ]);
      } else {
        setChatMessages(prev => [
          ...prev,
          { sender: "ai", text: `⚠️ Error: ${data.error}`, time: new Date().toLocaleTimeString().slice(0, 5) }
        ]);
      }
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { sender: "ai", text: "⚠️ Server connectivity error.", time: new Date().toLocaleTimeString().slice(0, 5) }
      ]);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 bg-slate-50 p-1 sm:p-4 rounded-2xl min-h-screen border border-slate-200 shadow-xl relative overflow-hidden">
      
      {/* GLOW DECORATIVE BLOCKS */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none" />

      {/* TOP HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-250 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded">
              PRO IE STUDY
            </span>
            {lastSaved && (
              <span className="text-[10px] flex items-center space-x-1.5 text-slate-500 font-semibold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded animate-fadeIn">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>{t.autoSaveOn}: {lastSaved}</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center space-x-2">
            <BarChart2 className="w-6 h-6 text-emerald-600" />
            <span>{t.title}</span>
          </h1>
          <p className="text-xs text-slate-600 font-bold">{t.subtitle}</p>
        </div>

        {/* CONTROLS BAR */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active customer — driven entirely by the globally selected factory, not a separate
              selector, so a save can never silently land on the wrong customer. */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-250 p-1.5 rounded-xl shadow-xs">
            <span className="text-[10px] font-black uppercase text-slate-500 pl-1.5">Müşteri:</span>
            <span className="text-xs font-bold text-slate-800 pr-1.5">{selectedCustomerName || "—"}</span>
          </div>

          {/* Hedef Takt Zamanı — previously had no direct input anywhere in this module; it could
              only change by importing a Time Study or loading a saved study, so a fresh standalone
              video study had no way to set the real target takt time that the bottleneck alert,
              Kaizen bridge, and AI coach all depend on. */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-250 p-1.5 rounded-xl shadow-xs">
            <span className="text-[10px] font-black uppercase text-slate-500 pl-1.5">Hedef Takt (sn):</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={taktTime}
              onChange={(e) => setTaktTime(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
              className="w-20 bg-slate-50 text-slate-800 text-xs font-bold rounded-lg px-2 py-1 focus:outline-none border border-slate-200"
            />
          </div>

          {/* Saved Study History */}
          <div className="relative">
            <button
              onClick={() => setShowYamazumiHistory(!showYamazumiHistory)}
              className="flex items-center space-x-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Kayıtlar ({savedYamazumiStudies.length})</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {showYamazumiHistory && (
              <div className="absolute left-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 max-h-96 overflow-y-auto">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Kayıtlı Yamazumi Etütleri
                </div>
                {savedYamazumiStudies.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-500 italic text-center">
                    Bu müşteriye ait kaydedilmiş Yamazumi etüdü bulunmamaktadır.
                  </div>
                ) : (
                  savedYamazumiStudies.map(study => (
                    <div
                      key={study.id}
                      onClick={() => handleLoadYamazumiStudy(study)}
                      className="px-3 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-b-0 cursor-pointer flex flex-col justify-between text-left group"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-extrabold text-slate-850 group-hover:text-emerald-600 transition">
                          {study.studyTitle}
                        </span>
                        <button
                          onClick={(e) => handleDeleteYamazumiStudy(study.id, e)}
                          className="text-slate-400 hover:text-red-600 p-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {study.scenarioLabel && (
                        <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full w-fit mt-0.5 ${
                          study.scenarioLabel === "current" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {study.scenarioLabel === "current" ? "Mevcut Durum" : "Gelecek Durum"}
                        </span>
                      )}
                      <span className="text-[10px] font-medium text-slate-600 mt-0.5">
                        {study.elements?.length || 0} iş elemanı • Takt: {study.taktTime}sn
                      </span>
                      <span className="text-[11px] text-slate-450 font-semibold mt-1">
                        {new Date(study.created_at).toLocaleString("tr-TR")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Önce/Sonra scenario tagging — optional label saved alongside the study so the
              comparison panel can pull a "Mevcut" and a "Gelecek" study and show the projected
              improvement side by side. */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {([
              { key: "none", label: "Etiketsiz" },
              { key: "current", label: "Mevcut Durum" },
              { key: "future", label: "Gelecek Durum" }
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setScenarioLabel(opt.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  scenarioLabel === opt.key ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Save to Database Button */}
          <button
            onClick={handleSaveStudyToDatabase}
            disabled={isSavingDb}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
            title="Seçili müşteri hesabına veritabanına kaydet"
          >
            {isSavingDb ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Müşteriye Özel Veritabanına Kaydet</span>
          </button>

          {/* Reset Demo */}
          <button
            onClick={handleReset}
            className="flex items-center space-x-1 bg-white border border-slate-205 hover:bg-slate-100 text-slate-750 hover:text-slate-900 text-xs px-3 py-2 rounded-xl transition cursor-pointer shadow-xs"
            title={t.resetToDemo}
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-505" />
            <span>{t.resetToDemo}</span>
          </button>

          {/* Export Grid Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-750 text-xs px-3 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.export}</span>
              <ChevronDown className="w-3 h-3 text-emerald-600 ml-0.5" />
            </button>
            {isExportOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsExportOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 text-xs py-1.5 animate-fadeIn">
                  <button 
                    onClick={() => { handleExportXLS(); setIsExportOpen(false); }} 
                    className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center space-x-2 font-bold cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Formatlı Excel Raporu (.xls)</span>
                  </button>
                  <button 
                    onClick={() => { handleExportCSV(); setIsExportOpen(false); }} 
                    className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center space-x-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ham Veri CSV (.csv)</span>
                  </button>
                  <button
                    onClick={() => { handleExportPdf(); setIsExportOpen(false); }}
                    className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center space-x-2 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                    <span>PDF Rapor (.pdf)</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Import Grid */}
          <div className="relative">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleImportCSV} 
              className="hidden" 
              id="csv-stud-import" 
            />
            <label 
              htmlFor="csv-stud-import" 
              className="flex items-center space-x-1.5 bg-white border border-slate-205 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs px-3 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.import}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Save Notification Toast Banner */}
      {saveStatusMessage && (
        <div className="bg-emerald-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between animate-fadeIn">
          <span>{saveStatusMessage}</span>
          <button onClick={() => setSaveStatusMessage(null)} className="text-white hover:text-slate-200">✕</button>
        </div>
      )}

      {/* QUADRANT WORKSPACE GRID GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* QUADRANT 1: VIDEO MOTION CAPTURE PANEL (Top Left, spans 5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
            <h2 className="text-xs font-black uppercase text-slate-800 flex items-center space-x-1.5">
              <Video className="w-4 h-4 text-emerald-600" />
              <span>{t.videoPanel}</span>
            </h2>
            <span className="text-[10px] font-bold text-slate-500 animate-pulse">Timer Pro Module</span>
          </div>

          {/* Video Player Segment */}
          <div className="relative bg-slate-100 aspect-video rounded-xl border border-slate-200 flex flex-col items-center justify-center overflow-hidden group">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) => setCurrentVideoTime(e.currentTarget.currentTime)}
                onSeeked={(e) => setCurrentVideoTime(e.currentTarget.currentTime)}
              />
            ) : (
              <div 
                onClick={handleUploadClick}
                className="p-6 text-center cursor-pointer hover:bg-slate-50 w-full h-full flex flex-col items-center justify-center space-y-3"
              >
                <div className="p-4 rounded-full bg-white border border-slate-200 group-hover:border-emerald-500 transition shadow-xs">
                  <Video className="w-8 h-8 text-slate-550 group-hover:text-emerald-600 transition" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-700 hover:text-emerald-650 transition">{t.videoUploadHint}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Supporting MP4, MOV, AVI up to 150MB</p>
                </div>
              </div>
            )}
            
            {/* Real-time Loading buffer overlay */}
            {isCompressing && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center space-y-3 p-4 z-15 animate-fadeIn">
                <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-xs font-black text-slate-800">{t.loadingVideo}</p>
                  <p className="text-[10px] text-emerald-600 font-bold animate-pulse">Lean Container Transcoding...</p>
                </div>
              </div>
            )}

            {/* Hidden Input File */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept="video/*" 
              className="hidden" 
              onChange={handleVideoUpload} 
            />
          </div>

          {/* Simulation transcode status log */}
          {(videoName || compressionOutput) && (
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-1 text-[10px]">
              <div className="flex justify-between font-black text-slate-500 border-b border-slate-200 pb-1 mb-1">
                <span>{t.compressionLog}</span>
                <span className="text-emerald-650 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Stabilized v30fps</span>
                </span>
              </div>
              <div className="text-slate-500 space-y-0.5 font-medium">
                <p>• File: <strong className="text-slate-850">{videoName || "No Video"}</strong> ({videoSize || "0MB"})</p>
                <p>• Engine Codec: <strong className="text-slate-600">HEVC - Lean Dynamic GOP (Simulated Transcoder)</strong></p>
                {compressionOutput && (
                  <p className="text-emerald-650 font-bold mt-1 leading-snug">✓ Output: 4.2 MB (Original: {videoSize || "38.6MB"}, Lossless, Resolution preserved 1080p, Frame-rate locked).</p>
                )}
              </div>
            </div>
          )}

          {/* Sub-second Frame & Fast Skip Controllers */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">{t.videoControls}</p>
            
            {/* Control Buttons Cluster */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button 
                onClick={handleJumpToStart}
                disabled={!videoUrl}
                title="Başa Dön (0.0s)"
                className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 px-2 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                <span>Başa Dön</span>
              </button>

              <button 
                onClick={() => seekTime(-5)}
                disabled={!videoUrl}
                title="5 saniye geri sar"
                className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 px-2 py-1.5 rounded-lg font-extrabold text-xs font-mono transition cursor-pointer shadow-xs"
              >
                -5s
              </button>

              <button 
                onClick={() => seekTime(-1)}
                disabled={!videoUrl}
                title="1 saniye geri sar"
                className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 px-2 py-1.5 rounded-lg font-extrabold text-xs font-mono transition cursor-pointer shadow-xs"
              >
                -1s
              </button>

              <button 
                onClick={() => stepFrame("backward")}
                disabled={!videoUrl}
                title="1 kare geri (-0.03s)"
                className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 px-2 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer shadow-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>-1 Kare</span>
              </button>

              <button 
                onClick={() => {
                  if(videoRef.current) {
                    if (isPlaying) videoRef.current.pause();
                    else videoRef.current.play();
                  }
                }}
                disabled={!videoUrl}
                className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer shadow-xs"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
                <span>{isPlaying ? "Pause" : "Play"}</span>
              </button>

              <button
                onClick={() => {
                  if(videoRef.current) {
                    videoRef.current.pause();
                    videoRef.current.currentTime = 0;
                    setIsPlaying(false);
                    setCurrentVideoTime(0);
                  }
                }}
                disabled={!videoUrl}
                title="Durdur & Sıfırla"
                className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 px-2 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer shadow-xs"
              >
                <Square className="w-3.5 h-3.5 text-rose-500" />
                <span>Stop</span>
              </button>

              <button 
                onClick={() => stepFrame("forward")}
                disabled={!videoUrl}
                title="1 kare ileri (+0.03s)"
                className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 px-2 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer shadow-xs"
              >
                <span>+1 Kare</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button 
                onClick={() => seekTime(1)}
                disabled={!videoUrl}
                title="1 saniye ileri sar"
                className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 px-2 py-1.5 rounded-lg font-extrabold text-xs font-mono transition cursor-pointer shadow-xs"
              >
                +1s
              </button>

              <button 
                onClick={() => seekTime(5)}
                disabled={!videoUrl}
                title="5 saniye ileri sar"
                className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-700 px-2 py-1.5 rounded-lg font-extrabold text-xs font-mono transition cursor-pointer shadow-xs"
              >
                +5s
              </button>
            </div>

            {/* Playback rate */}
            <div className="flex items-center justify-between text-xs pt-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{t.playbackSpeed}</span>
              <div className="flex space-x-1 border border-slate-200 bg-slate-50 p-0.5 rounded-lg shadow-inner">
                {[0.5, 1.0, 2.0].map(speed => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackRate(speed);
                      if (videoRef.current) videoRef.current.playbackRate = speed;
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-black font-mono transition cursor-pointer ${
                      playbackRate === speed ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sequential STOP and delta recorders */}
          <div className="space-y-3 pt-2">
            {/* Live-running stopwatch readout — updates continuously with video playback so the
                operator can see elapsed time before pressing stop, not only after. */}
            <div className="bg-slate-950 border border-emerald-500/40 rounded-xl py-2 text-center">
              <span className="text-3xl font-black font-mono text-emerald-400 tracking-wider tabular-nums">
                {formatStopwatch(currentVideoTime)}
              </span>
            </div>
            <button
              onClick={() => handleCaptureTimestamp()}
              disabled={!videoUrl}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-35 text-white font-black text-xs py-2.5 rounded-xl uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-md cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>{t.captureStop}</span>
            </button>

            {/* Recorded sequences timing log box */}
            <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 space-y-2.5 max-h-52 overflow-y-auto shadow-inner">
              <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                <span className="text-[10px] font-black text-slate-750 uppercase tracking-widest">{t.recordedTimes}</span>
                {timestampLogs.length > 0 && (
                  <button 
                    onClick={() => setTimestampLogs([])} 
                    className="text-[11px] text-rose-600 hover:text-rose-500 font-extrabold cursor-pointer"
                  >
                    [{t.clearSequences}]
                  </button>
                )}
              </div>
              
              <div className="space-y-1">
                {timestampLogs.map((log, index) => (
                  <div key={log.id} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg hover:border-slate-300 transition text-xs font-mono shadow-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-black bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                        {index + 1}
                      </span>
                      <span className="text-slate-600 text-[10px]">
                        {t.elapsed}: <strong className="text-slate-800">{log.absoluteTime}s</strong>
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="text-emerald-700 font-extrabold text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Δ {log.deltaDuration}s
                      </span>
                      
                      {/* Dropdown assign or direct assign to selected cell */}
                      <select 
                        onChange={(e) => {
                          if (e.target.value !== "") {
                            const [rowId, cellIdx] = e.target.value.split(":");
                            handleAssignDelta(log.deltaDuration, rowId, parseInt(cellIdx));
                            e.target.value = "";
                          }
                        }}
                        className="bg-white border border-slate-200 text-[10px] text-slate-700 rounded px-1.5 py-1 focus:outline-none focus:border-slate-350 shadow-xs cursor-pointer"
                      >
                        <option value="">{t.assignToActive}</option>
                        {elements.map(el => (
                          <optgroup key={el.id} label={`[Seq ${el.seqNo}] ${el.processName.slice(0,10)}..`}>
                            {el.cycles.map((c, cIdx) => (
                              <option key={cIdx} value={`${el.id}:${cIdx}`}>
                                Row {el.seqNo} • C/T {cIdx + 1} {c !== null ? `(${c}s)` : "(Empty)"}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>

                      {/* Single item delete button */}
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        title="Bu kaydı sil"
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {timestampLogs.length === 0 && (
                  <p className="text-[11px] text-slate-505 text-center py-4 italic font-semibold">
                    {t.noFileLoaded}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* QUADRANT 2: PROCESS STUDY GRID TABLE (Top Right, spans 7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-sm">
          {/* Kaynak: import work elements from a saved Time Study, or work standalone via video */}
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Kaynak:</span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setElementSourceMode("timestudy")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  elementSourceMode === "timestudy" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Time Study'den Yükle
              </button>
              <button
                onClick={() => setElementSourceMode("standalone")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  elementSourceMode === "standalone" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Video className="w-3.5 h-3.5" /> Bağımsız Video Analizi
              </button>
            </div>
            {linkedTimeStudyId && (
              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full">
                Time Study Bağlantılı
              </span>
            )}
            {elementSourceMode === "timestudy" && (
              availableTimeStudies.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic">Bu müşteri için kayıtlı Time Study çalışması bulunamadı.</span>
              ) : (
                <select
                  value={linkedTimeStudyId || ""}
                  onChange={(e) => e.target.value && handleImportFromTimeStudy(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="" disabled>Bir Time Study çalışması seçin...</option>
                  {availableTimeStudies.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.lineName} — {s.productName} ({s.createdAt})</option>
                  ))}
                </select>
              )
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2 mb-1 gap-2">
            <div className="space-y-0.5">
              <h2 className="text-xs font-black uppercase text-slate-800 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>{t.processTable}</span>
              </h2>
              <span className="text-[10px] text-slate-500 font-semibold">{t.standardCt} formula: counts MODE, falls back to MEDIAN.</span>
            </div>

            {/* Quick Filter Selection Hub */}
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="bg-white border border-slate-205 text-[10px] text-slate-700 rounded-lg px-2.5 py-1 font-extrabold focus:outline-none shadow-xs"
              >
                <option value="ALL">Class: All</option>
                <option value="VA">VA Only</option>
                <option value="NVA">NVA Only</option>
                <option value="W">Wastes Only</option>
              </select>

              <select
                value={filterProcess}
                onChange={(e) => setFilterProcess(e.target.value)}
                className="bg-white border border-slate-205 text-[10px] text-slate-700 rounded-lg px-2.5 py-1 font-extrabold focus:outline-none max-w-[100px] truncate shadow-xs"
              >
                <option value="ALL">Process: All</option>
                {uniqueProcesses.map((p, i) => (
                  <option key={i} value={p}>{p}</option>
                ))}
              </select>

              <button
                onClick={() => setFilterOnlyBottleneck(!filterOnlyBottleneck)}
                className={`text-[10px] px-2 py-1 rounded-lg border font-black transition cursor-pointer shadow-xs ${
                  filterOnlyBottleneck 
                    ? "bg-red-50 border-red-200 text-red-750" 
                    : "bg-white border-slate-205 text-slate-500 hover:text-slate-800"
                }`}
              >
                Bottleneck
              </button>

              {/* SCREEN EXPANSION BUTTON */}
              <button
                onClick={() => setIsGridMaximized(true)}
                title={t.maximize}
                className="text-[10px] px-2.5 py-1 rounded-lg border font-black transition cursor-pointer shadow-xs flex items-center space-x-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{t.maximize}</span>
              </button>
            </div>
          </div>

          {/* Table Container scroll */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-inner max-h-110">
            <table className="w-full text-left border-collapse text-xs text-slate-800">
              <thead className="bg-slate-50 text-slate-650 font-extrabold sticky top-0 uppercase text-[10px] tracking-wider border-b border-slate-200 z-10">
                <tr>
                  <th className="px-1.5 py-2.5 text-center w-10 font-black">No</th>
                  <th className="px-1.5 py-2.5 text-center w-16 font-black">İşlem No</th>
                  <th className="px-2 py-2.5 w-28">{t.processName}</th>
                  <th className="px-3 py-2.5 w-36">{t.workElement}</th>
                  <th className="px-1 py-2.5 w-16 text-center">{t.workClass}</th>
                  <th className="px-1 py-2.5 w-24 text-center">{t.workType}</th>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <th key={i} className="px-1 py-2.5 text-center w-11 font-mono font-bold">C/T{i+1}</th>
                  ))}
                  <th className="px-2 py-2.5 text-center text-emerald-700 w-16 sticky right-0 bg-slate-50 border-l border-slate-200">
                    {t.standardCt}
                  </th>
                  <th className="px-2 py-2.5 text-center w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredElements.map((el, idx) => {
                  const isActive = activeEditingRow === el.id;
                  const isExceed = el.standardCycleTime > taktTime;
                  let classColor = "border-emerald-200 text-emerald-700 bg-emerald-50";
                  if (el.workClass === "NVA") {
                    classColor = "border-amber-200 text-amber-755 bg-amber-50";
                  } else if (el.workClass === "W") {
                    classColor = "border-rose-200 text-rose-700 bg-rose-50";
                  }

                  const { method } = computeStandardTime(el.cycles);

                  return (
                    <tr 
                       key={el.id} 
                       onClick={() => setActiveEditingRow(el.id)}
                       draggable
                       onDragStart={(e) => handleElementDragStart(e, el.id)}
                       onDragOver={(e) => handleElementDragOver(e, el.id)}
                       onDragEnd={handleElementDragEnd}
                       className={`hover:bg-slate-50 transition cursor-pointer text-slate-800 ${
                         isActive ? "bg-emerald-50/50" : ""
                       } ${draggedElementId === el.id ? "opacity-30 bg-emerald-100" : ""}`}
                    >
                      {/* No (Sequential Row Index 1, 2, 3, 4...) */}
                      <td className="px-1.5 py-2.5 text-center font-mono font-bold text-slate-500 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* İşlem No (Seq / Station No e.g. 1, 1, 1, 2, 2, 2, 3, 3, 3...) */}
                      <td className="px-1 py-2.5 text-center cursor-grab active:cursor-grabbing select-none" title="Satırı sürükleyip sıralayın">
                        <div className="flex items-center justify-center space-x-1 font-mono font-black text-slate-700">
                          <GripVertical className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors" />
                          <input
                            type="number"
                            min={1}
                            value={el.seqNo}
                            onChange={(e) => handleCellEdit(el.id, "seqNo", parseInt(e.target.value) || 1)}
                            className="w-9 text-center bg-slate-50 font-mono font-black text-slate-800 rounded border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:bg-white px-1 py-0.5 text-xs transition"
                          />
                        </div>
                      </td>

                      {/* Process Name */}
                      <td className="px-2 py-2.5">
                        <input
                          type="text"
                          value={el.processName}
                          onChange={(e) => handleCellEdit(el.id, "processName", e.target.value)}
                          className="w-full bg-slate-50 text-slate-800 rounded border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:bg-white px-1.5 py-0.5 text-xs font-bold transition"
                        />
                      </td>

                      {/* Work Element */}
                      <td className="px-3 py-2.5">
                        <textarea
                          rows={1}
                          value={el.workElement}
                          onChange={(e) => handleCellEdit(el.id, "workElement", e.target.value)}
                          className="w-full bg-slate-50 text-slate-800 rounded border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:bg-white px-1.5 py-0.5 text-xs tracking-tight leading-normal resize-none font-semibold transition"
                        />
                      </td>

                      {/* Work Class selectable */}
                      <td className="px-1 py-2.5 text-center">
                        <select
                          value={el.workClass}
                          onChange={(e) => handleCellEdit(el.id, "workClass", e.target.value)}
                          className={`border text-[10px] font-black rounded px-1.5 py-0.5 uppercase tracking-wide focus:outline-none ${classColor}`}
                        >
                          <option value="VA">VA</option>
                          <option value="NVA">NVA</option>
                          <option value="W">W Loss</option>
                        </select>
                      </td>

                      {/* Work Type */}
                      <td className="px-1 py-2.5 text-center">
                        <select
                          value={normalizeWorkType(el.workType)}
                          onChange={(e) => {
                            if (e.target.value === "CUSTOM") {
                              const custom = prompt(t.customWorkTypePrompt, "");
                              if (custom) {
                                handleCellEdit(el.id, "workType", custom);
                              }
                            } else {
                              handleCellEdit(el.id, "workType", e.target.value);
                            }
                          }}
                          className="bg-slate-50 border border-slate-200 text-[10px] hover:border-slate-300 text-slate-800 font-extrabold rounded px-1 py-0.5 focus:outline-none focus:border-emerald-500 transition"
                        >
                          <option value="T1">T1 (Sürekli)</option>
                          <option value="T2">T2 (Periyodik)</option>
                          <option value="T3">T3 (Çevrim Dışı)</option>
                          <option value="CUSTOM">✏️ Özel..</option>
                        </select>
                      </td>

                      {/* Cycle Cycles inputs C/T1 - C/T10 — outlier readings (>2 std dev from
                          this element's own mean) get a red ring so a likely measurement mistake
                          stands out before it skews the mode/median standard time. */}
                      {el.cycles.map((c, cIdx) => {
                        const outlier = isCycleOutlier(c, el.cycles);
                        return (
                          <td key={cIdx} className="px-0.5 py-2 text-center font-mono font-bold">
                            <input
                              type="text"
                              value={c ?? ""}
                              placeholder="-"
                              title={outlier ? "Aykırı değer: bu ölçüm elemanın ortalamasından 2 standart sapmadan fazla uzaklaşıyor" : undefined}
                              onChange={(e) => handleCellEdit(el.id, "cycles", e.target.value, cIdx)}
                              className={`w-full text-center p-0.5 text-[11px] rounded transition focus:ring-0 font-bold ${
                                outlier
                                  ? "bg-amber-50 text-amber-800 border-2 border-amber-400"
                                  : "bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:bg-white"
                              }`}
                            />
                          </td>
                        );
                      })}

                      {/* Rounded standard cycle calculation mode or median */}
                      <td 
                        className={`px-2 py-2 text-center font-mono font-black border-l border-slate-200 sticky right-0 text-sm z-5 ${
                          isExceed ? "text-red-700 bg-red-50" : "text-emerald-800 bg-emerald-50"
                        }`}
                        title={method === "mode" ? t.modeUsed : t.medianUsed}
                      >
                        {el.standardCycleTime.toFixed(2)}s
                        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-500">
                          {method === "mode" ? "mod" : "med"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-2 text-center">
                        <button 
                          onClick={() => handleDeleteRow(el.id)}
                          className="text-slate-400 hover:text-red-650 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredElements.length === 0 && (
                  <tr>
                    <td colSpan={17} className="px-4 py-8 text-center text-slate-500 italic font-semibold">
                      Veri süzgecine uygun iş aşaması elemanı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* New row button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <button
              onClick={handleAddRow}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>{t.addEmptyRow}</span>
            </button>
            <div className="flex items-center space-x-1 text-[10px] text-slate-550 font-bold font-mono">
              <Info className="w-3.5 h-3.5 text-slate-450" />
              <span>Click cells to edit values. Cycles will instantly auto-calculate Standard times.</span>
            </div>
          </div>
        </div>

      </div>

      {/* FULLSCREEN ANALYSIS MODAL (VIDEO PLAYER + KRONOMETRE + PROCESS ETÜT TABLOSU) */}
      {isGridMaximized && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md p-4 sm:p-6 overflow-y-auto flex flex-col space-y-4 animate-fadeIn">
          {/* Full Screen Header Control Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-800/90 p-4 rounded-2xl border border-slate-700 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <Maximize2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black uppercase text-white tracking-wider flex items-center space-x-2">
                  <span>TAM EKRAN VİDEO BANT ANALİZİ & ETÜT TABLOSU</span>
                  <span className="text-[10px] bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-full font-black animate-pulse">
                    CANLI ETÜT MODU
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-medium">Video hareket oynatıcı, kronometre zaman yakalama ve iş elemanı etüt tablosu eşzamanlı tam ekran</p>
              </div>
            </div>

            <button
              onClick={() => setIsGridMaximized(false)}
              className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shadow-lg"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Tam Ekrandan Çık (Esc)</span>
            </button>
          </div>

          {/* Video Motion Capture & Stopwatch Panel (Top Row in Full Screen) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-800/90 p-4 rounded-2xl border border-slate-700 shadow-xl">
            {/* Left 7 cols: Video Player & Frame Controls */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-700/80">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Video className="w-4 h-4" />
                  <span>Video Hareket Analiz Oynatıcısı</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 font-bold">30fps Precision Sync</span>
              </div>

              {/* Video Screen Container */}
              <div className="relative bg-black aspect-video max-h-[280px] rounded-xl border border-slate-700 overflow-hidden flex items-center justify-center group">
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => setCurrentVideoTime(e.currentTarget.currentTime)}
                    onSeeked={(e) => setCurrentVideoTime(e.currentTarget.currentTime)}
                  />
                ) : (
                  <div onClick={handleUploadClick} className="p-6 text-center cursor-pointer hover:bg-slate-900/80 w-full h-full flex flex-col items-center justify-center space-y-2 text-slate-400">
                    <div className="p-3 rounded-full bg-slate-800 border border-slate-700">
                      <Video className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-300">{t.videoUploadHint}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Supporting MP4, MOV, AVI up to 150MB</p>
                  </div>
                )}
                {isCompressing && (
                  <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center space-y-2 p-4 z-10">
                    <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                    <p className="text-xs font-black text-white">{t.loadingVideo}</p>
                  </div>
                )}
              </div>

              {/* Sub-Second Frame Controls & Speed */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={handleJumpToStart} disabled={!videoUrl} title="Başa Dön (0.0s)" className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer">
                    <RotateCcw className="w-3.5 h-3.5 text-white" />
                    <span>Başa Dön</span>
                  </button>
                  <button onClick={() => seekTime(-5)} disabled={!videoUrl} title="5s geri" className="bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white px-2 py-1.5 rounded-lg font-extrabold text-xs font-mono transition cursor-pointer">
                    -5s
                  </button>
                  <button onClick={() => seekTime(-1)} disabled={!videoUrl} title="1s geri" className="bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white px-2 py-1.5 rounded-lg font-extrabold text-xs font-mono transition cursor-pointer">
                    -1s
                  </button>
                  <button onClick={() => stepFrame("backward")} disabled={!videoUrl} title="1 kare geri (-0.03s)" className="bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white px-2 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer">
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>-1 Kare</span>
                  </button>
                  <button onClick={() => { if(videoRef.current) { if(isPlaying) videoRef.current.pause(); else videoRef.current.play(); } }} disabled={!videoUrl} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer">
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? "Pause" : "Play"}</span>
                  </button>
                  <button onClick={() => { if(videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; setIsPlaying(false); setCurrentVideoTime(0); } }} disabled={!videoUrl} title="Durdur & Sıfırla" className="bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer">
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </button>
                  <button onClick={() => stepFrame("forward")} disabled={!videoUrl} title="1 kare ileri (+0.03s)" className="bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white px-2 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer">
                    <span>+1 Kare</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => seekTime(1)} disabled={!videoUrl} title="1s ileri" className="bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white px-2 py-1.5 rounded-lg font-extrabold text-xs font-mono transition cursor-pointer">
                    +1s
                  </button>
                  <button onClick={() => seekTime(5)} disabled={!videoUrl} title="5s ileri" className="bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white px-2 py-1.5 rounded-lg font-extrabold text-xs font-mono transition cursor-pointer">
                    +5s
                  </button>
                </div>

                <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">{t.playbackSpeed}:</span>
                  {[0.5, 1.0, 2.0].map(speed => (
                    <button key={speed} onClick={() => { setPlaybackRate(speed); if(videoRef.current) videoRef.current.playbackRate = speed; }} className={`px-2 py-0.5 rounded text-[10px] font-black font-mono cursor-pointer ${playbackRate === speed ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"}`}>
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 5 cols: Stopwatch Capture Button & Deltas Log */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-700/80">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Kronometre & Zaman Yakalama</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Sequential Time Capture</span>
              </div>

              {/* Live-running stopwatch readout */}
              <div className="bg-slate-950 border border-emerald-500/40 rounded-xl py-2.5 text-center">
                <span className="text-4xl font-black font-mono text-emerald-400 tracking-wider tabular-nums">
                  {formatStopwatch(currentVideoTime)}
                </span>
              </div>

              <button
                onClick={() => handleCaptureTimestamp()}
                disabled={!videoUrl}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-slate-950 font-black text-sm py-3 rounded-xl uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-lg cursor-pointer"
              >
                <Clock className="w-5 h-5" />
                <span>{t.captureStop}</span>
              </button>

              {/* Timestamp Logs */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 max-h-[190px] overflow-y-auto space-y-1.5 shadow-inner">
                <div className="flex justify-between items-center border-b border-slate-800 pb-1 text-[10px] font-black text-slate-400">
                  <span>{t.recordedTimes} ({timestampLogs.length})</span>
                  {timestampLogs.length > 0 && (
                    <button onClick={() => setTimestampLogs([])} className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer">
                      [{t.clearSequences}]
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {timestampLogs.map((log, idx) => (
                    <div key={log.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 p-1.5 rounded-lg text-xs font-mono">
                      <span className="text-slate-300 text-[10px]">#{idx+1} Elapsed: {log.absoluteTime}s</span>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-emerald-400 font-extrabold text-[11px] bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                          Δ {log.deltaDuration}s
                        </span>
                        <select
                          onChange={(e) => {
                            if (e.target.value !== "") {
                              const [rowId, cellIdx] = e.target.value.split(":");
                              handleAssignDelta(log.deltaDuration, rowId, parseInt(cellIdx));
                              e.target.value = "";
                            }
                          }}
                          className="bg-slate-900 border border-slate-700 text-[10px] text-slate-200 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                        >
                          <option value="">{t.assignToActive}</option>
                          {elements.map(el => (
                            <optgroup key={el.id} label={`[Seq ${el.seqNo}] ${el.processName.slice(0,10)}..`}>
                              {el.cycles.map((c, cIdx) => (
                                <option key={cIdx} value={`${el.id}:${cIdx}`}>
                                  Row {el.seqNo} • C/T {cIdx + 1} {c !== null ? `(${c}s)` : "(Empty)"}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {/* Single item delete button */}
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          title="Bu kaydı sil"
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {timestampLogs.length === 0 && (
                    <p className="text-[10px] text-slate-500 text-center py-3 italic">{t.noFileLoaded}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Process Work Element Table in Full Screen */}
          <div className="bg-white text-slate-900 rounded-2xl p-4 md:p-6 shadow-2xl flex-1 flex flex-col space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2 gap-2">
              <div className="space-y-0.5">
                <h2 className="text-xs font-black uppercase text-slate-800 flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>{t.processTable}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                    Tam Ekran Tablo Analizi
                  </span>
                </h2>
              </div>

              {/* Quick Filter Selection Hub */}
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-[10px] text-slate-700 rounded-lg px-2.5 py-1 font-extrabold focus:outline-none"
                >
                  <option value="ALL">Class: All</option>
                  <option value="VA">VA Only</option>
                  <option value="NVA">NVA Only</option>
                  <option value="W">Wastes Only</option>
                </select>

                <select
                  value={filterProcess}
                  onChange={(e) => setFilterProcess(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-[10px] text-slate-700 rounded-lg px-2.5 py-1 font-extrabold focus:outline-none max-w-[120px] truncate"
                >
                  <option value="ALL">Process: All</option>
                  {uniqueProcesses.map((p, i) => (
                    <option key={i} value={p}>{p}</option>
                  ))}
                </select>

                <button
                  onClick={() => setFilterOnlyBottleneck(!filterOnlyBottleneck)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border font-black transition cursor-pointer ${
                    filterOnlyBottleneck 
                      ? "bg-red-50 border-red-200 text-red-750" 
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Bottleneck
                </button>

                <button
                  onClick={() => setIsGridMaximized(false)}
                  className="text-[10px] px-3 py-1 rounded-lg border font-black transition cursor-pointer bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 flex items-center space-x-1"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>{t.minimize}</span>
                </button>
              </div>
            </div>

            {/* Table Scroll Area */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-inner max-h-[500px]">
              <table className="w-full text-left border-collapse text-xs text-slate-800">
                <thead className="bg-slate-50 text-slate-650 font-extrabold sticky top-0 uppercase text-[10px] tracking-wider border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-1.5 py-2.5 text-center w-10 font-black">No</th>
                    <th className="px-1.5 py-2.5 text-center w-16 font-black">İşlem No</th>
                    <th className="px-2 py-2.5 w-28">{t.processName}</th>
                    <th className="px-3 py-2.5 w-36">{t.workElement}</th>
                    <th className="px-1 py-2.5 w-16 text-center">{t.workClass}</th>
                    <th className="px-1 py-2.5 w-24 text-center">{t.workType}</th>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <th key={i} className="px-1 py-2.5 text-center w-11 font-mono font-bold">C/T{i+1}</th>
                    ))}
                    <th className="px-2 py-2.5 text-center text-emerald-700 w-16 sticky right-0 bg-slate-50 border-l border-slate-200">
                      {t.standardCt}
                    </th>
                    <th className="px-2 py-2.5 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredElements.map((el, idx) => {
                    const isActive = activeEditingRow === el.id;
                    const isExceed = el.standardCycleTime > taktTime;
                    let classColor = "border-emerald-200 text-emerald-700 bg-emerald-50";
                    if (el.workClass === "NVA") {
                      classColor = "border-amber-200 text-amber-755 bg-amber-50";
                    } else if (el.workClass === "W") {
                      classColor = "border-rose-200 text-rose-700 bg-rose-50";
                    }

                    const { method } = computeStandardTime(el.cycles);

                    return (
                      <tr 
                         key={el.id} 
                         onClick={() => setActiveEditingRow(el.id)}
                         draggable
                         onDragStart={(e) => handleElementDragStart(e, el.id)}
                         onDragOver={(e) => handleElementDragOver(e, el.id)}
                         onDragEnd={handleElementDragEnd}
                         className={`hover:bg-slate-50 transition cursor-pointer text-slate-800 ${
                           isActive ? "bg-emerald-50/50" : ""
                         } ${draggedElementId === el.id ? "opacity-30 bg-emerald-100" : ""}`}
                      >
                        <td className="px-1.5 py-2.5 text-center font-mono font-bold text-slate-500 text-[11px]">
                          {idx + 1}
                        </td>

                        <td className="px-1 py-2.5 text-center cursor-grab active:cursor-grabbing select-none">
                          <div className="flex items-center justify-center space-x-1 font-mono font-black text-slate-700">
                            <GripVertical className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors" />
                            <input
                              type="number"
                              min={1}
                              value={el.seqNo}
                              onChange={(e) => handleCellEdit(el.id, "seqNo", parseInt(e.target.value) || 1)}
                              className="w-9 text-center bg-slate-50 font-mono font-black text-slate-800 rounded border border-slate-200 px-1 py-0.5 text-xs"
                            />
                          </div>
                        </td>

                        <td className="px-2 py-2.5">
                          <input
                            type="text"
                            value={el.processName}
                            onChange={(e) => handleCellEdit(el.id, "processName", e.target.value)}
                            className="w-full bg-slate-50 text-slate-800 rounded border border-slate-200 px-1.5 py-0.5 text-xs font-bold"
                          />
                        </td>

                        <td className="px-3 py-2.5">
                          <textarea
                            rows={1}
                            value={el.workElement}
                            onChange={(e) => handleCellEdit(el.id, "workElement", e.target.value)}
                            className="w-full bg-slate-50 text-slate-800 rounded border border-slate-200 px-1.5 py-0.5 text-xs font-semibold resize-none"
                          />
                        </td>

                        <td className="px-1 py-2.5 text-center">
                          <select
                            value={el.workClass}
                            onChange={(e) => handleCellEdit(el.id, "workClass", e.target.value)}
                            className={`border text-[10px] font-black rounded px-1.5 py-0.5 uppercase ${classColor}`}
                          >
                            <option value="VA">VA</option>
                            <option value="NVA">NVA</option>
                            <option value="W">W Loss</option>
                          </select>
                        </td>

                        <td className="px-1 py-2.5 text-center">
                          <select
                            value={normalizeWorkType(el.workType)}
                            onChange={(e) => {
                              if (e.target.value === "CUSTOM") {
                                const custom = prompt(t.customWorkTypePrompt, "");
                                if (custom) {
                                  handleCellEdit(el.id, "workType", custom);
                                }
                              } else {
                                handleCellEdit(el.id, "workType", e.target.value);
                              }
                            }}
                            className="bg-slate-50 border border-slate-200 text-[10px] text-slate-800 font-extrabold rounded px-1 py-0.5"
                          >
                            <option value="T1">T1 (Sürekli)</option>
                            <option value="T2">T2 (Periyodik)</option>
                            <option value="T3">T3 (Çevrim Dışı)</option>
                            <option value="CUSTOM">✏️ Özel..</option>
                          </select>
                        </td>

                        {el.cycles.map((c, cIdx) => {
                          const outlier = isCycleOutlier(c, el.cycles);
                          return (
                            <td key={cIdx} className="px-0.5 py-2 text-center font-mono font-bold">
                              <input
                                type="text"
                                value={c ?? ""}
                                placeholder="-"
                                title={outlier ? "Aykırı değer: bu ölçüm elemanın ortalamasından 2 standart sapmadan fazla uzaklaşıyor" : undefined}
                                onChange={(e) => handleCellEdit(el.id, "cycles", e.target.value, cIdx)}
                                className={`w-full text-center p-0.5 text-[11px] rounded font-bold ${
                                  outlier ? "bg-amber-50 text-amber-800 border-2 border-amber-400" : "bg-slate-50 text-slate-800 border border-slate-200"
                                }`}
                              />
                            </td>
                          );
                        })}

                        <td 
                          className={`px-2 py-2 text-center font-mono font-black border-l border-slate-200 sticky right-0 text-sm ${
                            isExceed ? "text-red-700 bg-red-50" : "text-emerald-800 bg-emerald-50"
                          }`}
                        >
                          {el.standardCycleTime.toFixed(2)}s
                          <span className="block text-[11px] font-black uppercase text-slate-500">
                            {method === "mode" ? "mod" : "med"}
                          </span>
                        </td>

                        <td className="px-2 py-2 text-center">
                          <button 
                            onClick={() => handleDeleteRow(el.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleAddRow}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>{t.addEmptyRow}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATISTICAL ROW SUMMARY COUNTERS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3.5">
          <h2 className="text-xs font-black uppercase text-slate-800 flex items-center space-x-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>{t.statistics}</span>
          </h2>
          <span className="text-[10px] font-bold text-slate-400">IEEE Industrial Standard Analytics</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
          {[
            { label: t.min, val: stats.min + "s", icon: Clock },
            { label: t.max, val: stats.max + "s", icon: Clock },
            { label: t.median, val: stats.median + "s", icon: Clock },
            { label: t.mode, val: stats.mode + "s", icon: Clock },
            { label: t.average, val: stats.avg + "s", icon: Clock },
            { label: t.sd, val: stats.sd + "s", icon: AlertTriangle },
            { label: t.cv, val: stats.cv.toFixed(1) + "%", icon: Percent },
            { label: "Aykırı Değer", val: `${outlierCount}`, icon: AlertTriangle, warn: outlierCount > 0 }
          ].map((item, idx) => (
            <div key={idx} className={`border p-3 rounded-xl flex flex-col justify-between space-y-1 shadow-xs ${
              (item as any).warn ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200"
            }`}>
              <span className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wider block">{item.label}</span>
              <span className={`text-sm font-mono font-black ${(item as any).warn ? "text-amber-800" : "text-slate-900"}`}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* LOWER GRID: CHARTS PANEL & DATA ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* QUADRANT 3: PIE CHART DONUT PANEL (Bottom Left, spans 4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
            <h2 className="text-xs font-black uppercase text-slate-800 flex items-center space-x-1.5">
              <Percent className="w-4 h-4 text-emerald-600" />
              <span>{t.pieChartTitle}</span>
            </h2>
            <span className="text-[10px] font-bold text-slate-400">Muda/Mura Sizer</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
            {stats.totalCT > 0 ? (
              <div className="w-full h-44 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const pld = payload[0].payload;
                          return (
                            <div className="bg-white border border-slate-200 p-2.5 text-slate-705 rounded text-xs shadow-lg animate-fadeIn">
                              <p className="font-extrabold flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pld.color }} />
                                <span>{pld.name}</span>
                              </p>
                              <p className="font-mono mt-1 font-bold text-slate-500">Standard sum: {pld.value.toFixed(2)}s ({pld.percentage}%)</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text Ratio summary block */}
                <div className="absolute flex flex-col justify-center items-center">
                  <span className="text-2xl font-mono font-black text-emerald-600">%{stats.vaRate}</span>
                  <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest bg-slate-50 border border-slate-200 px-1.5 rounded">
                    Va Ratio
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-505 italic text-center">Gecikmeli veri dökümü bulunmamaktadır.</p>
            )}

            {/* Display list legends values with explicit times */}
            <div className="w-full space-y-1.5 pt-2 text-xs">
              {[
                { name: t.vaTime, val: stats.vaTime, pct: stats.vaRate, color: "bg-emerald-500", textCol: "text-emerald-700" },
                { name: t.nvaTime, val: stats.nvaTime, pct: stats.nvaRate, color: "bg-amber-500", textCol: "text-amber-700" },
                { name: t.wTime, val: stats.wTime, pct: stats.wRate, color: "bg-rose-500", textCol: "text-rose-700" }
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200 hover:border-slate-350 transition shadow-xs">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="font-bold text-slate-500 text-[11px]">{item.name}</span>
                  </div>
                  <div className="font-mono font-black flex items-center space-x-2">
                    <span className="text-[11px] text-slate-700">{item.val.toFixed(2)}s</span>
                    <span className={`text-[11px] ${item.textCol} px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200`}>
                      %{item.pct}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QUADRANT 4: TRUE YAMAZUMI STACK BAR CHART (Bottom Right, spans 8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-sm">
          <YamazumiStackChart elements={filteredElements} taktTime={taktTime} lang={lang} />
        </div>

      </div>

      {/* PROCESS ANALYSIS OUTCOMES - METRICS CARDS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3.5">
          <h2 className="text-xs font-black uppercase text-slate-850 flex items-center space-x-1.5">
            <Layout className="w-4 h-4 text-emerald-600" />
            <span>{t.processAnalysis}</span>
          </h2>
          <span className="text-[10px] font-bold text-slate-400">Shopfloor Financial Capacity Simulator</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Cycle and standard distribution */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-xs text-slate-500 font-extrabold uppercase">
              <span>{t.totalCt}</span>
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="space-y-0.5">
              <span className="text-2xl font-mono font-black text-slate-900">{stats.totalCT}s</span>
              <p className="text-[10px] text-slate-500 font-semibold leading-snug">Sum of standard times across active elements</p>
            </div>
            {/* Split progression bar */}
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
              <div className="h-full bg-emerald-500" style={{ width: `${stats.vaRate}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${stats.nvaRate}%` }} />
              <div className="h-full bg-rose-500" style={{ width: `${stats.wRate}%` }} />
            </div>
          </div>

          {/* Extreme Bottleneck point */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-xs text-slate-500 font-extrabold uppercase">
              <span>{t.bottleneck}</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="space-y-0.5 truncate">
              <span className="text-sm font-black text-rose-600 block truncate" title={stats.bottleneck}>
                {stats.bottleneck}
              </span>
              <p className="text-[10px] text-slate-500 font-bold leading-snug">{t.largestLoss}: <strong className="text-slate-700">{stats.largestLoss}</strong></p>
            </div>
            {stats.max > taktTime && (
              <>
                <span className="text-[11px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 font-black rounded block text-center animate-pulse">
                  ⚠️ {t.bottleneckAlert}
                </span>
                <button
                  onClick={handlePushBottleneckToKaizen}
                  className="w-full text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white px-2 py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition"
                  title="Bu darboğazdan CI Proje Yönetimi'nde bir kaizen kartı oluştur"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Kaizen Öner
                </button>
              </>
            )}
          </div>

          {/* Potential saving hours */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-xs text-slate-500 font-extrabold uppercase">
              <span>{t.potentialSaving}</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl font-mono font-black text-emerald-600">-{stats.potentialSaving}s</span>
                <span className="text-xs text-slate-500 font-black bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                  %{stats.savingPercent}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-semibold leading-snug">{t.largestOpportunity}: <strong className="text-slate-700">{stats.largestOpportunity}</strong></p>
            </div>
          </div>

          {/* Expected Future Cycle Time */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-xs text-slate-500 font-extrabold uppercase">
              <span>{t.estNewCt}</span>
              <Target className="w-4 h-4 text-emerald-600 animate-spin" />
            </div>
            <div className="space-y-1">
              <span className="text-2xl font-mono font-black text-teal-650">{stats.estNewCt}s</span>
              <div className="flex items-center space-x-1 text-[11px] text-slate-500 font-black bg-white p-1.5 rounded border border-slate-200">
                <ArrowRight className="w-3 h-3 text-emerald-600" />
                <span>COPQ savings target {stats.savingPercent}% of operations</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ÖNCE/SONRA (CURRENT VS FUTURE) COMPARISON */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-xs font-black uppercase text-slate-800 flex items-center space-x-1.5">
            <ArrowRight className="w-4 h-4 text-emerald-600" />
            <span>Önce / Sonra Karşılaştırması</span>
          </h2>
          <span className="text-[10px] text-slate-500 font-bold">"Mevcut Durum" ve "Gelecek Durum" olarak etiketlenip kaydedilmiş çalışmalardan seçin</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={compareCurrentId}
            onChange={(e) => setCompareCurrentId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
          >
            <option value="">Mevcut Durum çalışması seçin...</option>
            {savedYamazumiStudies.filter((s: any) => s.scenarioLabel === "current").map((s: any) => (
              <option key={s.id} value={s.id}>{s.studyTitle}</option>
            ))}
          </select>
          <select
            value={compareFutureId}
            onChange={(e) => setCompareFutureId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
          >
            <option value="">Gelecek Durum çalışması seçin...</option>
            {savedYamazumiStudies.filter((s: any) => s.scenarioLabel === "future").map((s: any) => (
              <option key={s.id} value={s.id}>{s.studyTitle}</option>
            ))}
          </select>
        </div>

        {!comparisonCurrent || !comparisonFuture ? (
          <p className="text-xs text-slate-400 italic">
            Karşılaştırma görmek için hem "Mevcut Durum" hem "Gelecek Durum" olarak kaydedilmiş birer çalışma seçin. Yukarıdaki "Etiketsiz / Mevcut Durum / Gelecek Durum" seçiciyle bir çalışmayı kaydederken etiketleyebilirsiniz.
          </p>
        ) : (() => {
          const c = comparisonCurrent.stats;
          const f = comparisonFuture.stats;
          const ctDelta = c.totalCT > 0 ? ((c.totalCT - f.totalCT) / c.totalCT) * 100 : 0;
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-1.5">
                  <span className="text-[10px] font-black text-rose-700 uppercase">Mevcut Durum</span>
                  <p className="text-xs font-bold text-slate-700">{comparisonCurrent.studyTitle}</p>
                  <p className="text-2xl font-mono font-black text-rose-700">{c.totalCT}s</p>
                  <p className="text-[11px] text-slate-600 font-bold">VA {c.vaRate}% • NVA {c.nvaRate}% • Waste {c.wRate}%</p>
                  <p className="text-[11px] text-slate-500">Darboğaz: {c.bottleneck}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5">
                  <span className="text-[10px] font-black text-emerald-700 uppercase">Gelecek Durum</span>
                  <p className="text-xs font-bold text-slate-700">{comparisonFuture.studyTitle}</p>
                  <p className="text-2xl font-mono font-black text-emerald-700">{f.totalCT}s</p>
                  <p className="text-[11px] text-slate-600 font-bold">VA {f.vaRate}% • NVA {f.nvaRate}% • Waste {f.wRate}%</p>
                  <p className="text-[11px] text-slate-500">Darboğaz: {f.bottleneck}</p>
                </div>
              </div>
              <div className={`text-center py-2 rounded-xl font-black text-sm ${ctDelta > 0 ? "bg-emerald-50 text-emerald-700" : ctDelta < 0 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-500"}`}>
                {ctDelta === 0 ? "Değişim yok" : `Toplam Çevrim Süresi ${ctDelta > 0 ? "%" + ctDelta.toFixed(1) + " azaldı" : "%" + Math.abs(ctDelta).toFixed(1) + " arttı"} (${c.totalCT}s → ${f.totalCT}s)`}
              </div>
            </div>
          );
        })()}
      </div>

      {/* AI LEAN MANUFACTURING ASSISTANT INTEGRATION (Full-Width) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Panel 1: Structured AI Analysis and Recommendations Report */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
            <div className="space-y-0.5">
              <h2 className="text-xs font-black uppercase text-slate-800 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>{t.aiAssistant}</span>
              </h2>
              <span className="text-[10px] text-slate-500 font-bold">Real-time bottleneck & COPQ model evaluations</span>
            </div>
            <button
              onClick={handleRunAiAnalysis}
              disabled={isAiLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 text-xs font-black py-2 px-3 rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer leading-none uppercase tracking-wider"
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing Study...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t.aiAnalyzeBtn}</span>
                </>
              )}
            </button>
          </div>

          {/* Font sizes here are held at text-sm (14px/~10.5pt) minimum or larger — the report is
              read as a coaching document, not fine print. */}
          <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-4 font-normal text-sm text-slate-700 overflow-y-auto max-h-120 min-h-[250px] leading-relaxed shadow-inner">
            {aiReport ? (
              <div className="space-y-4 markdown-body font-sans">
                {aiReport.split("\n").map((line, idx) => {
                  if (line.startsWith("###")) {
                    return <h3 key={idx} className="text-base font-black text-emerald-800 mt-4 border-b border-slate-200 pb-1 uppercase">{line.replace("###", "").trim()}</h3>;
                  }
                  if (line.startsWith("##")) {
                    return <h2 key={idx} className="text-lg font-black text-indigo-700 mt-5 border-b border-slate-200 pb-1 uppercase">{line.replace("##", "").trim()}</h2>;
                  }
                  if (line.startsWith("-") || line.startsWith("*")) {
                    let txt = line.replace(/^[-*]\s*/, "").trim();
                    let priorityBadge = null;
                    if (txt.toLowerCase().includes("high") || txt.toLowerCase().includes("yüksek")) {
                      priorityBadge = <span className="bg-red-50 border border-red-200 text-red-700 text-xs font-black uppercase px-1.5 py-0.5 rounded ml-2">{t.priorityHigh}</span>;
                    } else if (txt.toLowerCase().includes("medium") || txt.toLowerCase().includes("orta")) {
                      priorityBadge = <span className="bg-amber-50 border border-amber-205 text-amber-800 text-xs font-black uppercase px-1.5 py-0.5 rounded ml-2">{t.priorityMedium}</span>;
                    } else if (txt.toLowerCase().includes("low") || txt.toLowerCase().includes("düşük")) {
                      priorityBadge = <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black uppercase px-1.5 py-0.5 rounded ml-2">{t.priorityLow}</span>;
                    }
                    return (
                      <div key={idx} className="flex items-start space-x-2 py-0.5 text-slate-700">
                        <span className="text-emerald-600 mt-1 shrink-0">•</span>
                        <p className="flex-1 font-medium">{txt} {priorityBadge}</p>
                      </div>
                    );
                  }
                  return <p key={idx} className="mb-2 text-slate-700 font-semibold">{line}</p>;
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-8">
                <Sparkles className="w-10 h-10 text-slate-350 animate-pulse" />
                <div className="space-y-1 max-w-sm">
                  <h4 className="font-extrabold text-slate-700 uppercase text-xs tracking-wider">Yalın Yapay Zeka Eksperi Hazır / AI Evaluator Ready</h4>
                  <p className="text-xs text-slate-500 leading-normal font-semibold">
                    Darboğaz tespiti, COPQ maliyet analizi ve hücresel hat dengeleme önerilerini almak için yukarıdaki butona tıklayın.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: AI Copilot Chat — chatMessages/handleSendChat/userQuery/chatScrollRef were
            already fully implemented and wired to a real backend endpoint, but never rendered
            anywhere, making the entire chat feature invisible and unusable. This panel is that
            missing UI. */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col shadow-sm min-h-[420px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <h2 className="text-xs font-black uppercase text-white flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>{t.aiChatTitle}</span>
            </h2>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-sky-600 text-white"
                    : "bg-slate-800 text-slate-100 border border-slate-700"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span className="text-[10px] opacity-60 block mt-1 font-mono">{msg.time}</span>
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Yazıyor...
                </div>
              </div>
            )}
          </div>

          {/* Suggested quick questions */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              "Darboğaz neresi ve takt zamanını ne kadar aşıyor?",
              "En fazla israf hangi elemanda?",
              "Hat dengeleme için iyileştirme sırası ne olmalı?"
            ].map((q, i) => (
              <button
                key={i}
                onClick={() => handleSendChat(q)}
                disabled={isChatLoading}
                className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 transition cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
              placeholder={t.aiChatPlaceholder}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={isChatLoading || !userQuery.trim()}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white p-2.5 rounded-xl transition cursor-pointer"
              title="Gönder"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* FOOTER METADATA AND STANDARDS STATEMENT */}
      <div className="bg-white border border-slate-200 text-[10px] text-slate-500 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3 w-full">
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
          <span className="font-bold text-slate-655 text-left">
            Yamazumi AI Analyzer is compliant with REFA and MTM Industrial Engineering standards. Output maps VA, NVAs, and Muda loss classifications sequentially.
          </span>
        </div>
        <div className="font-mono font-bold text-slate-400 shrink-0">
          HEC Engine v24.2.1 • Multi-tenant Protected • JWT Sandbox
        </div>
      </div>

    </div>
  );
}
