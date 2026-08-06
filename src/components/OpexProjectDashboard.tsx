import React, { useState, useMemo } from "react";
import { 
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { 
  Layers, AlertCircle, Clock, TrendingUp, Award, Users, BookOpen, DollarSign,
  FileSpreadsheet, Printer, RefreshCw, Sparkles, SlidersHorizontal, ArrowUpRight, ArrowDownRight,
  Calendar, Building, Landmark, Percent, Zap, Shield, Check
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { domToCanvas } from "modern-screenshot";
import { Customer, GanttActivity, KaizenCard } from "../types";
import { ProjectRecord, EXCLUDED_STATUSES } from "./PtrTimeStudy";

interface OpexProjectDashboardProps {
  records: ProjectRecord[];
  activities: GanttActivity[];
  kaizens: KaizenCard[];
  selectedCustomer: Customer;
  currentUser: any;
  // Proje Ekibi member names (backend company_workspace, fetched once by the parent) — pre-seeds
  // the team performance chart with registered members who have no PTR records yet.
  projectTeamNames?: string[];
}

// Modern semicircle speedometer gauge (used for Aksiyon Başarı Oranı / Termine Uyum Oranı) —
// gradient progress arc over a flat track, color zone driven by value (red < 40, amber < 70,
// emerald >= 70), tuned for a compact KPI card rather than a full dashboard widget.
function GaugeChart({ value, label, sublabel, size = 168 }: { value: number; label: string; sublabel?: string; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;
  const progressLen = (clamped / 100) * circumference;
  const tone = clamped < 40
    ? { from: "#fb7185", to: "#e11d48", text: "text-rose-600" }
    : clamped < 70
    ? { from: "#fbbf24", to: "#d97706", text: "text-amber-600" }
    : { from: "#34d399", to: "#059669", text: "text-emerald-600" };
  const gid = `gauge-${label.replace(/[^a-zA-Z0-9]/g, "")}`;
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={cy + 4} viewBox={`0 0 ${size} ${cy + 4}`} className="overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={tone.from} />
            <stop offset="100%" stopColor={tone.to} />
          </linearGradient>
        </defs>
        <path d={arcPath} fill="none" stroke="#f1f5f9" strokeWidth="11" strokeLinecap="round" />
        <path
          d={arcPath}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${progressLen} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 2px 5px ${tone.from}70)` }}
        />
      </svg>
      <div className="-mt-2 text-center">
        <span className={`text-[28px] font-black font-mono tracking-tight ${tone.text}`}>%{clamped}</span>
      </div>
      <div className="text-center mt-0.5">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</div>
        {sublabel && <div className="text-[9px] text-slate-400 font-semibold mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

export default function OpexProjectDashboard({
  records,
  activities,
  kaizens,
  selectedCustomer,
  currentUser,
  projectTeamNames = []
}: OpexProjectDashboardProps) {
  // Local active filters state
  const [filterYear, setFilterYear] = useState<string>("ALL");
  const [filterMonth, setFilterMonth] = useState<string>("ALL");
  const [filterDepartment, setFilterDepartment] = useState<string>("ALL");
  const [filterConsultant, setFilterConsultant] = useState<string>("ALL");

  // Real, user-editable investment input for ROI/payback — was a hardcoded ₺85.000/340%/3.5 ay,
  // presented to management as if measured. No investment tracking exists elsewhere in PTR, so
  // this is the consultant's own estimate, kept explicit and editable.
  const [investmentAmount, setInvestmentAmount] = useState<number>(0);

  // The customer is already selected upstream (customer card) — this dashboard always reflects
  // that selection's own records/kaizens, no in-dashboard customer switcher.
  const currentRecords = records;
  const currentKaizens = kaizens;

  // Extract unique filter dimensions based on the records
  const filterOptions = useMemo(() => {
    const years = Array.from(new Set(currentRecords.map(r => r.year.toString()))).filter(Boolean).sort();

    const departments = Array.from(new Set([
      ...currentRecords.map(r => r.activitySubject?.trim()),
      ...currentKaizens.map(k => k.department?.trim())
    ])).filter(Boolean).sort();

    // Single "Sorumlu Lider" filter — covers the responsible/leader name across records, master
    // plan activities, and kaizen cards (previously split into two dropdowns filtering the same
    // underlying person field).
    const consultants = Array.from(new Set([
      ...activities.map(a => a.owner?.trim()),
      ...currentRecords.map(r => r.responsible?.trim()),
      ...currentKaizens.map(k => k.projectLeader?.trim()),
      ...currentKaizens.map(k => k.originator?.trim())
    ])).filter(Boolean).sort();

    return { years, departments, consultants };
  }, [currentRecords, currentKaizens, activities]);

  // Months name helper
  const monthsList = [
    { value: "01", label: "Ocak" },
    { value: "02", label: "Şubat" },
    { value: "03", label: "Mart" },
    { value: "04", label: "Nisan" },
    { value: "05", label: "Mayıs" },
    { value: "06", label: "Haziran" },
    { value: "07", label: "Temmuz" },
    { value: "08", label: "Ağustos" },
    { value: "09", label: "Eylül" },
    { value: "10", label: "Ekim" },
    { value: "11", label: "Kasım" },
    { value: "12", label: "Aralık" }
  ];

  // Apply filters dynamically across all data sets
  const filteredData = useMemo(() => {
    // 1. Filter Project Records
    const recordsFiltered = currentRecords.filter(r => {
      // Year Filter
      const matchesYear = filterYear === "ALL" ? true : r.year.toString() === filterYear;
      
      // Month Filter
      let matchesMonth = true;
      if (filterMonth !== "ALL" && r.workDate) {
        const parts = r.workDate.split(".");
        if (parts.length === 3) {
          matchesMonth = parts[1] === filterMonth;
        } else {
          matchesMonth = false;
        }
      }

      // Department Filter
      const matchesDept = filterDepartment === "ALL" ? true : r.activitySubject === filterDepartment;

      // Sorumlu Lider Filter
      const matchesConsultant = filterConsultant === "ALL" ? true : r.responsible === filterConsultant;

      return matchesYear && matchesMonth && matchesDept && matchesConsultant;
    });

    // 2. Filter Kaizens
    const kaizensFiltered = currentKaizens.filter(k => {
      const matchesYear = filterYear === "ALL" ? true : (k.dateProposed && k.dateProposed.includes(filterYear));

      let matchesMonth = true;
      if (filterMonth !== "ALL" && k.dateProposed) {
        matchesMonth = k.dateProposed.includes(`-${filterMonth}-`) || k.dateProposed.includes(`.${filterMonth}.`);
      }

      const matchesDept = filterDepartment === "ALL" ? true : k.department === filterDepartment;
      const matchesConsultant = filterConsultant === "ALL" ? true : k.originator === filterConsultant || k.projectLeader === filterConsultant;

      return matchesYear && matchesMonth && matchesDept && matchesConsultant;
    });

    // 3. Filter Master Plan (Activities)
    const activitiesFiltered = activities.filter(a => {
      const matchesConsultant = filterConsultant === "ALL" ? true : a.owner === filterConsultant;
      return matchesConsultant;
    });

    return {
      records: recordsFiltered,
      kaizens: kaizensFiltered,
      activities: activitiesFiltered
    };
  }, [currentRecords, currentKaizens, activities, filterYear, filterMonth, filterDepartment, filterConsultant]);

  // Currency selection helper
  const currencySymbol = selectedCustomer?.currency || "₺";

  // Section 1 - Executive KPI Calculations
  const metrics = useMemo(() => {
    const totalActions = filteredData.records.length;
    const completedActions = filteredData.records.filter(r => r.status === "Kapalı").length;
    const cancelledActions = filteredData.records.filter(r => EXCLUDED_STATUSES.includes(r.status)).length;
    const openActions = filteredData.records.filter(r => r.status !== "Kapalı" && !EXCLUDED_STATUSES.includes(r.status)).length;

    // İptal edilen veya yapılmayan aksiyonlar ilerleme yüzdesine dahil edilmez.
    const progressEligibleActions = totalActions - cancelledActions;
    const actionPerformance = progressEligibleActions > 0 ? Math.round((completedActions / progressEligibleActions) * 100) : 0;
    
    const completedOnTime = filteredData.records.filter(r => r.status === "Kapalı" && r.compliance === "ZAMANINDA").length;
    const dueDateCompliance = completedActions > 0 ? Math.round((completedOnTime / completedActions) * 100) : null;

    // Consultant Man-Days calculations — real Master Plan data only, no fabricated fallbacks.
    // plannedManDays default of 5 matches MasterPlanGantt.tsx's own default (was inconsistently 8 here).
    const totalPlannedManDays = filteredData.activities.reduce((sum, a) => sum + ((a as any).plannedManDays || 5), 0);
    const totalCompletedManDays = filteredData.activities.reduce((sum, a) => sum + ((a as any).consumedManDays || 0), 0);
    const projectProgress = totalPlannedManDays > 0 ? Math.min(100, Math.round((totalCompletedManDays / totalPlannedManDays) * 100)) : null;

    // Toplam Ziyaret Sayısı: distinct visit dates logged in PTR, independent of Master Plan
    // activity matching — this is the real "adam gün" the consultant physically spent on site.
    const totalVisitDays = new Set(filteredData.records.map(r => r.workDate).filter(Boolean)).size;

    // CI Kaizen calculations
    const totalKaizens = filteredData.kaizens.length;
    
    // Verified Kaizen Savings
    const verifiedKaizenSavings = filteredData.records
      .filter(r => r.status === "Kapalı")
      .reduce((sum, r) => {
        const val = parseFloat((r.kaizenSavings || r.savingsAmount || "0").toString().replace(/[^0-9.-]+/g, ""));
        return sum + (isNaN(val) ? 0 : val);
      }, 0) + filteredData.kaizens
      .filter(k => k.status === "Completed")
      .reduce((sum, k) => sum + (k.actualSavings || 0), 0);

    // Expected Savings — only real recorded amounts; no fabricated ₺15.000 substitute for records
    // without a savings figure, and real kaizen expectedGain instead of estimatedCost*2.5.
    const expectedSavings = filteredData.records
      .reduce((sum, r) => {
        const val = parseFloat((r.savingsAmount || "0").toString().replace(/[^0-9.-]+/g, ""));
        return sum + (isNaN(val) ? 0 : val);
      }, 0) + filteredData.kaizens
      .reduce((sum, k) => sum + (k.expectedGain || 0), 0);

    // Real training session count — no fabricated duration/attendance multipliers
    // (ProjectRecord doesn't track real session hours or participant counts).
    const trainingRecords = filteredData.records.filter(r => r.activitySubject === "EĞİTİM");
    const trainingSessions = trainingRecords.length;

    // Toplam Adam-Saat Eğitim: consultant writes attendee count into the "Çıktı" field for a
    // training record; 1 session = 8 hours/person. Records without a numeric output contribute 0.
    const totalTrainingManHours = trainingRecords.reduce((sum, r) => {
      const attendees = parseInt((r.output || "").toString().replace(/[^0-9]/g, ""), 10);
      return sum + (isNaN(attendees) ? 0 : attendees * 8);
    }, 0);

    return {
      totalActions,
      completedActions,
      openActions,
      cancelledActions,
      progressEligibleActions,
      actionPerformance,
      dueDateCompliance,
      completedOnTime,
      totalPlannedManDays,
      totalCompletedManDays,
      projectProgress,
      totalVisitDays,
      totalKaizens,
      verifiedKaizenSavings,
      expectedSavings,
      trainingSessions,
      totalTrainingManHours
    };
  }, [filteredData]);

  // Section 2 & 4 & 5 & 6 & 7 Charts Data Preparation

  // 1. Action Status Distribution Data
  const actionStatusData = useMemo(() => {
    const openCount = filteredData.records.filter(r => r.status === "Açık").length;
    const inProgressCount = filteredData.records.filter(r => r.status === "Devam Ediyor").length;
    const completedCount = filteredData.records.filter(r => r.status === "Kapalı").length;
    const cancelledCount = filteredData.records.filter(r => EXCLUDED_STATUSES.includes(r.status)).length;
    return [
      { name: "Açık (Başlanmadı)", value: openCount, color: "#ef4444" },
      { name: "Devam Ediyor", value: inProgressCount, color: "#f97316" },
      { name: "Kapalı (Tamamlandı)", value: completedCount, color: "#10b981" },
      { name: "İptal", value: cancelledCount, color: "#94a3b8" }
    ].filter(d => d.value > 0);
  }, [filteredData.records]);

  // 2. Value Creation Timeline (Cumulative savings by week)
  const valueCreationData = useMemo(() => {
    const weekMap: { [key: string]: number } = {};
    
    filteredData.records.forEach(r => {
      const weekStr = r.visitedWeek || "Hafta 1";
      const val = parseFloat((r.kaizenSavings || r.savingsAmount || "0").toString().replace(/[^0-9.-]+/g, ""));
      const parsedVal = isNaN(val) ? 0 : val;
      
      weekMap[weekStr] = (weekMap[weekStr] || 0) + parsedVal;
    });

    // Sort weeks numerically
    const sortedWeeks = Object.keys(weekMap).sort((a, b) => {
      const numA = parseInt(a.replace(/[^\d]/g, "")) || 0;
      const numB = parseInt(b.replace(/[^\d]/g, "")) || 0;
      return numA - numB;
    });

    let cumulativeSum = 0;
    return sortedWeeks.map(wk => {
      cumulativeSum += weekMap[wk];
      return {
        week: wk,
        "Birikimli Değer (₺)": cumulativeSum,
        "Haftalık Kazanç": weekMap[wk]
      };
    });
  }, [filteredData.records]);

  // 3. Team Action Performance (Open / In Progress / Completed by responsible person)
  const teamPerformanceData = useMemo(() => {
    const respMap: { [key: string]: { open: number; inProgress: number; completed: number } } = {};

    // Pre-populate with registered Project Team members (passed down from PtrTimeStudy.tsx,
    // fetched from the backend company_workspace)
    projectTeamNames.forEach(name => {
      respMap[name] = { open: 0, inProgress: 0, completed: 0 };
    });

    filteredData.records.forEach(r => {
      const name = r.responsible || "Atanmamış";
      if (!respMap[name]) {
        respMap[name] = { open: 0, inProgress: 0, completed: 0 };
      }
      if (r.status === "Kapalı") {
        respMap[name].completed++;
      } else if (r.status === "Devam Ediyor") {
        respMap[name].inProgress++;
      } else {
        respMap[name].open++;
      }
    });

    return Object.keys(respMap).map(name => ({
      name,
      "Açık": respMap[name].open,
      "Devam Ediyor": respMap[name].inProgress,
      "Kapalı": respMap[name].completed
    })).sort((a, b) => (b["Kapalı"] + b["Devam Ediyor"]) - (a["Kapalı"] + a["Devam Ediyor"]));
  }, [filteredData.records, projectTeamNames]);

  // 4. Team Due Date Compliance % Ranking
  const teamComplianceData = useMemo(() => {
    const respMap: { [key: string]: { totalClosed: number; onTime: number } } = {};
    
    filteredData.records.filter(r => r.status === "Kapalı").forEach(r => {
      const name = r.responsible || "Atanmamış";
      if (!respMap[name]) {
        respMap[name] = { totalClosed: 0, onTime: 0 };
      }
      respMap[name].totalClosed++;
      if (r.compliance === "ZAMANINDA") {
        respMap[name].onTime++;
      }
    });

    return Object.keys(respMap).map(name => {
      const pct = respMap[name].totalClosed > 0 
        ? Math.round((respMap[name].onTime / respMap[name].totalClosed) * 100) 
        : 100;
      return { name, "Termin Sadakati %": pct };
    }).sort((a, b) => b["Termin Sadakati %"] - a["Termin Sadakati %"]);
  }, [filteredData.records]);

  // 5. Improvement Distribution Data
  const improvementDistributionData = useMemo(() => {
    const catMap: { [key: string]: number } = {};
    
    filteredData.records.forEach(r => {
      const cat = r.activitySubject || "Diğer";
      catMap[cat] = (catMap[cat] || 0) + 1;
    });

    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#6b7280"];
    return Object.keys(catMap).map((name, idx) => ({
      name,
      value: catMap[name],
      color: colors[idx % colors.length]
    })).sort((a, b) => b.value - a.value);
  }, [filteredData.records]);

  // 6. Training Topics — real session counts per topic, plus man-hours where the consultant has
  // recorded attendee count in the "Çıktı" (output) field for that EĞİTİM record (1 session = 8
  // hours/person). Records without a numeric output simply don't contribute man-hours yet.
  const trainingTopicData = useMemo(() => {
    const topicMap: { [key: string]: { sessions: number; manHours: number } } = {};
    filteredData.records.filter(r => r.activitySubject === "EĞİTİM").forEach(r => {
      const topic = r.improvementSubject || "Genel Yalın Üretim";
      if (!topicMap[topic]) topicMap[topic] = { sessions: 0, manHours: 0 };
      topicMap[topic].sessions += 1;
      const attendees = parseInt((r.output || "").toString().replace(/[^0-9]/g, ""), 10);
      if (!isNaN(attendees)) topicMap[topic].manHours += attendees * 8;
    });
    return Object.keys(topicMap).map(name => ({
      name,
      "Eğitim Seans Sayısı": topicMap[name].sessions,
      "Adam-Saat Eğitim": topicMap[name].manHours
    })).sort((a, b) => b["Eğitim Seans Sayısı"] - a["Eğitim Seans Sayısı"]);
  }, [filteredData.records]);

  // Excel Exporter
  const handleExportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const customerName = selectedCustomer?.companyName || "OPEX Tesis";
    const projectName = (selectedCustomer as any)?.projectName || "Yalın Dönüşüm";
    const consultantName = currentUser?.full_name || "OPEX Danışmanı";

    // 1. Executive Dashboard Tab
    const dashboardRows = [
      ["EXECUTIVE PROJECT DASHBOARD - REPORT CARD"],
      ["MÜŞTERİ / FABRİKA", customerName, "PROJE ADI", projectName],
      ["YALIN DANIŞMAN", consultantName, "OLUŞTURMA TARİHİ", new Date().toLocaleDateString("tr-TR")],
      [],
      ["TEMEL PROJE PERFORMANS GÖSTERGELERİ (KPI SUMMARY)"],
      ["Gösterge Adı", "Formül / Hedef", "Filtrelenmiş Sonuç", "Performans Oranı"],
      ["Proje İlerleme Seviyesi", "Kapanan Man-Day / Toplam Planlanan", `${metrics.totalCompletedManDays} / ${metrics.totalPlannedManDays} Adam-Gün`, metrics.projectProgress !== null ? `%${metrics.projectProgress}` : "Veri yok"],
      ["Sahada Kayıtlı Ziyaret Sayısı", "Farklı Ziyaret Tarihi Sayısı", `${metrics.totalVisitDays} Gün`, "-"],
      ["Toplam Aksiyon Sıklığı", "Atanan saha görev havuzu", `${metrics.totalActions} Adet`, "-"],
      ["Tamamlanan Aksiyon Oranı", "Kapalı Aksiyonlar / Toplam", `${metrics.completedActions} Adet`, `%${metrics.actionPerformance}`],
      ["Termin Sadakat Başarısı", "Süresinde Kapatılan / Kapatılanlar", `${metrics.completedOnTime} Adet`, metrics.dueDateCompliance !== null ? `%${metrics.dueDateCompliance}` : "Veri yok"],
      ["Sürekli İyileştirme Kaizen Sayısı", "Kanban Panosu Kart Havuzu", `${metrics.totalKaizens} Proje`, "-"],
      ["Doğrulanmış Kaizen Finansal Tasarrufu", "Doğrulanmış Yıllık Kazanç", `₺${metrics.verifiedKaizenSavings.toLocaleString("tr-TR")}`, "-"],
      ["Toplam Eğitim Seansı", "Saha Eğitim Faaliyeti Kaydı", `${metrics.trainingSessions} Seans`, "-"]
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(dashboardRows);
    ws1["!cols"] = [{ wch: 30 }, { wch: 30 }, { wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Executive Dashboard");

    // 2. Project Activity Log Tab
    const logHeader = ["Hafta", "Çalışma Tarihi", "Faaliyet Konusu", "İyileştirme Konusu", "Yapılan Çalışmalar / Alınan Kararlar", "Çıktı / Standart", "Sorumlu Mühendis", "Durum", "Termin Tarihi", "Uyum Sınıfı", "Notlar", "Finansal Tasarruf (₺)"];
    const logRows = [
      ["PROJE SAHA TAKİP KÜTÜĞÜ - FAALİYET LOGU"],
      [`Müşteri: ${customerName} | Rapor Dönemi: ${filterYear} - ${filterMonth}`],
      [],
      logHeader,
      ...filteredData.records.map(r => [
        r.visitedWeek, r.workDate, r.activitySubject, r.improvementSubject, r.workDone, r.output, r.responsible, r.status, r.dueDate, r.compliance, r.notes, r.kaizenSavings || r.savingsAmount || "0"
      ])
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(logRows);
    ws2["!cols"] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 45 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Project Activity Log");

    // 3. Action List (Açık ve Devam Edenler)
    const actionHeader = ["Sıra", "Hafta", "Faaliyet Konusu", "İyileştirme Konusu", "Saha Aksiyonu", "Sorumlu", "Takip Durumu", "Termin"];
    const actionRows = [
      ["DANIŞMANLIK SAHA TAKİP RAPORU - AÇIK AKSİYON LİSTESİ"],
      [`Müşteri: ${customerName} | Termin Takibi ve Geciken İş Adımları`],
      [],
      actionHeader,
      ...filteredData.records.filter(r => r.status !== "Kapalı").map((r, idx) => [
        idx + 1, r.visitedWeek, r.activitySubject, r.improvementSubject, r.workDone, r.responsible, r.status, r.dueDate
      ])
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(actionRows);
    ws3["!cols"] = [{ wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 45 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Action List");

    // 4. CI Project Summary Tab
    const ciHeader = ["Proje Adı", "Sorumlu Lider", "Mevcut Aşama / Durum", "Tamamlanma Oranı", "Planlanan Bitiş", "Doğrulanmış Tasarruf (₺)"];
    const ciRows = [
      ["SÜREKLİ İYİLEŞTİRME KAIZEN VE CI PROJELERİ RAPORU"],
      [],
      ciHeader,
      ...filteredData.kaizens.map(k => [
        k.title, k.projectLeader || k.originator, k.status, k.status === "Completed" ? "100%" : "50%", k.plannedFinishDate || "-", k.actualSavings || "0"
      ])
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(ciRows);
    ws4["!cols"] = [{ wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws4, "CI Project Summary");

    // 5. Financial Summary Tab
    const finRows = [
      ["FİNANSAL DEĞER OLUŞTURMA VE KAZANÇ ANALİZİ"],
      [],
      ["Finansal Gösterge", "Yıllık Öngörülen Kazanç", "Doğrulanmış Kazanç", "Tahmini Yatırım", "ROI Oranı", "Yatırım Geri Dönüşü"],
      [
        "Kaizen Finansal Havuzu",
        `₺${metrics.expectedSavings.toLocaleString()}`,
        `₺${metrics.verifiedKaizenSavings.toLocaleString()}`,
        investmentAmount > 0 ? `₺${investmentAmount.toLocaleString()}` : "Girilmedi",
        investmentAmount > 0 ? `%${Math.round(((metrics.verifiedKaizenSavings - investmentAmount) / investmentAmount) * 100)}` : "Veri yok",
        investmentAmount > 0 && metrics.verifiedKaizenSavings > 0 ? `${((investmentAmount / metrics.verifiedKaizenSavings) * 12).toFixed(1)} Ay` : "Veri yok"
      ],
      [],
      ["HAFTALIK DEĞER ÜRETİMİ VE BİRİKİMLİ KAZANÇ GRAFİĞİ"],
      ["Hafta No", "Haftalık Kazanç (₺)", "Birikimli Toplam Değer (₺)"],
      ...valueCreationData.map(v => [v.week, v["Haftalık Kazanç"], v["Birikimli Değer (₺)"]])
    ];
    const ws5 = XLSX.utils.aoa_to_sheet(finRows);
    ws5["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws5, "Financial Summary");

    // 6. Training Summary Tab
    const trRows = [
      ["SAHA EĞİTİMLERİ VE YETKİNLİK MATRİSİ ÖZETİ"],
      [],
      ["Eğitim Konusu / Yalın Metot", "Seans Sayısı"],
      ...trainingTopicData.map(t => [t.name, t["Eğitim Seans Sayısı"]])
    ];
    const ws6 = XLSX.utils.aoa_to_sheet(trRows);
    ws6["!cols"] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws6, "Training Summary");

    // 7. Raw Data
    const rawHeader = Object.keys(filteredData.records[0] || {});
    const rawRows = [
      ["HAM VERİ TABLOSU (RAW DATA SET)"],
      [],
      rawHeader,
      ...filteredData.records.map(r => Object.values(r))
    ];
    const ws7 = XLSX.utils.aoa_to_sheet(rawRows);
    XLSX.utils.book_append_sheet(wb, ws7, "Raw Data");

    // Save
    XLSX.writeFile(wb, `OPEX_PowerBI_SteeringCommittee_Report_${customerName}.xlsx`);
  };

  // jsPDF's built-in standard fonts (Helvetica etc.) only support WinAnsi/Latin-1 — İ, ı, Ş, ş,
  // Ğ, ğ aren't in that set and render as garbled digits/symbols (Ç/ç/Ö/ö/Ü/ü are fine, they're
  // valid Latin-1). Transliterate just those five letters for anything drawn into the PDF rather
  // than embedding a custom Unicode font just for this export.
  const pdfSafe = (s: string): string => String(s)
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g");

  // Real landscape "Power BI style" PDF report — built with jsPDF/autoTable directly (KPI cards,
  // section tables) instead of window.print()'ing the live web page, which produced a portrait,
  // web-styled printout rather than something that reads as an actual report document.
  // Captures a live chart card (the actual Recharts DOM, not a redrawn approximation) via
  // modern-screenshot's domToCanvas — same library/technique VsmPage.tsx already uses for its
  // diagram export, rendered through the browser's own engine (SVG foreignObject) rather than
  // html2canvas. Returns null (skips silently) if the card isn't in the DOM or captured empty.
  const captureChartImage = async (elementId: string): Promise<{ dataUrl: string; aspectRatio: number } | null> => {
    const el = document.getElementById(elementId);
    if (!el) return null;
    try {
      const canvas = await domToCanvas(el, { scale: 2, backgroundColor: "#ffffff" });
      if (canvas.width === 0 || canvas.height === 0) return null;
      return { dataUrl: canvas.toDataURL("image/png", 1.0), aspectRatio: canvas.width / canvas.height };
    } catch (e) {
      console.error(`Failed to capture chart ${elementId} for PDF export`, e);
      return null;
    }
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportDashboardPdf = async () => {
    setIsExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 12;
      const footerMargin = 14;
      const customerName = selectedCustomer?.companyName || "OPEX Tesis";

      const drawHeaderBanner = () => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 26, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(16);
        doc.text(pdfSafe("OPEX PROJE TAKİP RAPORU"), marginX, 12);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.text(pdfSafe(customerName), marginX, 19);
        doc.setFontSize(8);
        const monthLabel = filterMonth !== "ALL" ? monthsList.find(m => m.value === filterMonth)?.label : null;
        doc.text(
          pdfSafe(`Dönem: ${filterYear === "ALL" ? "Tüm Yıllar" : filterYear}${monthLabel ? " / " + monthLabel : ""}  •  Oluşturma: ${new Date().toLocaleDateString("tr-TR")}`),
          pageWidth - marginX, 12, { align: "right" }
        );
        doc.text(
          pdfSafe(`Bölüm: ${filterDepartment === "ALL" ? "Tümü" : filterDepartment}  •  Sorumlu: ${filterConsultant === "ALL" ? "Tümü" : filterConsultant}`),
          pageWidth - marginX, 19, { align: "right" }
        );
        doc.setTextColor(15, 23, 42);
      };

      drawHeaderBanner();
      let y = 34;

      // KPI cards row
      const kpis: { label: string; value: string; color: [number, number, number] }[] = [
        { label: "PROJE İLERLEME", value: metrics.projectProgress !== null ? `%${metrics.projectProgress}` : "—", color: [79, 70, 229] },
        { label: "TOPLAM AKSİYON", value: `${metrics.totalActions}`, color: [51, 65, 85] },
        { label: "AKSİYON BAŞARISI", value: `%${metrics.actionPerformance}`, color: metrics.actionPerformance >= 70 ? [5, 150, 105] : metrics.actionPerformance >= 40 ? [217, 119, 6] : [225, 29, 72] },
        { label: "TERMİNE UYUM", value: metrics.dueDateCompliance !== null ? `%${metrics.dueDateCompliance}` : "—", color: (metrics.dueDateCompliance ?? 0) >= 70 ? [5, 150, 105] : [217, 119, 6] },
        { label: "DOĞRULANMIŞ KAZANÇ", value: `${currencySymbol}${metrics.verifiedKaizenSavings.toLocaleString("tr-TR")}`, color: [6, 95, 70] },
        { label: "EĞİTİM (ADAM-SAAT)", value: `${metrics.trainingSessions} Seans / ${metrics.totalTrainingManHours} sa`, color: [67, 56, 202] }
      ];
      const kpiGap = 4;
      const kpiWidth = (pageWidth - marginX * 2 - kpiGap * (kpis.length - 1)) / kpis.length;
      const kpiHeight = 22;
      kpis.forEach((kpi, i) => {
        const x = marginX + i * (kpiWidth + kpiGap);
        doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.roundedRect(x, y, kpiWidth, kpiHeight, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.5);
        doc.setFont("Helvetica", "bold");
        doc.text(pdfSafe(kpi.label), x + 3, y + 7, { maxWidth: kpiWidth - 6 });
        doc.setFontSize(13);
        doc.text(pdfSafe(kpi.value), x + 3, y + 16, { maxWidth: kpiWidth - 6 });
      });
      y += kpiHeight + 10;
      doc.setTextColor(15, 23, 42);

      // Capture every chart card up front (parallel), then lay them out — real Recharts
      // renders, not redrawn approximations, so the PDF actually matches what's on screen.
      const chartIds = [
        "pdf-chart-value-creation", "pdf-chart-action-status",
        "pdf-chart-team-performance", "pdf-chart-topic-distribution",
        "pdf-chart-training"
      ];
      const captured = Object.fromEntries(
        await Promise.all(chartIds.map(async id => [id, await captureChartImage(id)] as const))
      ) as Record<string, { dataUrl: string; aspectRatio: number } | null>;

      // Places two chart images side by side at the current y, returns the row's bottom y.
      // Falls back to a "grafik oluşturulamadı" placeholder box so a capture failure doesn't
      // silently produce a blank gap.
      const drawChartRow = (leftId: string, leftTitle: string, rightId: string, rightTitle: string, startY: number): number => {
        const colW = (pageWidth - marginX * 2 - 8) / 2;
        const maxH = 78;
        doc.setFontSize(10);
        doc.setFont("Helvetica", "bold");
        doc.text(pdfSafe(leftTitle), marginX, startY);
        doc.text(pdfSafe(rightTitle), marginX + colW + 8, startY);

        let maxBottom = startY + 4;
        [{ id: leftId, x: marginX }, { id: rightId, x: marginX + colW + 8 }].forEach(({ id, x }) => {
          const chart = captured[id];
          if (chart) {
            const h = Math.min(maxH, colW / chart.aspectRatio);
            const w = h * chart.aspectRatio;
            doc.addImage(chart.dataUrl, "PNG", x, startY + 4, w, h);
            maxBottom = Math.max(maxBottom, startY + 4 + h);
          } else {
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(x, startY + 4, colW, 40, 2, 2, "FD");
            doc.setFontSize(8);
            doc.setFont("Helvetica", "normal");
            doc.setTextColor(148, 163, 184);
            doc.text(pdfSafe("Grafik yakalanamadı"), x + colW / 2, startY + 4 + 20, { align: "center" });
            doc.setTextColor(15, 23, 42);
            maxBottom = Math.max(maxBottom, startY + 4 + 40);
          }
        });
        return maxBottom;
      };

      y = drawChartRow(
        "pdf-chart-value-creation", "PROJE DEĞER OLUŞTURMA ZAMAN ÇİZGİSİ",
        "pdf-chart-action-status", "AKSİYON TAKİP STATÜLERİ & DÖNÜŞÜM DERECESİ",
        y
      ) + 10;

      doc.addPage();
      drawHeaderBanner();
      y = 34;

      y = drawChartRow(
        "pdf-chart-team-performance", "SAHA SORUMLUSU GÖREV DAĞILIM ANALİZİ",
        "pdf-chart-topic-distribution", "YALIN DÖNÜŞÜM KONULARINA GÖRE DAĞILIM",
        y
      ) + 10;

      // Ekip Aksiyon Performansı — exact counts alongside the chart above
      doc.setFontSize(10);
      doc.text(pdfSafe("EKİP AKSİYON PERFORMANSI (SAYISAL DÖKÜM)"), marginX, y);
      autoTable(doc, {
        head: [[pdfSafe("Sorumlu"), pdfSafe("Açık"), pdfSafe("Devam Ediyor"), pdfSafe("Kapalı")]],
        body: teamPerformanceData.map(t => [pdfSafe(t.name), t["Açık"].toString(), t["Devam Ediyor"].toString(), t["Kapalı"].toString()]),
        startY: y + 3,
        margin: { left: marginX, right: marginX },
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85] }
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      if (captured["pdf-chart-training"] || trainingTopicData.length > 0) {
        if (y > pageHeight - footerMargin - 90) {
          doc.addPage();
          drawHeaderBanner();
          y = 34;
        }

        const chart = captured["pdf-chart-training"];
        doc.setFontSize(10);
        doc.setFont("Helvetica", "bold");
        doc.text(pdfSafe("EĞİTİM ÖZETİ"), marginX, y);
        if (chart) {
          const h = Math.min(78, (pageWidth - marginX * 2) / chart.aspectRatio);
          const w = h * chart.aspectRatio;
          doc.addImage(chart.dataUrl, "PNG", marginX, y + 4, w, h);
          y += 4 + h + 10;
        } else {
          y += 4;
        }

        if (trainingTopicData.length > 0) {
          autoTable(doc, {
            head: [[pdfSafe("Konu"), pdfSafe("Seans Sayısı"), pdfSafe("Adam-Saat")]],
            body: trainingTopicData.map(t => [pdfSafe(t.name), t["Eğitim Seans Sayısı"].toString(), t["Adam-Saat Eğitim"].toString()]),
            startY: y,
            margin: { left: marginX, right: marginX },
            tableWidth: (pageWidth - marginX * 2 - 8) / 2,
            theme: "striped",
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [67, 56, 202] }
          });
        }
      }

      // Footer — page numbers on every page
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(pdfSafe(`Gemba Partner — OPEX Proje Takip Raporu | Sayfa ${p}/${pageCount}`), pageWidth / 2, pageHeight - 6, { align: "center" });
      }

      doc.save(`OPEX_Dashboard_Raporu_${customerName.replace(/\s+/g, "_")}.pdf`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ACTION HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 mr-2 animate-pulse" />
            OPEX Yönetici Dashboard & Steering Committee Raporlama Paneli
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            Proje kütüğü, Kaizen panosu, master plan ve eğitim kayıtlarından anlık ve dinamik veri konsolidasyonu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportToExcel}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>Excel'e Çoklu Tab Raporu Çıkar</span>
          </button>
          <button
            onClick={handleExportDashboardPdf}
            disabled={isExportingPdf}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {isExportingPdf ? (
              <RefreshCw className="w-4 h-4 text-slate-300 animate-spin" />
            ) : (
              <Printer className="w-4 h-4 text-slate-300" />
            )}
            <span>{isExportingPdf ? "Grafikler Yakalanıyor..." : "PDF Rapor İndir (Yatay)"}</span>
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-inner">
        <div className="flex items-center space-x-2 text-slate-700 pb-1.5 border-b border-slate-200">
          <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-black uppercase tracking-wider">Gelişmiş Çok Kriterli Süzgeçler (Dinamik Power BI Filtreleri)</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs font-sans">

          {/* 1. Year Select */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Planlama Yılı:</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Tüm Seneler</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          {/* 2. Month Select */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Aktivite Ayı:</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Tüm Aylar</option>
              {monthsList.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* 3. Department Select */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Yalın Metot / Bölüm:</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Tüm Bölümler</option>
              {filterOptions.departments.map((dept, idx) => (
                <option key={idx} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* 4. Sorumlu Lider Select */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Sorumlu Lider:</label>
            <select
              value={filterConsultant}
              onChange={(e) => setFilterConsultant(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Tüm Sorumlular</option>
              {filterOptions.consultants.map((cons, idx) => (
                <option key={idx} value={cons}>{cons}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Filters status indicator */}
        <div className="flex justify-between items-center text-[10.5px] pt-1.5 border-t border-slate-200 text-slate-500 font-medium">
          <span>
            * Süzme sonucunda <b>{filteredData.records.length}</b> saha aksiyonu, <b>{filteredData.kaizens.length}</b> Kaizen projesi listelendi.
          </span>
          {(filterYear !== "ALL" || filterMonth !== "ALL" || filterDepartment !== "ALL" || filterConsultant !== "ALL") && (
            <button
              onClick={() => {
                setFilterYear("ALL");
                setFilterMonth("ALL");
                setFilterDepartment("ALL");
                setFilterConsultant("ALL");
              }}
              className="text-rose-600 font-extrabold hover:underline"
            >
              Tüm Filtreleri Temizle
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1 – EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Project Progress Gauge */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Proje İlerleme Oranı</span>
            {metrics.projectProgress !== null ? (
              <span className="text-3xl font-mono font-black text-indigo-700">%{metrics.projectProgress}</span>
            ) : (
              <span className="text-lg text-slate-400 font-bold">Master Plan bağlı değil</span>
            )}
            <div className="text-[11px] text-slate-500 font-bold mt-1">
              {metrics.totalCompletedManDays} / {metrics.totalPlannedManDays} Master Plan Adam-Gün
            </div>
            <div className="text-[10px] text-slate-400 font-semibold">
              Sahada Kayıtlı Ziyaret: {metrics.totalVisitDays} gün
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div className="bg-indigo-600 h-1.5 rounded" style={{ width: `${metrics.projectProgress ?? 0}%` }} />
          </div>
          <Layers className="absolute right-3 top-3 w-8 h-8 text-indigo-100 opacity-60 pointer-events-none" />
        </div>

        {/* KPI 2: Total Actions Summary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Saha Aksiyon Havuzu</span>
            <span className="text-3xl font-mono font-black text-slate-800">{metrics.totalActions}</span>
            <div className="text-[9.5px] text-slate-500 font-semibold flex items-center space-x-1.5 mt-1">
              <span className="text-emerald-600 font-bold">{metrics.completedActions} Kapalı</span>
              <span>•</span>
              <span className="text-rose-600 font-bold">{metrics.openActions} Açık</span>
            </div>
          </div>
          <AlertCircle className="absolute right-3 top-3 w-8 h-8 text-slate-100 opacity-60 pointer-events-none" />
        </div>

        {/* KPI 3: Action Performance — speedometer gauge */}
        <div className="bg-gradient-to-b from-white to-slate-50/60 border border-gray-200 rounded-2xl p-3 shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
          <GaugeChart value={metrics.actionPerformance} label="Aksiyon Başarı Oranı" sublabel="Kapalı / Toplam Aksiyon" />
        </div>

        {/* KPI 4: Due Date Compliance — speedometer gauge */}
        <div className="bg-gradient-to-b from-white to-slate-50/60 border border-gray-200 rounded-2xl p-3 shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
          {metrics.dueDateCompliance !== null ? (
            <GaugeChart value={metrics.dueDateCompliance} label="Termine Uyum Oranı" sublabel="Zamanında / Tamamlanan" />
          ) : (
            <div className="flex flex-col items-center justify-center h-[92px] space-y-1.5">
              <Clock className="w-7 h-7 text-slate-200" />
              <span className="text-[11px] text-slate-400 font-bold text-center px-2">Henüz kapatılan aksiyon yok</span>
            </div>
          )}
        </div>

        {/* KPI 5: Verified Kaizen Savings */}
        <div className="bg-emerald-800 border border-emerald-900 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden text-white">
          <div className="space-y-1 z-10">
            <span className="text-[11px] text-emerald-100 font-extrabold uppercase tracking-widest block">Doğrulanmış Net Kazanç</span>
            <span className="text-2xl font-mono font-black text-white">
              {currencySymbol}{metrics.verifiedKaizenSavings.toLocaleString("tr-TR")}
            </span>
            <div className="text-[11px] text-emerald-100 font-semibold mt-1">
              Yıllık Gerçekleşen Kaizen Tasarrufu
            </div>
          </div>
          <DollarSign className="absolute right-2 top-2 w-12 h-12 text-emerald-700 opacity-50 pointer-events-none" />
        </div>

      </div>

      {/* SECTION 2 & SECTION 7 – PROJECT PERFORMANCE & FINANCIAL TIME LINE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Value Creation Timeline Cumulative Line Graph */}
        <div id="pdf-chart-value-creation" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="border-b pb-3 mb-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center justify-between">
              <span className="flex items-center">
                <TrendingUp className="w-4 h-4 mr-1.5 text-indigo-600" />
                Proje Değer Oluşturma Zaman Çizgisi (Value Creation Timeline)
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[8.5px] px-2 py-0.5 rounded-full uppercase font-extrabold">Birikimli Yıllık Kazanç</span>
            </h3>
            <span className="text-[10.5px] text-slate-500 block">Saha iyileştirmelerinin haftalara göre doğrulanmış birikimli finansal katkısı (Yönetici sunum grafiği)</span>
          </div>
          
          <div className="h-64 mt-2">
            {valueCreationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={valueCreationData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" stroke="#94a3b8" fontSize={9} fontStyle="bold" />
                  <YAxis stroke="#94a3b8" fontSize={9} fontStyle="bold" tickFormatter={(v) => `₺${v.toLocaleString("tr-TR")}`} />
                  <Tooltip formatter={(value: any) => [`₺${value.toLocaleString("tr-TR")}`, "Birikimli Kazanç"]} />
                  <Area type="monotone" dataKey="Birikimli Değer (₺)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">Grafik için veri bulunmamaktadır.</div>
            )}
          </div>
        </div>

        {/* Action Status Donut & Priority distribution */}
        <div id="pdf-chart-action-status" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="border-b pb-3 mb-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center">
              <Percent className="w-4 h-4 mr-1.5 text-slate-500" />
              Aksiyon Takip Statüleri & Dönüşüm Derecesi
            </h3>
            <span className="text-[10.5px] text-slate-500 block">Tamamlanan, devam eden ve hazırlık aşamasındaki tüm saha iş paketlerinin dağılım oranları</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-64 mt-2">
            <div className="w-full sm:w-1/2 h-full">
              {actionStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={actionStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {actionStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} Adet`, "Miktar"]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">Veri bulunmuyor</div>
              )}
            </div>

            <div className="w-full sm:w-1/2 space-y-2.5 text-xs">
              {actionStatusData.map((s, idx) => {
                const total = actionStatusData.reduce((acc, curr) => acc + curr.value, 0);
                const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                return (
                  <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-all">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="font-extrabold text-slate-700">{s.name}</span>
                    </div>
                    <div className="font-mono text-right flex items-center space-x-2">
                      <span className="font-semibold text-slate-500">{s.value} Adet</span>
                      <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">%{pct}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 4 & SECTION 5 – TEAM PERFORMANCE & IMPROVEMENT DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Stacked Team Action Distribution Chart */}
        <div id="pdf-chart-team-performance" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="border-b pb-3 mb-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center">
              <Users className="w-4 h-4 mr-1.5 text-slate-500" />
              Saha Sorumlusu Görev Dağılım Analizi (Yük Dengesi)
            </h3>
            <span className="text-[10.5px] text-slate-500 block">Sorumlu bazında açık, devam eden ve tamamlanan saha iş adımlarının yük ve yoğunluk haritası</span>
          </div>

          <div className="h-64 mt-2">
            {teamPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={teamPerformanceData.slice(0, 6)} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontStyle="bold" />
                  <YAxis stroke="#94a3b8" fontSize={9} fontStyle="bold" />
                  <Tooltip />
                  <Legend fontSize={9} />
                  <Bar dataKey="Kapalı" stackId="a" fill="#10b981" />
                  <Bar dataKey="Devam Ediyor" stackId="a" fill="#f97316" />
                  <Bar dataKey="Açık" stackId="a" fill="#ef4444" />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Gösterilecek sorumluluk kaydı bulunmamaktadır.</div>
            )}
          </div>
        </div>

        {/* Improvement topics donut chart */}
        <div id="pdf-chart-topic-distribution" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="border-b pb-3 mb-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center">
              <Building className="w-4 h-4 mr-1.5 text-slate-500" />
              Yalın Dönüşüm Konularına Göre Dağılım
            </h3>
            <span className="text-[10.5px] text-slate-500 block">Yapılan iyileştirme adımlarının yalın dönüşüm sütunlarına (5S, TPM, Akış, Kalite) göre frekansı</span>
          </div>

          <div className="h-64 mt-2">
            {improvementDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={improvementDistributionData.slice(0, 6)} layout="vertical" margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={9} fontStyle="bold" />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} fontStyle="bold" width={95} />
                  <Tooltip />
                  <Bar dataKey="value" name="Aksiyon Sıklığı" radius={[0, 4, 4, 0]}>
                    {improvementDistributionData.map((e, index) => (
                      <Cell key={`cell-${index}`} fill={e.color} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Kategori bulunmamaktadır.</div>
            )}
          </div>
        </div>

      </div>

      {/* SECTION 6 & SECTION 7 – TRAINING & FINANCIAL DETAILED VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Training Dashboard Overview */}
        <div id="pdf-chart-training" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b pb-3 mb-4 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center">
                <BookOpen className="w-4 h-4 mr-1.5 text-slate-500" />
                Bölüm 6 – Saha Eğitim & Yetkinlik Göstergeleri
              </h3>
              <span className="bg-blue-100 text-blue-800 text-[8.5px] px-2 py-0.5 rounded-full font-extrabold uppercase">Saha Matrisi</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Eğitim Adeti</span>
                <span className="text-lg font-mono font-black text-indigo-700">{metrics.trainingSessions} Seans</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Konu Sayısı</span>
                <span className="text-lg font-mono font-black text-slate-800">{trainingTopicData.length} Konu</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Toplam Adam-Saat</span>
                <span className="text-lg font-mono font-black text-fuchsia-700">{metrics.totalTrainingManHours}</span>
              </div>
            </div>
          </div>

          <div className="h-44">
            {trainingTopicData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={trainingTopicData.slice(0, 4)} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={8} fontStyle="bold" />
                  <YAxis yAxisId="left" stroke="#94a3b8" fontSize={8} fontStyle="bold" />
                  <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={8} fontStyle="bold" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="Eğitim Seans Sayısı" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="Adam-Saat Eğitim" fill="#c026d3" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Eğitim kaydı bulunmuyor.</div>
            )}
          </div>
        </div>

        {/* Financial Dashboard and COPQ/ROI calculations */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b pb-3 mb-4 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center">
                <DollarSign className="w-4 h-4 mr-1.5 text-slate-500" />
                Bölüm 7 – Proje Yatırım Geri Dönüşü (ROI)
              </h3>
              <span className="bg-emerald-100 text-emerald-800 text-[8.5px] px-2 py-0.5 rounded-full font-extrabold uppercase">Tasarruf Havuzu</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Yıllık Öngörülen Kazanç</span>
                  <span className="text-base font-mono font-black text-slate-800">{currencySymbol}{metrics.expectedSavings.toLocaleString("tr-TR")}</span>
                </div>
                <TrendingUp className="w-7 h-7 text-indigo-400" />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wider block">Doğrulanmış Kazanç</span>
                  <span className="text-base font-mono font-black text-emerald-800">
                    {currencySymbol}{metrics.verifiedKaizenSavings.toLocaleString("tr-TR")}
                  </span>
                </div>
                <Award className="w-7 h-7 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase block tracking-wider">Yatırım ve Finansal ROI Analizi</span>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 font-bold uppercase shrink-0">Tahmini Yatırım ({currencySymbol})</label>
              <input
                type="number"
                value={investmentAmount || ""}
                onChange={(e) => setInvestmentAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-center text-xs pt-1">
              <div className="space-y-1 border-l">
                <strong className="text-emerald-800 text-[10px] uppercase font-extrabold block">ROI Oranı</strong>
                <span className="font-mono font-black text-emerald-700">
                  {investmentAmount > 0 ? `%${Math.round(((metrics.verifiedKaizenSavings - investmentAmount) / investmentAmount) * 100)}` : "Yatırım girin"}
                </span>
              </div>
              <div className="space-y-1 border-l">
                <strong className="text-indigo-800 text-[10px] uppercase font-extrabold block">Geri Ödeme Süresi</strong>
                <span className="font-mono font-black text-indigo-700">
                  {investmentAmount > 0 && metrics.verifiedKaizenSavings > 0 ? `${((investmentAmount / metrics.verifiedKaizenSavings) * 12).toFixed(1)} Ay` : "Veri yok"}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
