import React, { useMemo, useState, useEffect } from "react";
import { 
  Sparkles, TrendingUp, Cpu, Sliders, CheckCircle2, 
  ArrowRight, Zap, Award, Check, FolderKanban, 
  Calendar, User, CheckSquare, Loader2, Link2, 
  FileText, ChevronRight, Clock, ShieldAlert 
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ActivityItem, SmedProject } from "./smedTypes";

interface ConversionSimulatorTabProps {
  activities: ActivityItem[];
  project?: SmedProject;
  onChangeActivities?: (newActivities: ActivityItem[]) => void;
  customerId?: string;
  machineCostPerHour?: number;
}

export default function ConversionSimulatorTab({
  activities = [],
  project,
  onChangeActivities,
  customerId,
  machineCostPerHour = 4500
}: ConversionSimulatorTabProps) {

  // CI Traceability: for activities already exported to CI Proje Yönetimi (act.ciKaizenId set),
  // fetch the linked kaizen cards so their real current progress stage can be shown here instead
  // of a one-way, fire-and-forget export marker.
  const [linkedKaizens, setLinkedKaizens] = useState<Record<string, { kanbanStatus?: string; status?: string }>>({});

  useEffect(() => {
    const exportedIds = activities.filter((a) => a.ciKaizenId).map((a) => a.ciKaizenId as string);
    if (exportedIds.length === 0) return;
    const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";
    fetch("/api/business/kaizens", {
      headers: {
        "Authorization": `Bearer ${token}`,
        ...(customerId ? { "x-factory-id": customerId } : {})
      }
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          const map: Record<string, { kanbanStatus?: string; status?: string }> = {};
          (res.data as any[]).forEach((k) => { map[k.id] = { kanbanStatus: k.kanbanStatus, status: k.status }; });
          setLinkedKaizens(map);
        }
      })
      .catch((err) => console.error("Failed to load linked kaizen status", err));
  }, [activities, customerId]);

  const kanbanStatusLabel = (status?: string) => {
    if (status === "ACT") return "Standardizasyon";
    if (status === "CHECK") return "Kontrol";
    if (status === "DO") return "Uygulama";
    return "Planlama";
  };

  // 1. Calculations
  const currentSetupTime = useMemo(() => {
    return activities.reduce((sum, a) => sum + a.dur, 0);
  }, [activities]);

  const getEcrsGain = (a: ActivityItem): number => {
    if (!a.ecrsGains) return 0;
    return (a.ecrsGains.E || 0) + (a.ecrsGains.C || 0) + (a.ecrsGains.R || 0) + (a.ecrsGains.S || 0);
  };

  // Current Internal duration and ratio
  const currentInternalDuration = useMemo(() => {
    return activities
      .filter((a) => a.originalType === "internal")
      .reduce((sum, a) => sum + a.dur, 0);
  }, [activities]);

  const currentInternalRatio = useMemo(() => {
    return currentSetupTime > 0 ? Math.round((currentInternalDuration / currentSetupTime) * 100) : 0;
  }, [currentSetupTime, currentInternalDuration]);

  // Current External duration and ratio
  const currentExternalDuration = useMemo(() => {
    return activities
      .filter((a) => a.originalType === "external")
      .reduce((sum, a) => sum + a.dur, 0);
  }, [activities]);

  const currentExternalRatio = useMemo(() => {
    return currentSetupTime > 0 ? Math.round((currentExternalDuration / currentSetupTime) * 100) : 0;
  }, [currentSetupTime, currentExternalDuration]);

  // Phase 1 Gain Target (External activity reduction)
  const phase1Gain = useMemo(() => {
    return activities
      .filter((a) => a.originalType === "external")
      .reduce((sum, a) => sum + getEcrsGain(a), 0);
  }, [activities]);

  const phase1GainPercent = useMemo(() => {
    return currentExternalDuration > 0 ? Math.round((phase1Gain / currentExternalDuration) * 100) : 0;
  }, [currentExternalDuration, phase1Gain]);

  // Converted to External (internal steps now externalized)
  const convertedToExternalTime = useMemo(() => {
    return activities
      .filter((a) => a.originalType === "internal" && a.type === "external")
      .reduce((sum, a) => sum + a.dur, 0);
  }, [activities]);

  // Phase 2 Gain Target (Internal activity reduction: ECRS savings on internal + converted steps)
  const phase2Gain = useMemo(() => {
    const internalEcrsSavings = activities
      .filter((a) => a.originalType === "internal" && a.type === "internal")
      .reduce((sum, a) => sum + getEcrsGain(a), 0);
    return internalEcrsSavings + convertedToExternalTime;
  }, [activities, convertedToExternalTime]);

  const phase2GainPercent = useMemo(() => {
    return currentInternalDuration > 0 ? Math.round((phase2Gain / currentInternalDuration) * 100) : 0;
  }, [currentInternalDuration, phase2Gain]);

  const totalEcrsGain = useMemo(() => {
    return phase1Gain + phase2Gain;
  }, [phase1Gain, phase2Gain]);

  const targetSetupTime = useMemo(() => {
    return Math.max(0, currentSetupTime - totalEcrsGain);
  }, [currentSetupTime, totalEcrsGain]);

  const improvementPercent = useMemo(() => {
    return currentSetupTime > 0 ? Math.round((totalEcrsGain / currentSetupTime) * 100) : 0;
  }, [currentSetupTime, totalEcrsGain]);

  // 2. Tab Navigation
  const [activeTab, setActiveTab] = useState<"phase1" | "phase2">("phase1");

  // 3. AI SMED Coach State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>("");

  // Toast State for UI feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const triggerToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Helper: Prepopulated Smart Action Suggestions
  const getSmartSuggestion = (name: string): string => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("cıvata") || nameLower.includes("vida") || nameLower.includes("sıkma") || nameLower.includes("sökme")) {
      return "U pulları, çeyrek turlu cıvatalar (quick clamp) veya pnömatik soket kullanımı ile sıkmayı hızlandırın.";
    }
    if (nameLower.includes("hortum") || nameLower.includes("bağlantı") || nameLower.includes("rekor")) {
      return "Çoklu Hızlı Bağlantı Paneli (Multi-Coupling Plate) ile bağlantıları tek hamleyle yapın.";
    }
    if (nameLower.includes("forklift") || nameLower.includes("taşıma") || nameLower.includes("getir") || nameLower.includes("götür")) {
      return "Kalıbı makine çalışırken forklift ile sahaya getirip ön ısıtma istasyonunda hazır edin.";
    }
    if (nameLower.includes("temizlik") || nameLower.includes("silme") || nameLower.includes("temizleme")) {
      return "Kalıp koruyucu manyetik kalkanlar ve kuru buz (dry ice) temizlik teknolojisi uygulayın.";
    }
    if (nameLower.includes("ayarlama") || nameLower.includes("ayar") || nameLower.includes("bekleme") || nameLower.includes("ısıtma") || nameLower.includes("sıcaklık")) {
      return "Parametre ayarları ve ön ısıtmayı, dijital kayıtlar ve otomatik zamanlayıcılar ile arka planda yapın.";
    }
    if (nameLower.includes("deneme") || nameLower.includes("ilk parça") || nameLower.includes("ölçüm") || nameLower.includes("doğrulama")) {
      return "'İlk Seferde Doğru' için mekanik sabitleyiciler ve entegre kamera sensörleri kullanın.";
    }
    return `Süreç basitleştirme ve standart iş talimatı revizyonu.`;
  };

  // Handler: Handle Row field changes and sync to parent/localStorage
  const handleRowChange = (id: number, field: string, value: any) => {
    handleRowChangeMulti(id, { [field]: value });
  };

  // Same as handleRowChange but applies several field changes in one pass, avoiding lost updates
  // when two fields need to change together (activities is a prop, so sequential calls would each
  // read the same stale closure and clobber each other's change).
  const handleRowChangeMulti = (id: number, fields: Record<string, any>) => {
    if (!onChangeActivities) return;
    const updated = activities.map((a) => (a.id === id ? { ...a, ...fields } : a));
    onChangeActivities(updated);
  };

  // Export to CI Project Management System
  const handleExportToCI = async (act: ActivityItem) => {
    const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";
    const suggestedAction = act.ecrsAction || getSmartSuggestion(act.name);
    const suggestedResponsible = act.ecrsResponsible || project?.leader || "";
    const suggestedDate = act.ecrsDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
    const gainedDuration = getEcrsGain(act) + (act.originalType === "internal" && act.type === "external" ? act.dur : 0);

    const payload = {
      title: `[SMED] ${act.name} Optimizasyon Çalışması`,
      originator: project?.leader || "SMED Proje Ekibi",
      department: "Üretim / Montaj",
      dateProposed: new Date().toISOString().split("T")[0],
      impactLevel: gainedDuration > 10 ? "High" : gainedDuration > 4 ? "Medium" : "Low",
      estimatedCost: 0, // Gerçek uygulama maliyeti henüz bilinmiyor; CI Proje Yönetimi'nde tamamlanır
      actualSavings: 0,
      status: "Draft",
      kanbanStatus: "PLAN",
      descriptionBefore: `Mevcut Setup Adımı: ${act.name}\nMevcut Süre: ${act.dur} dk\nAktivite Tipi: ${act.originalType === "internal" ? "İç Hazırlık" : "Dış Hazırlık"}`,
      descriptionAfter: `Önerilen Yalın Aksiyon: ${suggestedAction}\nHedeflenen Kazanım: -${gainedDuration} dakika\nDönüşüm Durumu: ${act.type === "external" && act.originalType === "internal" ? "Dış Hazırlığa Dönüştürüldü" : "Süre Kısaltıldı"}`,
      projectLeader: suggestedResponsible,
      plannedFinishDate: suggestedDate,
      // Kazanılan dakikayı saate çevirip modülün gerçek makine saatlik maliyet parametresiyle (Finansal
      // Etki Fizibilitesi sekmesi) çarpıyoruz; sabit ₺4500 ve dakika/saat karışıklığı düzeltildi.
      expectedGain: Math.round((gainedDuration / 60) * machineCostPerHour),
      expectedGainCurrency: "TL",
      problemDefinition: `${act.name} adımı ${act.dur} dakika sürerek makine duruş süresini artırmaktadır.`,
      improvementActions: suggestedAction,
      responsibles: suggestedResponsible,
      factory_id: customerId
    };

    try {
      triggerToast(`"${act.name}" CI Proje Yönetimine aktarılıyor...`, "info");
      const res = await fetch("/api/business/kaizens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          ...(customerId ? { "x-factory-id": customerId } : {})
        },
        body: JSON.stringify(payload)
      }).then((r) => r.json());

      if (res.success) {
        // Mark as exported using dedicated traceability fields (no longer hijacks "opportunity")
        handleRowChangeMulti(act.id, { ciKaizenId: res.data.id, ciExportedAt: new Date().toISOString() });
        window.dispatchEvent(new CustomEvent("gemba:refresh-factory-data"));
        triggerToast(`"${act.name}" başarıyla CI Proje Yönetimi formuna taşındı ve Aksiyon Takip Kartı oluşturuldu!`, "success");
      } else {
        throw new Error(res.error || "Aktarım başarısız oldu.");
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(`Hata: ${err.message || "Proje oluşturulamadı"}`, "error");
    }
  };

  // AI SMED Coach Trigger
  const handleTriggerAICoach = async () => {
    setIsAiLoading(true);
    setAiError(null);
    setAiReport(null);
    setLoadingStep("Shop-floor verileri derleniyor...");

    const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";

    // Simulate clinical analysis pipeline steps for visual satisfaction
    setTimeout(() => setLoadingStep("Hızlı kurulum sektörel standartları (Magnetic plates, quick clampings) taranıyor..."), 1200);
    setTimeout(() => setLoadingStep("Gemini 3.5 Flash modeli ile ECRS yol haritası formüle ediliyor..."), 2400);

    try {
      const res = await fetch("/api/gemini/smed-coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          project: {
            code: project?.code,
            name: project?.name,
            leader: project?.leader,
            machineNo: project?.machineNo,
            moldNo: project?.moldNo,
            productName: project?.productName,
            currentSetupTime,
            targetSetupTime
          },
          activities: activities.map((a) => ({
            sequence: a.sequence,
            name: a.name,
            dur: a.dur,
            type: a.type,
            originalType: a.originalType,
            ecrsSteps: a.ecrsSteps,
            ecrsGains: a.ecrsGains,
            ecrsAction: a.ecrsAction || getSmartSuggestion(a.name),
            ecrsResponsible: a.ecrsResponsible || project?.leader || "",
            ecrsDate: a.ecrsDate,
            ecrsStatus: a.ecrsStatus || "Açık"
          }))
        })
      });

      const data = await res.json();
      if (data.success) {
        setAiReport(data.report);
        triggerToast("AI SMED Koçu analizi başarıyla tamamlandı!", "success");
      } else {
        throw new Error(data.error || "Yapay zeka yanıt üretemedi.");
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "AI servisine bağlanılamadı.");
      triggerToast("AI Analizi başarısız oldu.", "error");
    } finally {
      setIsAiLoading(false);
      setLoadingStep("");
    }
  };

  // Filter activities based on active tab
  const filteredActivities = useMemo(() => {
    if (activeTab === "phase1") {
      return activities.filter((a) => a.originalType === "external");
    } else {
      return activities.filter((a) => a.originalType === "internal");
    }
  }, [activities, activeTab]);

  return (
    <div className="space-y-6">
      
      {/* Dynamic Success/Error Toast notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold animate-toast-in ${
          toastMessage.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : toastMessage.type === "error"
            ? "bg-red-50 border-red-200 text-red-800"
            : "bg-blue-50 border-blue-200 text-blue-800"
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 1. KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Current Setup Duration */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-3 top-3 bg-slate-200/50 p-1.5 rounded-lg text-slate-600">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block">Mevcut Setup Süresi</span>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{currentSetupTime} dk</div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-2 border-t border-slate-100 pt-1.5">Mevcut toplam ölçüm süresi</p>
        </div>

        {/* Card 2: Current Internal Setup duration & ratio */}
        <div className="bg-red-50/60 border border-red-150 rounded-2xl p-4.5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-3 top-3 bg-red-100/50 p-1.5 rounded-lg text-red-600">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-red-700 font-extrabold uppercase tracking-wider block">İç Hazırlık Süre & Oran</span>
            <div className="text-2xl font-black text-red-800 mt-1 font-mono">
              {currentInternalDuration} dk <span className="text-xs font-extrabold text-red-500">%{currentInternalRatio}</span>
            </div>
          </div>
          <p className="text-[10px] text-red-500/80 font-semibold mt-2 border-t border-red-100/40 pt-1.5">Makine dururken yapılanlar</p>
        </div>

        {/* Card 3: Current External Setup duration & ratio */}
        <div className="bg-emerald-50/60 border border-emerald-150 rounded-2xl p-4.5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-3 top-3 bg-emerald-100/50 p-1.5 rounded-lg text-emerald-600">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-emerald-700 font-extrabold uppercase tracking-wider block">Dış Hazırlık Süre & Oran</span>
            <div className="text-2xl font-black text-emerald-800 mt-1 font-mono">
              {currentExternalDuration} dk <span className="text-xs font-extrabold text-emerald-500">%{currentExternalRatio}</span>
            </div>
          </div>
          <p className="text-[10px] text-emerald-600/80 font-semibold mt-2 border-t border-emerald-100/40 pt-1.5">Makine çalışırken yapılanlar</p>
        </div>

        {/* Card 4: Phase 1 Gained Target */}
        <div className="bg-blue-50/60 border border-blue-150 rounded-2xl p-4.5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-3 top-3 bg-blue-100/50 p-1.5 rounded-lg text-blue-600">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-blue-700 font-extrabold uppercase tracking-wider block">Faz 1 Kazanım Hedefi</span>
            <div className="text-2xl font-black text-blue-800 mt-1 font-mono">
              -{phase1Gain} dk <span className="text-xs font-extrabold text-blue-500">%{phase1GainPercent}</span>
            </div>
          </div>
          <p className="text-[10px] text-blue-600/80 font-semibold mt-2 border-t border-blue-100/40 pt-1.5">Dış hazırlık azaltılması ile</p>
        </div>

        {/* Card 5: Phase 2 Gained Target */}
        <div className="bg-purple-50/60 border border-purple-150 rounded-2xl p-4.5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-3 top-3 bg-purple-100/50 p-1.5 rounded-lg text-purple-600">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-purple-700 font-extrabold uppercase tracking-wider block">Faz 2 Kazanım Hedefi</span>
            <div className="text-2xl font-black text-purple-800 mt-1 font-mono">
              -{phase2Gain} dk <span className="text-xs font-extrabold text-purple-500">%{phase2GainPercent}</span>
            </div>
          </div>
          <p className="text-[10px] text-purple-500/80 font-semibold mt-2 border-t border-purple-100/40 pt-1.5">İç hazırlık azaltılması ile</p>
        </div>
      </div>

      {/* 2. Improvement Activity Table (Interactive Section) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        
        {/* Header & Two-Option Selector */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase flex items-center space-x-1.5">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>İyileştirme Faaliyetleri Takip Tablosu</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              ECRS analizlerinden süzülen aksiyonları detaylandırın, terminleyin ve CI Proje Yönetimine taşıyın.
            </p>
          </div>

          {/* Styled two-option toggle switch */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setActiveTab("phase1")}
              className={`px-4 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all duration-200 flex items-center space-x-1.5 ${
                activeTab === "phase1"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Faz 1 İyileştirmeleri (Dış Hazırlık)</span>
            </button>
            <button
              onClick={() => setActiveTab("phase2")}
              className={`px-4 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all duration-200 flex items-center space-x-1.5 ${
                activeTab === "phase2"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Faz 2 İyileştirmeleri (İç Hazırlık)</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        {filteredActivities.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl">
            <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">Bu kategori altında iyileştirilebilecek aktif süreç adımı bulunamadı.</p>
            <p className="text-[10px] text-slate-400">
              Lütfen Zaman Çizelgesi (Gantt) sekmesinden ilgili adımlara ECRS kazançları girerek hedefleri güncelleyin.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-52">Gözlem Adımı / Kategori</th>
                  <th className="py-2.5 px-3">Alt Faaliyet Tanımlaması (İyileştirme Aksiyonu)</th>
                  <th className="py-2.5 px-3 w-44">Sorumlu</th>
                  <th className="py-2.5 px-3 w-28 text-center">Kazanılacak Süre</th>
                  <th className="py-2.5 px-3 w-36">Hedef Tarih</th>
                  <th className="py-2.5 px-3 w-28">Durum</th>
                  <th className="py-2.5 px-3 w-32 text-center">CI Yönetimi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredActivities.map((act, index) => {
                  const gainedMin = getEcrsGain(act) + (act.originalType === "internal" && act.type === "external" ? act.dur : 0);
                  const isExported = !!act.ciKaizenId;

                  return (
                    <tr key={act.id} className="hover:bg-slate-50/55 transition-colors">
                      {/* No */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">{index + 1}</td>
                      
                      {/* Observed Step & Category */}
                      <td className="py-3 px-3 space-y-0.5">
                        <div className="font-bold text-slate-900 truncate max-w-[200px]" title={act.name}>{act.name}</div>
                        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{act.category || "Genel"}</div>
                      </td>

                      {/* Alt Faaliyet Tanımlaması (Interactive Action Field) */}
                      <td className="py-2 px-2">
                        <textarea
                          rows={1}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-1.5 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-800 transition-all placeholder-slate-350 resize-y"
                          placeholder={getSmartSuggestion(act.name)}
                          value={act.ecrsAction || ""}
                          onChange={(e) => handleRowChange(act.id, "ecrsAction", e.target.value)}
                        />
                      </td>

                      {/* Sorumlu (real free-text entry — this factory's actual team roster isn't
                          available as structured data here, so it's typed rather than picked from
                          a fixed fake employee list) */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1.5 focus:ring-blue-500 bg-white text-slate-850 placeholder-slate-350"
                          placeholder="Sorumlu adı girin..."
                          value={act.ecrsResponsible || ""}
                          onChange={(e) => handleRowChange(act.id, "ecrsResponsible", e.target.value)}
                        />
                      </td>

                      {/* Kazanılacak Süre */}
                      <td className="py-3 px-3 text-center">
                        {gainedMin > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                            -{gainedMin} dk
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-200 font-mono">
                            0 dk
                          </span>
                        )}
                      </td>

                      {/* Hedef Termin Tarihi */}
                      <td className="py-2 px-2">
                        <input
                          type="date"
                          className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1.5 focus:ring-blue-500 bg-white text-slate-800"
                          value={act.ecrsDate || ""}
                          onChange={(e) => handleRowChange(act.id, "ecrsDate", e.target.value)}
                        />
                      </td>

                      {/* Durum */}
                      <td className="py-2 px-2">
                        <select
                          className={`w-full px-2 py-1 border rounded-lg text-xs font-black focus:outline-none focus:ring-1.5 focus:ring-blue-500 bg-white ${
                            act.ecrsStatus === "Kapalı"
                              ? "text-emerald-700 border-emerald-200 bg-emerald-50/30"
                              : act.ecrsStatus === "Devam Ediyor"
                              ? "text-amber-700 border-amber-200 bg-amber-50/30"
                              : "text-blue-700 border-blue-200 bg-blue-50/30"
                          }`}
                          value={act.ecrsStatus || "Açık"}
                          onChange={(e) => handleRowChange(act.id, "ecrsStatus", e.target.value)}
                        >
                          <option value="Açık">Açık</option>
                          <option value="Devam Ediyor">Devam Ediyor</option>
                          <option value="Kapalı">Kapalı</option>
                        </select>
                      </td>

                      {/* CI Proje Yönetimine Taşı Action Button */}
                      <td className="py-2 px-2 text-center">
                        {isExported ? (
                          <div className="space-y-1">
                            <button
                              disabled
                              className="inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed w-full"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>CI'a Taşındı</span>
                            </button>
                            {act.ciKaizenId && linkedKaizens[act.ciKaizenId] && (
                              <span className="block text-[9px] font-black text-blue-600 uppercase tracking-wider">
                                {kanbanStatusLabel(linkedKaizens[act.ciKaizenId].kanbanStatus)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleExportToCI(act)}
                            className="inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white hover:bg-slate-850 active:bg-slate-950 border border-slate-800 cursor-pointer shadow-xs transition-all w-full"
                            title="CI Proje Yönetim sayfasına taşıyarak aksiyon kartı oluşturun."
                          >
                            <FolderKanban className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>CI'a Taşı</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. AI SMED Coach Panel with Google Search Grounding */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl text-white space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-yellow-400 uppercase flex items-center space-x-2">
              <Sparkles className="w-4.5 h-4.5 text-yellow-400 animate-pulse shrink-0" />
              <span>AI SMED Koçu (Sektörel Grounding Destekli)</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">
              Kalıp, makine özellikleri ve ECRS adımlarını inceleyerek internet araması destekli profesyonel yalın üretim raporu üretir.
            </p>
          </div>

          <button
            onClick={handleTriggerAICoach}
            disabled={isAiLoading}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black uppercase text-xs rounded-xl tracking-wider shadow-md hover:shadow-lg disabled:opacity-50 flex items-center space-x-2 shrink-0 transition-all cursor-pointer"
          >
            {isAiLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950 shrink-0" />
                <span>Analiz Ediliyor...</span>
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4 text-slate-950 shrink-0" />
                <span>AI SMED Analizi Başlat</span>
              </>
            )}
          </button>
        </div>

        {/* Loading Display */}
        {isAiLoading && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-center">
            <div className="relative w-10 h-10 mx-auto flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
              <Cpu className="w-4 h-4 text-yellow-400 absolute animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-300 font-mono">{loadingStep}</p>
              <p className="text-[10px] text-slate-500">Bu işlem Google Arama servislerini tetiklediği için yaklaşık 10 saniye sürebilir.</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {aiError && (
          <div className="bg-red-900/20 border border-red-900/40 rounded-xl p-4 text-xs font-semibold text-red-400 flex items-start space-x-2">
            <ShieldAlert className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Analiz Hazırlanırken Hata Oluştu</p>
              <p>{aiError}</p>
            </div>
          </div>
        )}

        {/* Generated Report Display */}
        {aiReport && (
          <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-5 md:p-6 space-y-6">
            
            {/* Markdown Viewer */}
            <div className="markdown-body text-slate-300 text-[12.5px] leading-relaxed space-y-4 font-sans select-text">
              <ReactMarkdown>{aiReport}</ReactMarkdown>
            </div>

            {/* Reference Grounding Badge */}
            <div className="pt-4 border-t border-slate-800 flex items-center space-x-2 text-[10px] text-slate-400 font-bold">
              <Link2 className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>Bu rapor, gerçek zamanlı internet araması ve sektörel SMED (Single-Minute Exchange of Die) kütüphaneleri referans alınarak üretilmiştir.</span>
            </div>
          </div>
        )}

        {/* Default Landing Panel when silent */}
        {!aiReport && !isAiLoading && !aiError && (
          <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-6 text-center space-y-3">
            <Cpu className="w-9 h-9 text-slate-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-extrabold text-slate-300">AI SMED Koçu Hazır</p>
              <p className="text-[10px] text-slate-400 max-w-lg mx-auto leading-relaxed">
                "AI SMED Analizi Başlat" butonuna tıklayarak makineniz, kalıbınız ve girdikleriniz üzerinden derinlemesine bir endüstriyel etüt ve aksiyon tavsiyesi raporu alabilirsiniz.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
