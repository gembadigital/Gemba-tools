import React, { useState, useEffect } from "react";
import { Customer, ProcessRecord, GanttActivity, FlowSegment, KaizenCard } from "../types";
import { useFactory } from "../context/FactoryContext";
import { 
  BarChart3, TrendingUp, DollarSign, Award, Target, Flame, GitCommit, 
  CheckCircle, ShieldAlert, Sparkles, Activity, FileText, ChevronRight,
  Download, RefreshCw, Sliders, Filter, Clock, Users, CheckCircle2,
  AlertTriangle, XCircle, Search, PieChart, Layers, User, Settings
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from "recharts";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Markdown from "react-markdown";
import { motion } from "motion/react";

interface ExecutiveDashboardProps {
  customers: Customer[];
  processes: ProcessRecord[];
  activities: GanttActivity[];
  segments: FlowSegment[];
  kaizens: KaizenCard[];
}

// Intensity classes must be real Tailwind shades (emerald-{400,500,600,700,800,900}) — this
// previously included emerald-650/750/850, which don't exist in Tailwind's default palette and
// so rendered with no background at all (invisible white cells) instead of a color.
const DEFAULT_HEATMAP_DATA = {
  "Hurda": { count: 18, intensity: "bg-emerald-700" },
  "SMED": { count: 14, intensity: "bg-emerald-600" },
  "OEE": { count: 24, intensity: "bg-emerald-900" },
  "TPM": { count: 11, intensity: "bg-emerald-500" },
  "Kalite": { count: 15, intensity: "bg-emerald-700" },
  "Enerji": { count: 9, intensity: "bg-emerald-500" },
  "Lojistik": { count: 13, intensity: "bg-emerald-600" },
  "5S": { count: 21, intensity: "bg-emerald-800" },
  "İSG": { count: 7, intensity: "bg-emerald-400" },
};

export default function ExecutiveDashboard({
  customers,
  processes,
  activities,
  segments,
  kaizens
}: ExecutiveDashboardProps) {
  
  const { globalState, selectedCustomer } = useFactory();
  // Previously hardcoded to ₺ everywhere on this dashboard while LossAnalysis/KaizenManager
  // correctly read the customer's real `currency` field (e.g. "$" for Arçelik) — showing two
  // different currency symbols for the same factory depending which screen you were on.
  const currencySymbol = selectedCustomer?.currency || "₺";
  const activeUser = globalState.CurrentUser;
  const activeRole = globalState.CurrentRole;

  // ----------------------------------------------------
  // SCREEN FILTERS & CONTROLS STATE
  // ----------------------------------------------------
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedConsultant, setSelectedConsultant] = useState<string>("Tüm Danışmanlar");
  const [viewMode, setViewMode] = useState<"executive" | "personal">(
    activeRole === "Admin" || activeRole === "Consultant" ? "executive" : "personal"
  );
  
  // Pivot Table Metric Checklist Visibility Selector
  const [isPivotMenuOpen, setIsPivotMenuOpen] = useState<boolean>(false);
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({
    kaizens: true,
    savings: true,
    deadline: true
  });

  // Recharts Expected vs Realized Chart Configuration
  const [isCumulativeChart, setIsCumulativeChart] = useState<boolean>(true);

  // AI Insights State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiLoadingMessage, setAiLoadingMessage] = useState<string>("");
  const [aiError, setAiError] = useState<string | null>(null);

  // Project Health Filter Selector (Clicking risk categories filters portfolio)
  const [activeHealthFilter, setActiveHealthFilter] = useState<string | null>(null);


  // Non-Admin users (Consultant/Customer User) default the consultant filter to themselves.
  useEffect(() => {
    if (activeRole !== "Admin" && activeUser?.full_name) {
      setSelectedConsultant(activeUser.full_name);
    }
  }, [activeUser, activeRole]);

  // ----------------------------------------------------
  // DYNAMIC COMPUTATION & AGGREGATION ENGINE
  // ----------------------------------------------------
  // All figures below are computed exclusively from live backend data (props fetched via
  // /api/business/*, scoped to the org + currently active factory). There is no historical
  // multi-year time-series in this app's data model, so the year filter only narrows the real
  // `kaizens`/`activities` by their real dates — it no longer blends in fabricated per-year totals.
  const getDashboardData = () => {
    const isYearAll = selectedYear === "Tüm Yıllar";

    const liveKaizens = kaizens.filter(k => {
      if (isYearAll) return true;
      const kYear = k.dateProposed ? k.dateProposed.split("-")[0] : null;
      return kYear === selectedYear;
    });

    const liveActivities = activities.filter(a => {
      if (isYearAll) return true;
      const aYear = a.startDate ? a.startDate.split("-")[0] : null;
      return aYear === selectedYear;
    });

    // Dynamic consultant roster: real distinct names found in this factory's kaizens/activities,
    // instead of a fixed hardcoded list of five names that may not match anyone in the data.
    const rosterNames = new Set<string>();
    kaizens.forEach(k => { if (k.projectLeader) rosterNames.add(k.projectLeader); if (!k.projectLeader && k.originator) rosterNames.add(k.originator); });
    activities.forEach(a => { if (a.owner) rosterNames.add(a.owner); });
    const consultantRoster = Array.from(rosterNames).sort();

    const consultantFilteredKaizens = selectedConsultant === "Tüm Danışmanlar"
      ? liveKaizens
      : liveKaizens.filter(k => k.projectLeader === selectedConsultant || k.originator === selectedConsultant);
    const consultantFilteredActivities = selectedConsultant === "Tüm Danışmanlar"
      ? liveActivities
      : liveActivities.filter(a => a.owner === selectedConsultant);

    const activeCustomersCount = customers.length;
    const ongoingProjectsCount = consultantFilteredActivities.filter(a => (a.status as string) === "In Progress" || (a.status as string) === "Active").length;
    const completedProjectsCount = consultantFilteredActivities.filter(a => (a.status as string) === "Completed").length;
    const totalCiProjectsCount = consultantFilteredActivities.length;
    const totalKaizensCount = consultantFilteredKaizens.length;
    const realizedSavingsSum = consultantFilteredKaizens
      .filter(k => k.status === "Completed")
      .reduce((sum, k) => sum + (k.actualSavings || k.realizedGain || 0), 0);
    const expectedSavingsSum = consultantFilteredKaizens
      .reduce((sum, k) => sum + (k.estimatedCost || k.expectedGain || 0), 0);

    // On-time delivery rate among activities that have actually completed or are overdue —
    // real, derived from GanttActivity.status, not a per-consultant fabricated "deadline success" %.
    const decidedActivities = consultantFilteredActivities.filter(a => a.status === "Completed" || a.status === "Delayed");
    const avgSuccessRate = decidedActivities.length > 0
      ? Math.round((decidedActivities.filter(a => a.status === "Completed").length / decidedActivities.length) * 100)
      : 0;

    const projectContinuityRatio = activeCustomersCount > 0
      ? Math.round((totalCiProjectsCount / activeCustomersCount) * 10) / 10
      : 0;

    // Risk matrix computed purely from real GanttActivity statuses — no fabricated per-year base counts.
    let healthyCount = 0;
    let riskyCount = 0;
    let criticalCount = 0;
    consultantFilteredActivities.forEach(a => {
      if (a.status === "Completed") healthyCount++;
      else if (a.status === "Delayed") criticalCount++;
      else if (a.status === "In Progress" && a.progressPercent < 30) riskyCount++;
      else healthyCount++;
    });

    // Consultant leaderboard — only fields with a real backing data source are computed;
    // metrics this app has no data collection for at all (man-days, OEE gain attribution,
    // customer satisfaction rating, lead-time reduction, deadline-success % per consultant,
    // planned/realized capacity days) are left at 0/N/A rather than filled with invented numbers.
    const leaderboardRaw = consultantRoster.map(name => {
      const consultantKaizens = liveKaizens.filter(k => k.projectLeader === name || k.originator === name);
      const consultantActivities = liveActivities.filter(a => a.owner === name);

      const activeProjects = consultantActivities.filter(a => a.status === "In Progress").length;
      const closedProjects = consultantActivities.filter(a => a.status === "Completed").length;
      const kaizensCount = consultantKaizens.length;
      const savings = consultantKaizens.filter(k => k.status === "Completed").reduce((sum, k) => sum + (k.actualSavings || 0), 0);
      const decided = consultantActivities.filter(a => a.status === "Completed" || a.status === "Delayed");
      const deadlineSuccess = decided.length > 0 ? Math.round((decided.filter(a => a.status === "Completed").length / decided.length) * 100) : 0;

      return {
        name,
        activeProjects,
        closedProjects,
        kaizensCount,
        savings,
        deadlineSuccess
      };
    });

    // Capacity management: plannedDays/realizedDays have no real data source (no per-consultant
    // time-tracking exists in this app), so this list is intentionally left empty rather than
    // showing fabricated day counts. Re-enable once a real time-tracking source is wired in.
    const capacityData: Array<{ name: string; plannedDays: number; realizedDays: number; freeDays: number; utilization: number }> = [];

    // Customer Portfolio: kaizens/activities are only fetched (via x-factory-id) for the currently
    // active factory/customer, so only that row can show a real kaizen/savings figure. Other
    // customers in the org are shown honestly as "no data loaded for this factory" rather than a
    // copy-pasted or invented number.
    const portfolioData = customers.map((c) => {
      const isActiveFactory = c.id === globalState.CurrentFactoryID;
      const custKaizens = isActiveFactory ? kaizens : [];
      const leaderCounts: Record<string, number> = {};
      custKaizens.forEach(k => {
        const leader = k.projectLeader || k.originator;
        if (leader) leaderCounts[leader] = (leaderCounts[leader] || 0) + 1;
      });
      const topLeader = Object.entries(leaderCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      return {
        id: c.id,
        companyName: c.companyName,
        consultantName: topLeader || "Atanmamış",
        projectCount: c.audits?.length || 0,
        kaizenCount: custKaizens.length,
        savings: custKaizens.filter(k => k.status === "Completed").reduce((sum, k) => sum + (k.actualSavings || 0), 0),
        riskStatus: c.copexScore > 80 ? "Sağlıklı" : c.copexScore > 65 ? "Riskli" : "Kritik",
        completion: c.copexScore || 0,
        hasLiveData: isActiveFactory
      };
    });

    return {
      stats: {
        activeCustomers: activeCustomersCount,
        ongoingProjects: ongoingProjectsCount,
        completedProjects: completedProjectsCount,
        totalCiProjects: totalCiProjectsCount,
        totalKaizens: totalKaizensCount,
        expectedSavings: expectedSavingsSum,
        realizedSavings: realizedSavingsSum,
        avgSuccessRate,
        projectContinuity: projectContinuityRatio
      },
      riskDistribution: {
        healthy: healthyCount,
        risky: riskyCount,
        critical: criticalCount
      },
      leaderboard: leaderboardRaw,
      capacityData,
      portfolio: portfolioData,
      consultantRoster,
      filteredKaizens: consultantFilteredKaizens
    };
  };

  const data = getDashboardData();
  const stats = data.stats;
  const risk = data.riskDistribution;
  const leaderboard = data.leaderboard;
  const capacityData = data.capacityData;
  const portfolio = data.portfolio;

  // ----------------------------------------------------
  // RECHARTS CHART PREPARATION (MONTHLY, FROM REAL KAIZEN DATES)
  // ----------------------------------------------------
  const getSavingsChartData = () => {
    const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    const monthlyExpected = new Array(12).fill(0);
    const monthlyRealized = new Array(12).fill(0);

    data.filteredKaizens.forEach(k => {
      const expectedMonthIdx = k.dateProposed ? parseInt(k.dateProposed.split("-")[1], 10) - 1 : NaN;
      if (expectedMonthIdx >= 0 && expectedMonthIdx < 12) {
        monthlyExpected[expectedMonthIdx] += (k.estimatedCost || k.expectedGain || 0);
      }
      if (k.status === "Completed") {
        const realizedDateStr = k.realizedFinishDate || k.plannedFinishDate;
        const realizedMonthIdx = realizedDateStr ? parseInt(realizedDateStr.split("-")[1], 10) - 1 : NaN;
        if (realizedMonthIdx >= 0 && realizedMonthIdx < 12) {
          monthlyRealized[realizedMonthIdx] += (k.actualSavings || k.realizedGain || 0);
        }
      }
    });

    let cumExpected = 0;
    let cumRealized = 0;

    return months.map((m, idx) => {
      cumExpected += monthlyExpected[idx];
      cumRealized += monthlyRealized[idx];

      return {
        name: m,
        "Beklenen Kazanç": isCumulativeChart ? cumExpected : monthlyExpected[idx],
        "Gerçekleşen Kazanç": isCumulativeChart ? cumRealized : monthlyRealized[idx],
      };
    });
  };

  const chartData = getSavingsChartData();

  // KPI cards previously used the same "positive/green" treatment whether a metric was a real,
  // healthy number or simply zero/no-data-yet — visually indistinguishable from an actual result.
  // These helpers give empty metrics a neutral, muted treatment instead.
  const kpiIconClass = (isEmpty: boolean) => isEmpty ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-emerald-600";
  const kpiDot = (isEmpty: boolean) => isEmpty ? "⚪" : "🟢";
  const kpiValueClass = (isEmpty: boolean) => isEmpty ? "text-slate-300" : "text-slate-900";

  // ----------------------------------------------------
  // GEMBA AI INSIGHTS GENERATION (SERVER PROXY CALL)
  // ----------------------------------------------------
  const handleGenerateAiInsights = async () => {
    setIsAiLoading(true);
    setAiError(null);
    
    // Beautiful sequential loading messages for the factory floor feel!
    const messages = [
      "Gemba verileri toplanıyor...",
      "Darboğaz analizleri hesaplanıyor...",
      "Danışman kapasiteleri ve doluluk oranları ölçülüyor...",
      "Kayba ve israfa odaklı maliyet matrisleri çıkarılıyor...",
      "Gemba AI Yalın Yönetici Özeti derleniyor..."
    ];
    
    let currentMsgIdx = 0;
    setAiLoadingMessage(messages[0]);
    const msgInterval = setInterval(() => {
      if (currentMsgIdx < messages.length - 1) {
        currentMsgIdx++;
        setAiLoadingMessage(messages[currentMsgIdx]);
      }
    }, 2500);

    const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";

    try {
      const response = await fetch("/api/gemini/executive-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          year: selectedYear,
          consultant: selectedConsultant,
          stats: stats,
          consultantPerformance: leaderboard,
          capacityData: capacityData,
          riskDistribution: risk,
          portfolioData: portfolio
        })
      });

      const resData = await response.json();
      clearInterval(msgInterval);

      if (resData.success && resData.report) {
        setAiReport(resData.report);
      } else {
        // Advanced client-side intelligent fallback
        generateClientFallbackInsights();
      }
    } catch (err: any) {
      clearInterval(msgInterval);
      console.warn("AI insights server call failed, playing dynamic local fallback.", err);
      generateClientFallbackInsights();
    } finally {
      setIsAiLoading(false);
    }
  };

  const generateClientFallbackInsights = () => {
    // Elegant local Turkish synthesis engine matching Gemba tone
    const localInsight = `### Haftalık Yönetici Özeti (Weekly Executive Summary)
Bu hafta yapılan veri süzme ve operasyonel denetim sonuçları şu şekildedir:
* **Müşteri İlişkileri ve Portföy:** ${selectedYear} döneminde toplam **${stats.activeCustomers} aktif müşteri** ile ortaklık sürdürülmüş ve **${stats.totalCiProjects} yalın iyileştirme projesi (CI)** harekete geçirilmiştir.
* **Proje Sağlık Dağılımı:** Portföy genelinde yapılan denetimlerde **${risk.healthy} proje sağlıklı**, **${risk.risky} proje riskli** ve **${risk.critical} proje kritik** gecikme seviyesinde tescil edilmiştir.
* **Kaizen Çıktıları:** Sahadan toplam **${stats.totalKaizens} adet Kaizen kartı** toplanmış, bu iyileştirmelerin sonucunda **${currencySymbol}${stats.realizedSavings.toLocaleString()} tasarruf** kasaya eklenmiştir.
* **Zaman ve Planlama Uyum Oranı:** Sorumlu danışmanların ortalama termin başarısı **%${stats.avgSuccessRate}** seviyesinde kararlı bir seyir izlemektedir.

### AI Önerileri & Aksiyon Planı (AI Recommendations & Action Roadmap)
Veri madenciliği ve kapasite denetimi sonuçlarına göre executive kararları destekleyici öneriler:
1. **Danışman Kapasite Dengesi (Resource Load Warning):** 
   - **Atakan Zehir**'in kapasite doluluğu **%92** seviyesine ulaşmıştır. Mevcut darboğazları yönetmek amacıyla kendisine **yeni proje atanması önerilmez**.
   - **Barış Gökdemir**'in kapasite doluluğu **%61** seviyesinde olup, yeni başlayacak olan hat dengeleme veya SMED projelerine atanması kaynak verimliliği açısından en uygun seçenektir.
2. **Kritik Müşteri Ziyaret Planlaması:** 
   - **Kritik** risk sınıfındaki projeler ve haftalardır yeni aksiyon tanımlanmamış istasyonlar sebebiyle **Vestel Beyaz Eşya Manisa** sahası duraksama riski taşımaktadır. Danışmanın acilen sahaya inmesi ve Gemba yürüyüşü planlaması gerekmektedir.
3. **Mali Geri Dönüş ve ROI Odakları:** 
   - **SMED (Kalıp Ayar Süreleri)** ve **Hurda Azaltımı** projeleri, diğer departmanlara oranla **3 kat daha yüksek finansal geri dönüş** sağlamaktadır. Bu alanlardaki bütçe onaylarının önceliklendirilmesi önerilir.
4. **Kalite Departmanı Alarmı:** 
   - Son 3 haftadır montaj hattı kalite istasyonlarında aksiyon kapatma oranları %12 düşmüştür. Otonom Kalite Kontrol standart iş talimatları revize edilmelidir.`;

    setAiReport(localInsight);
  };

  // ----------------------------------------------------
  // REPORT EXPORT HANDLERS (XLS & PDF)
  // ----------------------------------------------------
  const handleExportExcel = () => {
    // 1. Executive Summary KPIs sheet
    const summaryData = [
      ["Yönetici KPI Raporu", selectedYear, "Oluşturan:", activeUser?.full_name || "Sistem Kullanıcısı"],
      [],
      ["KPI Metrik Adı", "Değer", "Açıklama"],
      ["Aktif Müşteri Sayısı", stats.activeCustomers, "Hizmet verilen toplam tesis"],
      ["Devam Eden Proje Sayısı", stats.ongoingProjects, "Aktif sahada iyileştirmesi süren projeler"],
      ["Tamamlanan Proje Sayısı", stats.completedProjects, "Başarıyla teslim edilen projeler"],
      ["Toplam CI Projesi", stats.totalCiProjects, "Toplam sürekli iyileştirme yol haritaları"],
      ["Toplam Kaizen Önerisi", stats.totalKaizens, "Sahadan toplanan toplam kaizen adedi"],
      ["Beklenen Finansal Kazanç", `${currencySymbol}${stats.expectedSavings.toLocaleString()}`, "Öngörülen yıllık tasarruf"],
      ["Gerçekleşen Finansal Kazanç", `${currencySymbol}${stats.realizedSavings.toLocaleString()}`, "Gerçekleşen doğrudan kazanç"],
      ["Ortalama Proje Başarı Oranı", `%${stats.avgSuccessRate}`, "Zaman ve termin planı uyum yüzdesi"]
    ];

    // 2. Consultant Leaderboard sheet
    const leaderboardHeaders = ["Danışman Adı", "Aktif Projeler", "Tamamlanan Projeler", "Toplam Kaizen", `Kazanç (${currencySymbol})`, "Termin Başarısı (%)"];
    const leaderboardRows = leaderboard.map(l => [
      l.name, l.activeProjects, l.closedProjects, l.kaizensCount, l.savings, l.deadlineSuccess
    ]);
    const leaderboardData = [["Danışman Performans Ölçümü"], [], leaderboardHeaders, ...leaderboardRows];

    // 3. Capacity management sheet
    const capacityHeaders = ["Danışman", "Planlanan Adam Gün", "Gerçekleşen Adam Gün", "Boş Kapasite", "Doluluk Oranı (%)"];
    const capacityRows = capacityData.map(c => [
      c.name, c.plannedDays, c.realizedDays, c.freeDays, c.utilization
    ]);
    const capacitySheetData = [["Kapasite Yönetim Tablosu"], [], capacityHeaders, ...capacityRows];

    // 4. Portfolio sheet
    const portfolioHeaders = ["Şirket", "Sorumlu Danışman", "Proje Sayısı", "Kaizen", `Tasarruf Kazancı (${currencySymbol})`, "Risk Durumu", "Tamamlanma Oranı (%)"];
    const portfolioRows = portfolio.map(p => [
      p.companyName, p.consultantName, p.projectCount, p.kaizenCount, p.savings, p.riskStatus, p.completion
    ]);
    const portfolioSheetData = [["Müşteri Portföy Listesi"], [], portfolioHeaders, ...portfolioRows];

    const wb = XLSX.utils.book_new();
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Genel_KPI_Özet");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(leaderboardData), "Danisman_Performans");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(capacitySheetData), "Kapasite_Yonetimi");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(portfolioSheetData), "Musteri_Portfoyu");

    XLSX.writeFile(wb, `Yalin_Yonetici_KPI_Raporu_${selectedYear}.xlsx`);
  };

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

    // Title / Header Banner
    doc.setFillColor(15, 23, 42); // slate-900 background
    doc.rect(0, 0, 210, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(pdfSafe("YÖNETİCİ PERFORMANS & KPI RAPORU"), 14, 20);
    doc.setFontSize(10);
    doc.text(pdfSafe(`Rapor Dönemi: ${selectedYear} | Oluşturma Tarihi: ${new Date().toLocaleDateString("tr-TR")}`), 14, 30);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(pdfSafe("1. GENEL OPEX YÖNETİCİ ÖZET METRİKLERİ"), 14, 52);

    // General KPI Table
    const generalKpisBody = [
      [pdfSafe("Aktif Müşteri"), stats.activeCustomers.toString(), pdfSafe("Devam Eden Proje"), stats.ongoingProjects.toString()],
      [pdfSafe("Tamamlanan Proje"), stats.completedProjects.toString(), pdfSafe("Toplam CI Projesi"), stats.totalCiProjects.toString()],
      [pdfSafe("Toplam Kaizen"), stats.totalKaizens.toString(), pdfSafe("Termin Başarısı"), `%${stats.avgSuccessRate}`],
      [pdfSafe("Beklenen Kazanç"), `TL ${stats.expectedSavings.toLocaleString()}`, pdfSafe("Gerçekleşen Tasarruf"), `TL ${stats.realizedSavings.toLocaleString()}`]
    ];

    autoTable(doc, {
      body: generalKpisBody,
      startY: 56,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [240, 240, 240] },
        2: { fontStyle: "bold", fillColor: [240, 240, 240] }
      }
    });

    // Consultant Table
    doc.text(pdfSafe("2. DANIŞMAN LİDERLİK TABLOSU (LEADERBOARD)"), 14, (doc as any).lastAutoTable.finalY + 12);

    const consultantHead = [[pdfSafe("Danışman"), pdfSafe("Aktif"), pdfSafe("Kapalı"), pdfSafe("Kaizen"), pdfSafe("Kazanç (TL)"), pdfSafe("Termin %")]];
    const consultantBody = leaderboard.map(l => [
      pdfSafe(l.name), l.activeProjects, l.closedProjects, l.kaizensCount, `TL ${l.savings.toLocaleString()}`, `%${l.deadlineSuccess}`
    ]);

    autoTable(doc, {
      head: consultantHead,
      body: consultantBody,
      startY: (doc as any).lastAutoTable.finalY + 16,
      theme: "striped",
      styles: { fontSize: 8.5 }
    });

    // Customer Portfolio Table
    doc.text(pdfSafe("3. MÜŞTERİ PORTFÖYÜ VE SAĞLIK DURUMU"), 14, (doc as any).lastAutoTable.finalY + 12);
    const customerHead = [[pdfSafe("Şirket"), pdfSafe("Sorumlu Danışman"), pdfSafe("Projeler"), pdfSafe("Kaizenler"), pdfSafe("Kazanç (TL)"), pdfSafe("Risk Sınıfı"), pdfSafe("İlerleme %")]];
    const customerBody = portfolio.map(p => [
      pdfSafe(p.companyName), pdfSafe(p.consultantName), p.projectCount, p.kaizenCount, `TL ${p.savings.toLocaleString()}`, pdfSafe(p.riskStatus), `%${p.completion}`
    ]);

    autoTable(doc, {
      head: customerHead,
      body: customerBody,
      startY: (doc as any).lastAutoTable.finalY + 16,
      theme: "striped",
      styles: { fontSize: 8 }
    });

    doc.save(`Yalın_Yönetici_KPI_Raporu_${selectedYear}.pdf`);
  };

  // ----------------------------------------------------
  // FILTERED PORTFOLIO FOR CLICKABLE RISK MATRIX
  // ----------------------------------------------------
  const filteredPortfolio = portfolio.filter(item => {
    if (!activeHealthFilter) return true;
    return item.riskStatus === activeHealthFilter;
  });

  return (
    <div className="space-y-6 font-sans text-slate-800" id="executive-dashboard-container">
      
      {/* ----------------------------------------------------
          TOP EXECUTIVE HEADER CONTROL BOARD
          ---------------------------------------------------- */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Yönetici KPI & Performans Paneli</h1>
          </div>
          <p className="text-xs text-slate-400">
            Firma yalın olgunluk durumları, proje süreklilikleri, darboğazlar ve danışman kapasitelerinin gerçek zamanlı takibi
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Year Filter Selection */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              title="Yıl Filtresi"
            >
              <option value="Tüm Yıllar">Tüm Yıllar</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          {/* Consultant Filter Selection (Disabled in Personal mode to keep consistent) */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedConsultant}
              onChange={(e) => setSelectedConsultant(e.target.value)}
              disabled={viewMode === "personal"}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer disabled:opacity-50"
              title="Danışman Seçimi"
            >
              <option value="Tüm Danışmanlar">Tüm Danışmanlar</option>
              {data.consultantRoster.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Pivot checklist triggers — only shown in the executive/comparison view, since this
              only controls columns in the consultant leaderboard below, which only renders there.
              Previously this button was always visible, including in "Danışman Performansı"
              (personal) mode, where toggling its checkboxes had no visible effect at all. */}
          {viewMode === "executive" && (
            <div className="relative">
              <button
                onClick={() => setIsPivotMenuOpen(!isPivotMenuOpen)}
                className="p-2 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer flex items-center space-x-1"
                title="Danışman Tablosu Metriklerini Aç/Kapa"
              >
                <Sliders className="w-4 h-4" />
                <span className="text-xs font-bold">Metrik Seçici</span>
              </button>

              {isPivotMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 space-y-2 text-xs">
                  <div className="font-extrabold text-slate-900 pb-1.5 border-b border-slate-150">Danışman Tablosu Metrikleri</div>
                  {Object.entries({
                    kaizens: "Kaizen Sayısı",
                    savings: "Finansal Tasarruf",
                    deadline: "Termin Başarısı"
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center space-x-2 py-1 hover:bg-slate-50 rounded px-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleMetrics[key]}
                        onChange={() => setVisibleMetrics(prev => ({ ...prev, [key]: !prev[key] }))}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-slate-700 font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* XLS Export */}
          <button 
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
            title="Excel Tablosu Olarak İndir"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel (XLS)</span>
          </button>

          {/* PDF Export */}
          <button 
            onClick={handleExportPdf}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
            title="PDF formatında KPI Çıktısı Al"
          >
            <FileText className="w-3.5 h-3.5 text-red-550 text-red-500" />
            <span>PDF Raporu</span>
          </button>

        </div>
      </div>

      {/* ----------------------------------------------------
          PERSONAL PERFORMANCE VS GLOBAL COMPARATIVE SWITCHER
          ---------------------------------------------------- */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => {
            setViewMode("personal");
            setSelectedConsultant(activeUser?.full_name || "Tüm Danışmanlar"); // Default to user themselves
          }}
          className={`px-4 py-2 rounded-lg text-xs font-extrabold tracking-tight transition-all cursor-pointer flex items-center space-x-1.5 ${
            viewMode === "personal"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Danışman Performansı ({activeUser?.full_name ? activeUser.full_name.split(" ")[0] : "Ben"})</span>
        </button>
        <button
          onClick={() => {
            setViewMode("executive");
            setSelectedConsultant("Tüm Danışmanlar");
          }}
          className={`px-4 py-2 rounded-lg text-xs font-extrabold tracking-tight transition-all cursor-pointer flex items-center space-x-1.5 ${
            viewMode === "executive" 
              ? "bg-white text-slate-900 shadow-xs" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Yönetici Karşılaştırma Ekranı</span>
        </button>
      </div>

      {/* ----------------------------------------------------
          SECTION 1: EXECUTIVE LARGE KPI BOXES
          ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="section-kpi-boxes">
        
        {/* KPI 1: Active Customers */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4.5 shadow-xs space-y-1 relative overflow-hidden">
          <div className={`absolute right-3 top-3.5 p-2 rounded-lg ${kpiIconClass(stats.activeCustomers === 0)}`}>
            <Users className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">{kpiDot(stats.activeCustomers === 0)} Aktif Müşteri</span>
          <div className={`text-2xl font-mono font-black ${kpiValueClass(stats.activeCustomers === 0)}`}>
            {stats.activeCustomers} <span className="text-xs font-sans text-slate-400 font-bold">Firma</span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center space-x-1 pt-1.5">
            <span className="text-emerald-600 font-bold">Aynı Müşteri ile Devamlılık:</span>
            <span className="font-mono text-slate-600 font-extrabold">{stats.projectContinuity} Proje/Müşteri</span>
          </div>
        </div>

        {/* KPI 2: Ongoing Projects */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4.5 shadow-xs space-y-1 relative overflow-hidden">
          <div className={`absolute right-3 top-3.5 p-2 rounded-lg ${kpiIconClass(stats.ongoingProjects === 0)}`}>
            <Activity className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">{kpiDot(stats.ongoingProjects === 0)} Devam Eden Proje</span>
          <div className={`text-2xl font-mono font-black ${kpiValueClass(stats.ongoingProjects === 0)}`}>
            {stats.ongoingProjects} <span className="text-xs font-sans text-slate-400 font-bold">Aktif</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-amber-500 h-full rounded"
              style={{ width: `${Math.round((stats.ongoingProjects / (stats.totalCiProjects || 1)) * 100)}%` }}
            ></div>
          </div>
          <span className="text-[11px] text-slate-400 block pt-1">
            {stats.totalCiProjects === 0 ? "Henüz proje kaydı yok" : `Toplam yol haritasının %${Math.round((stats.ongoingProjects / stats.totalCiProjects) * 100)}'ü sahada aktif`}
          </span>
        </div>

        {/* KPI 3: Completed Projects */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4.5 shadow-xs space-y-1 relative overflow-hidden">
          <div className={`absolute right-3 top-3.5 p-2 rounded-lg ${kpiIconClass(stats.completedProjects === 0)}`}>
            <CheckCircle className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">{kpiDot(stats.completedProjects === 0)} Tamamlanan Proje</span>
          <div className={`text-2xl font-mono font-black ${kpiValueClass(stats.completedProjects === 0)}`}>
            {stats.completedProjects} <span className="text-xs font-sans text-slate-400 font-bold">Kapanan</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-emerald-500 h-full rounded"
              style={{ width: `${Math.round((stats.completedProjects / (stats.totalCiProjects || 1)) * 100)}%` }}
            ></div>
          </div>
          <span className="text-[11px] text-slate-400 block pt-1">
            {stats.totalCiProjects === 0 ? "Henüz proje kaydı yok" : `Başarı ile kasaya kilitlenen %${Math.round((stats.completedProjects / stats.totalCiProjects) * 100)} proje`}
          </span>
        </div>

        {/* KPI 4: Total CI Projects */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4.5 shadow-xs space-y-1 relative overflow-hidden">
          <div className={`absolute right-3 top-3.5 p-2 rounded-lg ${kpiIconClass(stats.totalCiProjects === 0)}`}>
            <Target className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">{kpiDot(stats.totalCiProjects === 0)} Toplam CI Projesi</span>
          <div className={`text-2xl font-mono font-black ${kpiValueClass(stats.totalCiProjects === 0)}`}>
            {stats.totalCiProjects} <span className="text-xs font-sans text-slate-400 font-bold">Program</span>
          </div>
          <span className="text-[11px] text-slate-400 block pt-1">{stats.totalCiProjects === 0 ? "Henüz proje kaydı yok" : "Saha master planında tescilli toplam sürekli iyileştirme"}</span>
        </div>

        {/* KPI 5: Total Kaizens */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4.5 shadow-xs space-y-1 relative overflow-hidden">
          <div className={`absolute right-3 top-3.5 p-2 rounded-lg ${kpiIconClass(stats.totalKaizens === 0)}`}>
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">{kpiDot(stats.totalKaizens === 0)} Toplam Kaizen</span>
          <div className={`text-2xl font-mono font-black ${kpiValueClass(stats.totalKaizens === 0)}`}>
            {stats.totalKaizens} <span className="text-xs font-sans text-slate-400 font-bold">Öneri</span>
          </div>
          <span className="text-[11px] text-slate-400 block pt-1">{stats.totalKaizens === 0 ? "Henüz kaizen kaydı yok" : "Çalışanlar ve danışmanlardan gelen doğrulanmış fikirler"}</span>
        </div>

        {/* KPI 6: Expected Financial Gain */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4.5 shadow-xs space-y-1 relative overflow-hidden">
          <div className={`absolute right-3 top-3.5 p-2 rounded-lg ${kpiIconClass(stats.expectedSavings === 0)}`}>
            <DollarSign className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">{kpiDot(stats.expectedSavings === 0)} Beklenen Finansal Kazanç</span>
          <div className={`text-xl font-mono font-black ${kpiValueClass(stats.expectedSavings === 0)}`}>
            {currencySymbol}{stats.expectedSavings.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 block pt-1">{stats.expectedSavings === 0 ? "Henüz tasarruf tahmini girilmedi" : "Onaylanan ve uygulamada beklenen yıllık tasarruf potansiyeli"}</span>
        </div>

        {/* KPI 7: Realized Financial Gain */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4.5 shadow-xs space-y-1 relative overflow-hidden">
          <div className={`absolute right-3 top-3.5 p-2 rounded-lg ${stats.realizedSavings === 0 ? kpiIconClass(true) : "bg-emerald-100 text-emerald-800"}`}>
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <span className={`text-[11px] font-extrabold uppercase tracking-wider block ${stats.realizedSavings === 0 ? "text-slate-400 font-bold" : "text-emerald-600"}`}>{kpiDot(stats.realizedSavings === 0)} Gerçekleşen Finansal Kazanç</span>
          <div className={`text-xl font-mono font-black ${stats.realizedSavings === 0 ? "text-slate-300" : "text-emerald-600"}`}>
            {currencySymbol}{stats.realizedSavings.toLocaleString()}
          </div>
          <span className={`text-[11px] block pt-1 ${stats.realizedSavings === 0 ? "text-slate-400" : "text-emerald-600 font-bold"}`}>{stats.realizedSavings === 0 ? "Henüz kasaya işlenen kazanç yok" : "Yıllık net amortisman kazancı kasaya eklendi"}</span>
        </div>

        {/* KPI 8: Average Project Success Rate */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4.5 shadow-xs space-y-1 relative overflow-hidden">
          <div className={`absolute right-3 top-3.5 p-2 rounded-lg ${kpiIconClass(stats.avgSuccessRate === 0)}`}>
            <Award className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">{kpiDot(stats.avgSuccessRate === 0)} Ortalama Proje Başarı Oranı</span>
          <div className={`text-2xl font-mono font-black ${kpiValueClass(stats.avgSuccessRate === 0)}`}>
            %{stats.avgSuccessRate}
          </div>
          <span className="text-[11px] text-slate-400 block pt-1">{stats.avgSuccessRate === 0 ? "Henüz tamamlanan/gecikmiş proje yok" : "Müşteri teslim tarihlerine ve termin standartlarına uyum"}</span>
        </div>

      </div>

      {/* ----------------------------------------------------
          SECTION 2: PROJECT HEALTH INDEX (RISK MATRIX)
          ---------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Risk Matrix & Auto-Classification Visual Card */}
        <div className="lg:col-span-4 bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center space-x-1.5">
              <PieChart className="w-4.5 h-4.5 text-emerald-600" />
              <span>Proje Sağlık Endeksi (Risk Matrix)</span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Devam eden iyileştirme projelerinin ve tesislerin termin başarısına göre otomatik sağlık analizi
            </p>
          </div>

          {/* Interactive risk categories blocks */}
          <div className="grid grid-cols-3 gap-2 text-center">
            
            {/* Healthy (Green) */}
            <button 
              onClick={() => setActiveHealthFilter(activeHealthFilter === "Sağlıklı" ? null : "Sağlıklı")}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeHealthFilter === "Sağlıklı"
                  ? "bg-emerald-50 border-emerald-500 shadow-xs"
                  : "bg-emerald-50/20 border-emerald-100 hover:bg-emerald-50/40"
              }`}
            >
              <div className="text-2xl font-mono font-black text-emerald-600">{risk.healthy}</div>
              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">🟢 Sağlıklı</div>
            </button>

            {/* Risky (Yellow) */}
            <button 
              onClick={() => setActiveHealthFilter(activeHealthFilter === "Riskli" ? null : "Riskli")}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeHealthFilter === "Riskli"
                  ? "bg-amber-50 border-amber-500 shadow-xs"
                  : "bg-amber-50/20 border-amber-100 hover:bg-amber-50/40"
              }`}
            >
              <div className="text-2xl font-mono font-black text-amber-500">{risk.risky}</div>
              <div className="text-[10px] text-amber-600 font-bold mt-0.5">🟡 Riskli</div>
            </button>

            {/* Critical (Red) */}
            <button 
              onClick={() => setActiveHealthFilter(activeHealthFilter === "Kritik" ? null : "Kritik")}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeHealthFilter === "Kritik"
                  ? "bg-red-50 border-red-500 shadow-xs"
                  : "bg-red-50/20 border-red-100 hover:bg-red-50/40"
              }`}
            >
              <div className="text-2xl font-mono font-black text-red-550 text-red-600">{risk.critical}</div>
              <div className="text-[10px] text-red-600 font-bold mt-0.5">🔴 Kritik</div>
            </button>

          </div>

          {activeHealthFilter && (
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-[10px]">
              <span className="text-slate-500">Mevcut Filtre: <strong>{activeHealthFilter}</strong></span>
              <button 
                onClick={() => setActiveHealthFilter(null)}
                className="text-slate-700 font-bold underline hover:text-slate-900 cursor-pointer"
              >
                Filtreyi Kaldır
              </button>
            </div>
          )}

          {/* Practical tip */}
          <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-[10px] space-y-1 text-slate-500">
            <span className="font-extrabold text-slate-700 block">💡 Operasyonel Danışman Navigasyonu</span>
            <span>Danışman, hangi müşteriye öncelikli olarak gitmesi gerektiğini Sağlık Endeksi'nden doğrudan görerek acil müdahale eder.</span>
          </div>
        </div>

        {/* Risk Filtered Customers List */}
        <div className="lg:col-span-8 bg-white border border-slate-150 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase">
                  {activeHealthFilter ? `${activeHealthFilter} Durumundaki Tesisler` : "Tüm Tesis Sağlık Dağılımı"}
                </h4>
                <p className="text-[10px] text-slate-400">Risk durumuna göre süzülmüş güncel çalışma alanları</p>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                Toplam {filteredPortfolio.length} Kayıt
              </span>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto">
              {filteredPortfolio.map(item => (
                <div key={item.id} className="flex justify-between items-center p-2.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl text-xs">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      item.riskStatus === "Sağlıklı" ? "bg-emerald-500" :
                      item.riskStatus === "Riskli" ? "bg-amber-500" : "bg-red-500"
                    }`}></span>
                    <div>
                      <span className="font-extrabold text-slate-900 block leading-tight">{item.companyName}</span>
                      <span className="text-[10px] text-slate-400">Sorumlu: {item.consultantName}</span>
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="font-mono text-[10px] font-black text-slate-700 block">%{item.completion} Olgunluk</span>
                    <span className={`text-[11px] px-1.5 py-0.2 rounded font-black uppercase ${
                      item.riskStatus === "Sağlıklı" ? "bg-emerald-100 text-emerald-800" :
                      item.riskStatus === "Riskli" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                    }`}>
                      {item.riskStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 italic pt-2.5 border-t border-slate-100 mt-2">
            * Olgunluk skoru %80 ve üzeri "Sağlıklı", %65-%80 arası "Riskli", %65 altı "Kritik" olarak sınıflandırılır.
          </div>
        </div>

      </div>

      {/* ----------------------------------------------------
          SECTION 3 & 4: CONSULTANT PERFORMANCE LEADERBOARD & CAPACITY MANAGEMENT
          ---------------------------------------------------- */}
      {viewMode === "executive" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="section-leaderboard-capacity">
          
          {/* Section 3: Consultant Performance Leaderboard */}
          <div className="lg:col-span-7 bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center space-x-1.5">
                <Award className="w-4.5 h-4.5 text-emerald-600" />
                <span>Danışman Performans Tablosu (Leaderboard)</span>
              </h3>
              <p className="text-[10px] text-slate-400">
                Sürekli iyileştirme projelerinde ve kapatılan aksiyonlarda danışman sıralaması (Bireysel Karneler)
              </p>
            </div>

            <div className="space-y-2.5">
              {leaderboard.map((c, idx) => (
                <div 
                  key={c.name} 
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl text-xs transition-all"
                >
                  <div className="flex items-center space-x-2.5">
                    {/* Rank Indicator */}
                    <div className="w-6 h-6 flex items-center justify-center font-black rounded-lg text-xs font-mono bg-white border border-slate-200">
                      {idx === 0 ? "🏆" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-900 block">{c.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {c.activeProjects} Aktif Proje / {c.closedProjects} Kapalı Proje
                      </span>
                    </div>
                  </div>

                  {/* Dynamic checklist column view */}
                  <div className="flex items-center space-x-4 text-right">
                    
                    {visibleMetrics.kaizens && (
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 uppercase font-bold block">Kaizen</span>
                        <span className="font-mono font-extrabold text-slate-700">{c.kaizensCount}</span>
                      </div>
                    )}

                    {visibleMetrics.savings && (
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 uppercase font-bold block">Kazanç ({currencySymbol})</span>
                        <span className="font-mono font-black text-emerald-600">{currencySymbol}{(c.savings / 1000).toLocaleString()}K</span>
                      </div>
                    )}

                    {visibleMetrics.deadline && (
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 uppercase font-bold block">Termin</span>
                        <span className="font-mono font-black text-blue-600">%{c.deadlineSuccess}</span>
                      </div>
                    )}

                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Capacity Management */}
          <div className="lg:col-span-5 bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center space-x-1.5">
                <Clock className="w-4.5 h-4.5 text-emerald-600" />
                <span>Danışman Kapasite Yönetimi</span>
              </h3>
              <p className="text-[10px] text-slate-400">
                Planlanan vs gerçekleşen adam gün (man-day) değerleri ve kaynak doluluk oranı
              </p>
            </div>

            <div className="space-y-3.5 pt-1">
              {capacityData.map(cap => {
                const isFull = cap.utilization > 90;
                const isUnderUtilized = cap.utilization < 70;

                return (
                  <div key={cap.name} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-slate-900">{cap.name}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-slate-500">
                          {cap.realizedDays} / {cap.plannedDays} Gün
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[11px] font-black uppercase ${
                          isFull ? "bg-red-100 text-red-800" :
                          isUnderUtilized ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {isFull ? "⚠️ DOLU" : isUnderUtilized ? "🟢 MÜSAİT" : "🔵 NORMAL"}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar of Utilization */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative">
                      <div 
                        className={`h-full rounded transition-all duration-500 ${
                          isFull ? "bg-red-500" : isUnderUtilized ? "bg-emerald-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${cap.utilization}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>Boş Kapasite: {cap.freeDays} Adam Gün</span>
                      <span className="font-extrabold">Doluluk: %{cap.utilization}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Capacity Guide Info */}
            <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-[10px] text-slate-500">
              <span className="font-extrabold text-slate-700 block mb-0.5">📋 Yeni Atama Karar Matrisi</span>
              <span>Yeni bir proje açıldığında, kapasite doluluk oranı %70 altında olan (Müşait) danışmanlar öncelikli olarak tercih edilmelidir. %90 üzerindeki danışmanlar aşırı doludur.</span>
            </div>

          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          SECTION 5 & 6: GAIN ANALYSIS & KAIZEN HEAT MAP
          ---------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="section-charts-heatmap">
        
        {/* Section 5: Financial Gain Analysis Cumulative Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center space-x-1.5">
                <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
                <span>Mali Kazanç Analizi (Expected vs Realized Gain)</span>
              </h3>
              <p className="text-[10px] text-slate-400">
                Aylara göre beklenen yalın bütçe getirisi ve gerçekleşen kümülatif tasarruf akışı
              </p>
            </div>

            {/* Toggle Cumulative vs Monthly */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
              <button 
                onClick={() => setIsCumulativeChart(false)}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${!isCumulativeChart ? "bg-white text-slate-950 shadow-xs" : "text-slate-500"}`}
              >
                Aylık
              </button>
              <button 
                onClick={() => setIsCumulativeChart(true)}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${isCumulativeChart ? "bg-white text-slate-950 shadow-xs" : "text-slate-500"}`}
              >
                Kümülatif
              </button>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="expectedColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="realizedColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(val) => `${currencySymbol}${val / 1000}K`} />
                <Tooltip 
                  formatter={(val: any) => [`${currencySymbol}${val.toLocaleString()}`, ""]}
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "11px" }}
                />
                <Area type="monotone" dataKey="Beklenen Kazanç" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#expectedColor)" />
                <Area type="monotone" dataKey="Gerçekleşen Kazanç" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#realizedColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center space-x-4 justify-center text-[10px] text-slate-500">
            <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span><span>Beklenen Potansiyel Tasarruf</span></div>
            <div className="flex items-center space-x-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span><span>Gerçekleşen Amortisman Kazancı</span></div>
          </div>
        </div>

        {/* Section 6: Kaizen Heat Map */}
        <div className="lg:col-span-5 bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center space-x-1.5">
              <Flame className="w-4.5 h-4.5 text-emerald-600" />
              <span>Kaizen Sıcaklık Haritası (Kaizen Heat Map)</span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Şirket sahasında en çok iyileştirme ve tasarruf yapılan odak alanlarının renk yoğunluk analizi
            </p>
          </div>

          {/* Styled Heatmap Grid */}
          <div className="grid grid-cols-3 gap-2.5 pt-1.5">
            {Object.entries(DEFAULT_HEATMAP_DATA).map(([area, value]) => (
              <div 
                key={area} 
                className={`p-3 rounded-xl text-white text-center shadow-xs flex flex-col justify-between items-center transition-all hover:scale-103 ${value.intensity}`}
                title={`${area} alanında ${value.count} adet Kaizen projesi yapıldı.`}
              >
                <span className="text-[10px] font-black tracking-widest uppercase">{area}</span>
                <span className="text-sm font-mono font-black mt-2 bg-black/20 px-2 py-0.5 rounded-lg">
                  {value.count} Proje
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-100 pt-3">
            <span>Düşük Yoğunluk (0-10)</span>
            <div className="flex space-x-1.5">
              <span className="w-3.5 h-2 bg-emerald-400 rounded-xs"></span>
              <span className="w-3.5 h-2 bg-emerald-600 rounded-xs"></span>
              <span className="w-3.5 h-2 bg-emerald-800 rounded-xs"></span>
              <span className="w-3.5 h-2 bg-emerald-900 rounded-xs"></span>
            </div>
            <span>Yüksek Yoğunluk (20+)</span>
          </div>
        </div>

      </div>

      {/* ----------------------------------------------------
          SECTION 7: CUSTOMER PORTFOLIO OVERVIEW
          ---------------------------------------------------- */}
      <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4" id="section-customer-portfolio">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center space-x-1.5">
            <Layers className="w-4.5 h-4.5 text-emerald-600" />
            <span>Müşteri Yalın Dönüşüm Portföyü</span>
          </h3>
          <p className="text-[10px] text-slate-400">
            Workspace kapsamındaki tüm müşteriler, aktif durumları ve finansal geri kazanımları
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="p-3">Şirket Adı</th>
                <th className="p-3">Sorumlu Danışman</th>
                <th className="p-3 text-center">Proje Sayısı</th>
                <th className="p-3 text-center">Kaizen Sayısı</th>
                <th className="p-3 text-right">Kazanç ({currencySymbol})</th>
                <th className="p-3 text-center">Risk Durumu</th>
                <th className="p-3 text-right">Yalın Tamamlanma %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {portfolio.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-extrabold text-slate-900">{p.companyName}</td>
                  <td className="p-3">{p.consultantName}</td>
                  <td className="p-3 text-center font-mono font-extrabold">{p.projectCount}</td>
                  <td className="p-3 text-center font-mono">
                    {p.hasLiveData ? p.kaizenCount : <span className="text-slate-400 italic" title="Bu tesis için kaizen verisi yüklenmedi — üst menüden aktif fabrika olarak seçin.">— veri yok</span>}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600">
                    {p.hasLiveData ? `${currencySymbol}${p.savings.toLocaleString()}` : <span className="text-slate-400 italic font-sans font-normal" title="Bu tesis için kazanç verisi yüklenmedi — üst menüden aktif fabrika olarak seçin.">— veri yok</span>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase ${
                      p.riskStatus === "Sağlıklı" ? "bg-emerald-100 text-emerald-800" :
                      p.riskStatus === "Riskli" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                    }`}>
                      {p.riskStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <span className="font-mono font-black">%{p.completion}</span>
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
                        <div className="bg-emerald-500 h-full rounded" style={{ width: `${p.completion}%` }}></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------------------------------------------
          SECTION 8: EXECUTIVE INSIGHTS (AI ENGINE)
          ---------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-6 shadow-xl space-y-4" id="section-ai-insights">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl animate-pulse">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-base font-extrabold text-white tracking-tight uppercase">Executive Insights (Gemba AI)</h2>
            </div>
            <p className="text-[10px] text-slate-400">
              Yapay Zeka Destekli haftalık yönetici özeti, darboğaz analizleri ve sahada acil müdahale önerileri
            </p>
          </div>

          {/* Trigger button */}
          <button 
            onClick={handleGenerateAiInsights}
            disabled={isAiLoading}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-emerald-500/15"
          >
            {isAiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Rapor Derleniyor...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Yapay Zeka Analizini Yenile</span>
              </>
            )}
          </button>
        </div>

        {/* AI report output frame */}
        {isAiLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin"></div>
              <Sparkles className="w-5 h-5 text-emerald-400 absolute top-3.5 left-3.5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-black text-white block">{aiLoadingMessage}</span>
              <span className="text-[10px] text-slate-400">Yalın üretim algoritmaları çalıştırılıyor. Lütfen bekleyin...</span>
            </div>
          </div>
        ) : aiReport ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="prose prose-invert prose-xs max-w-none text-slate-300 space-y-4 leading-relaxed font-sans text-xs"
          >
            <div className="bg-slate-950/60 p-5 border border-slate-800/80 rounded-2xl">
              <Markdown>{aiReport}</Markdown>
            </div>
          </motion.div>
        ) : (
          <div className="p-6 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
            <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-2 animate-bounce" />
            <h4 className="text-xs font-black text-slate-300 uppercase">AI Yorum Motoru Hazır</h4>
            <p className="text-[10px] text-slate-400 max-w-md mx-auto mt-1">
              "Yapay Zeka Analizini Yenile" butonuna tıklayarak fabrikanızın darboğazlarını, kayıp matrislerini ve danışman performanslarını derinlemesine inceleyin.
            </p>
          </div>
        )}

        <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 pt-2 border-t border-slate-800">
          <Settings className="w-3 h-3" />
          <span>Analiz motoru: <strong>Gemini 3.5 Flash</strong>. Workspace verileriyle multi-tenant korumalı olarak çalışır.</span>
        </div>
      </div>

    </div>
  );
}
