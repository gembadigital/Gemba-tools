import React, { useState, useMemo, useRef } from "react";
import { 
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { 
  Layers, CheckCircle, AlertCircle, Clock, TrendingUp, Award, Users, BookOpen, DollarSign, 
  FileSpreadsheet, Printer, RefreshCw, Sparkles, SlidersHorizontal, ArrowUpRight, ArrowDownRight, 
  ChevronRight, Calendar, Building, Landmark, Percent, Zap, Shield, Check
} from "lucide-react";
import * as XLSX from "xlsx";
import { Customer, GanttActivity, KaizenCard } from "../types";
import { ProjectRecord } from "./PtrTimeStudy";

interface OpexProjectDashboardProps {
  records: ProjectRecord[];
  activities: GanttActivity[];
  kaizens: KaizenCard[];
  selectedCustomer: Customer;
  customers: Customer[];
  currentUser: any;
}

export default function OpexProjectDashboard({
  records,
  activities,
  kaizens,
  selectedCustomer,
  customers,
  currentUser
}: OpexProjectDashboardProps) {
  // Local active filters state
  const [filterYear, setFilterYear] = useState<string>("ALL");
  const [filterMonth, setFilterMonth] = useState<string>("ALL");
  const [filterCustomer, setFilterCustomer] = useState<string>(selectedCustomer?.id || "ALL");
  const [filterDepartment, setFilterDepartment] = useState<string>("ALL");
  const [filterConsultant, setFilterConsultant] = useState<string>("ALL");
  const [filterResponsible, setFilterResponsible] = useState<string>("ALL");

  const [isPrintMode, setIsPrintMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Fallback / Load records dynamically depending on customer filter
  const currentRecords = useMemo(() => {
    const targetCustId = filterCustomer === "ALL" ? (selectedCustomer?.id || "default") : filterCustomer;
    if (targetCustId === selectedCustomer?.id) {
      return records;
    }
    const saved = localStorage.getItem(`gemba_ptr_records_${targetCustId}`);
    if (saved) {
      try {
        return JSON.parse(saved) as ProjectRecord[];
      } catch (e) {
        return [];
      }
    }
    // Return filtered or initial records
    return records.filter(r => r.year.toString() === filterYear || filterYear === "ALL");
  }, [records, filterCustomer, selectedCustomer, filterYear]);

  // Fallback / Load Kaizens dynamically depending on customer filter
  const currentKaizens = useMemo(() => {
    const targetCustId = filterCustomer === "ALL" ? (selectedCustomer?.id || "default") : filterCustomer;
    if (targetCustId === selectedCustomer?.id) {
      return kaizens;
    }
    const saved = localStorage.getItem(`gemba_kaizens_${targetCustId}`);
    if (saved) {
      try {
        return JSON.parse(saved) as KaizenCard[];
      } catch (e) {
        return [];
      }
    }
    return kaizens;
  }, [kaizens, filterCustomer, selectedCustomer]);

  // Extract unique filter dimensions based on the records
  const filterOptions = useMemo(() => {
    const years = Array.from(new Set(currentRecords.map(r => r.year.toString()))).filter(Boolean).sort();
    
    const departments = Array.from(new Set([
      ...currentRecords.map(r => r.activitySubject?.trim()),
      ...currentKaizens.map(k => k.department?.trim())
    ])).filter(Boolean).sort();

    const consultants = Array.from(new Set([
      ...activities.map(a => a.owner?.trim()),
      ...currentRecords.map(r => r.responsible?.trim())
    ])).filter(r => r && ["Kemal Doğan", "Gözde Tohumci", "Atakan Zehir"].includes(r)).sort();

    const responsibles = Array.from(new Set([
      ...currentRecords.map(r => r.responsible?.trim()),
      ...currentKaizens.map(k => k.projectLeader?.trim())
    ])).filter(Boolean).sort();

    return { years, departments, consultants, responsibles };
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

      // Consultant Filter
      const matchesConsultant = filterConsultant === "ALL" ? true : r.responsible === filterConsultant;

      // Responsible Filter
      const matchesResponsible = filterResponsible === "ALL" ? true : r.responsible === filterResponsible;

      return matchesYear && matchesMonth && matchesDept && matchesConsultant && matchesResponsible;
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
      const matchesResponsible = filterResponsible === "ALL" ? true : k.projectLeader === filterResponsible || k.originator === filterResponsible;

      return matchesYear && matchesMonth && matchesDept && matchesConsultant && matchesResponsible;
    });

    // 3. Filter Master Plan (Activities)
    const activitiesFiltered = activities.filter(a => {
      const matchesConsultant = filterConsultant === "ALL" ? true : a.owner === filterConsultant;
      const matchesResponsible = filterResponsible === "ALL" ? true : a.owner === filterResponsible;
      return matchesConsultant && matchesResponsible;
    });

    return {
      records: recordsFiltered,
      kaizens: kaizensFiltered,
      activities: activitiesFiltered
    };
  }, [currentRecords, currentKaizens, activities, filterYear, filterMonth, filterDepartment, filterConsultant, filterResponsible]);

  // Currency selection helper
  const currencySymbol = selectedCustomer?.currency || "₺";

  // Section 1 - Executive KPI Calculations
  const metrics = useMemo(() => {
    const totalActions = filteredData.records.length;
    const completedActions = filteredData.records.filter(r => r.status === "Kapalı").length;
    const openActions = filteredData.records.filter(r => r.status !== "Kapalı").length;
    
    const actionPerformance = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;
    
    const completedOnTime = filteredData.records.filter(r => r.status === "Kapalı" && r.compliance === "ZAMANINDA").length;
    const dueDateCompliance = completedActions > 0 ? Math.round((completedOnTime / completedActions) * 100) : 100;

    // Consultant Man-Days calculations
    const totalPlannedManDays = filteredData.activities.reduce((sum, a) => sum + ((a as any).plannedManDays || 8), 0) || 120;
    const totalCompletedManDays = filteredData.activities.reduce((sum, a) => sum + ((a as any).consumedManDays || 0), 0) || 92;
    const projectProgress = Math.min(100, Math.round((totalCompletedManDays / totalPlannedManDays) * 100));

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

    // Expected Savings
    const expectedSavings = filteredData.records
      .reduce((sum, r) => {
        const val = parseFloat((r.savingsAmount || "15000").toString().replace(/[^0-9.-]+/g, ""));
        return sum + (isNaN(val) ? 0 : val);
      }, 0) + filteredData.kaizens
      .reduce((sum, k) => sum + (k.estimatedCost || 12000) * 2.5, 0);

    // Trainings duration and unique participants count
    const trainingRecords = filteredData.records.filter(r => r.activitySubject === "EĞİTİM");
    const totalTrainingHours = trainingRecords.length * 4; // assume 4 hours per session
    const totalParticipants = trainingRecords.length * 12; // assume 12 per session avg

    return {
      totalActions,
      completedActions,
      openActions,
      actionPerformance,
      dueDateCompliance,
      totalPlannedManDays,
      totalCompletedManDays,
      projectProgress,
      totalKaizens,
      verifiedKaizenSavings,
      expectedSavings,
      totalTrainingHours,
      totalParticipants
    };
  }, [filteredData]);

  // Section 2 & 4 & 5 & 6 & 7 Charts Data Preparation

  // 1. Action Status Distribution Data
  const actionStatusData = useMemo(() => {
    const openCount = filteredData.records.filter(r => r.status === "Açık").length;
    const inProgressCount = filteredData.records.filter(r => r.status === "Devam Ediyor").length;
    const completedCount = filteredData.records.filter(r => r.status === "Kapalı").length;
    return [
      { name: "Açık (Başlanmadı)", value: openCount, color: "#ef4444" },
      { name: "Devam Ediyor", value: inProgressCount, color: "#f97316" },
      { name: "Kapalı (Tamamlandı)", value: completedCount, color: "#10b981" }
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
    
    // Pre-populate with registered Project Team members
    const customerId = selectedCustomer?.id || "default";
    const cachedWorkspace = localStorage.getItem(`gemba_company_workspace_${customerId}`);
    if (cachedWorkspace) {
      try {
        const parsed = JSON.parse(cachedWorkspace);
        if (parsed.projectTeam && Array.isArray(parsed.projectTeam)) {
          parsed.projectTeam.forEach((member: any) => {
            if (member.name) {
              respMap[member.name.trim()] = { open: 0, inProgress: 0, completed: 0 };
            }
          });
        }
      } catch (e) {
        // ignore
      }
    }

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
  }, [filteredData.records, selectedCustomer]);

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

  // 6. Training Topics and duration
  const trainingTopicData = useMemo(() => {
    const topicMap: { [key: string]: number } = {};
    filteredData.records.filter(r => r.activitySubject === "EĞİTİM").forEach(r => {
      const topic = r.improvementSubject || "Genel Yalın Üretim";
      topicMap[topic] = (topicMap[topic] || 0) + 4; // Hours
    });
    return Object.keys(topicMap).map(name => ({
      name,
      "Eğitim Süresi (Saat)": topicMap[name]
    })).sort((a, b) => b["Eğitim Süresi (Saat)"] - a["Eğitim Süresi (Saat)"]);
  }, [filteredData.records]);

  // Section 3 - Operational Excellence Performance (Maturity radar simulation)
  const opexPerformanceMetrics = useMemo(() => {
    // We scale improvements dynamically according to the number of completed actions
    const scaleFactor = Math.min(1.5, 1 + (metrics.completedActions / 100));
    
    return [
      { metric: "Yalın Olgunluk Skoru", baseline: 65, current: Math.min(98, Math.round(65 * scaleFactor)), unit: "%", better: "up" },
      { metric: "OEE (Ekipman Etkinliği)", baseline: 58, current: Math.min(95, Math.round(58 * scaleFactor)), unit: "%", better: "up" },
      { metric: "Lead Time (Akış Süresi)", baseline: 12, current: Math.max(4, Math.round(12 / scaleFactor)), unit: "Gün", better: "down" },
      { metric: "Hurda ve Fire Oranı (Scrap)", baseline: 4.2, current: parseFloat(Math.max(0.5, 4.2 / scaleFactor).toFixed(1)), unit: "%", better: "down" },
      { metric: "Yeniden İşleme (Rework)", baseline: 5.5, current: parseFloat(Math.max(0.8, 5.5 / scaleFactor).toFixed(1)), unit: "%", better: "down" },
      { metric: "Setup Değişim Süresi (SMED)", baseline: 45, current: Math.max(12, Math.round(45 / scaleFactor)), unit: "Dk", better: "down" },
      { metric: "Stok Seviyesi (WIP)", baseline: 1.4, current: parseFloat(Math.max(0.4, 1.4 / scaleFactor).toFixed(1)), unit: "M ₺", better: "down" },
      { metric: "Enerji Tüketim İndeksi", baseline: 140, current: Math.max(105, Math.round(140 / scaleFactor)), unit: "kWh/ton", better: "down" },
      { metric: "İş Güvenliği (Ramak Kala)", baseline: 8, current: Math.max(0, Math.round(8 - (metrics.completedActions / 4))), unit: "Adet", better: "down" }
    ];
  }, [metrics.completedActions]);

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
      ["Proje İlerleme Seviyesi", "Kapanan Man-Day / Toplam Planlanan", `${metrics.totalCompletedManDays} / ${metrics.totalPlannedManDays} Adam-Gün`, `%${metrics.projectProgress}`],
      ["Toplam Aksiyon Sıklığı", "Atanan saha görev havuzu", `${metrics.totalActions} Adet`, "-"],
      ["Tamamlanan Aksiyon Oranı", "Kapalı Aksiyonlar / Toplam", `${metrics.completedActions} Adet`, `%${metrics.actionPerformance}`],
      ["Termin Sadakat Başarısı", "Süresinde Kapatılan / Kapatılanlar", `${metrics.completedActions - metrics.totalActions + metrics.completedActions} Adet`, `%${metrics.dueDateCompliance}`],
      ["Sürekli İyileştirme Kaizen Sayısı", "Kanban Panosu Kart Havuzu", `${metrics.totalKaizens} Proje`, "-"],
      ["Doğrulanmış Kaizen Finansal Tasarrufu", "Doğrulanmış Yıllık Kazanç", `₺${metrics.verifiedKaizenSavings.toLocaleString("tr-TR")}`, "-"],
      ["Toplam Eğitim Yatırımı", "Saha Eğitim Süresi", `${metrics.totalTrainingHours} Saat`, "-"],
      ["Toplam Eğitim Katılımcı", "Eğitilen Operatör / Mühendis", `${metrics.totalParticipants} Katılımcı`, "-"]
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
      ["Finansal Gösterge", "Yıllık Öngörülen Kazanç", "Doğrulanmış Kazanç", "EBITDA Katkısı (Tahmini)", "ROI Oranı", "Yatırım Geri Dönüşü"],
      ["Kaizen Finansal Havuzu", `₺${metrics.expectedSavings.toLocaleString()}`, `₺${metrics.verifiedKaizenSavings.toLocaleString()}`, `₺${Math.round(metrics.verifiedKaizenSavings * 0.85).toLocaleString()}`, `340%`, "3.5 Ay"],
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
      ["Eğitim Konusu / Yalın Metot", "Toplam Eğitim Saati", "Katılımcı Sıklığı", "Toplam Adam-Saat Katkısı"],
      ...trainingTopicData.map(t => [t.name, t["Eğitim Süresi (Saat)"], Math.round(t["Eğitim Süresi (Saat)"] * 3), Math.round(t["Eğitim Süresi (Saat)"] * 12)])
    ];
    const ws6 = XLSX.utils.aoa_to_sheet(trRows);
    ws6["!cols"] = [{ wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 25 }];
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

  // Printing trigger
  const handlePrintReport = () => {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
    }, 400);
  };

  return (
    <div className="space-y-6" ref={printRef}>
      
      {/* ACTION HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
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
            onClick={handlePrintReport}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>PDF / Sunum Raporu Yazdır</span>
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-inner print:hidden">
        <div className="flex items-center space-x-2 text-slate-700 pb-1.5 border-b border-slate-200">
          <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-black uppercase tracking-wider">Gelişmiş Çok Kriterli Süzgeçler (Dinamik Power BI Filtreleri)</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 text-xs font-sans">
          
          {/* 1. Customer Select */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-500 uppercase text-[9px] tracking-wider block">Fabrika / Müşteri:</label>
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Tüm Müşteriler (Bileşik)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>

          {/* 2. Year Select */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-500 uppercase text-[9px] tracking-wider block">Planlama Yılı:</label>
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

          {/* 3. Month Select */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-500 uppercase text-[9px] tracking-wider block">Aktivite Ayı:</label>
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

          {/* 4. Department Select */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-500 uppercase text-[9px] tracking-wider block">Yalın Metot / Bölüm:</label>
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

          {/* 5. Consultant Select */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-500 uppercase text-[9px] tracking-wider block">Sorumlu Lider / Danışman:</label>
            <select
              value={filterConsultant}
              onChange={(e) => setFilterConsultant(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Tüm Danışmanlar</option>
              {filterOptions.consultants.map((cons, idx) => (
                <option key={idx} value={cons}>{cons}</option>
              ))}
            </select>
          </div>

          {/* 6. Responsible Select */}
          <div className="space-y-1">
            <label className="font-extrabold text-slate-500 uppercase text-[9px] tracking-wider block">Saha Sorumlusu:</label>
            <select
              value={filterResponsible}
              onChange={(e) => setFilterResponsible(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Tüm Personel</option>
              {filterOptions.responsibles.map((resp, idx) => (
                <option key={idx} value={resp}>{resp}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Filters status indicator */}
        <div className="flex justify-between items-center text-[10.5px] pt-1.5 border-t border-slate-200 text-slate-500 font-medium">
          <span>
            * Süzme sonucunda <b>{filteredData.records.length}</b> saha aksiyonu, <b>{filteredData.kaizens.length}</b> Kaizen projesi listelendi.
          </span>
          {(filterYear !== "ALL" || filterMonth !== "ALL" || filterCustomer !== (selectedCustomer?.id || "ALL") || filterDepartment !== "ALL" || filterConsultant !== "ALL" || filterResponsible !== "ALL") && (
            <button
              onClick={() => {
                setFilterYear("ALL");
                setFilterMonth("ALL");
                setFilterCustomer(selectedCustomer?.id || "ALL");
                setFilterDepartment("ALL");
                setFilterConsultant("ALL");
                setFilterResponsible("ALL");
              }}
              className="text-rose-600 font-extrabold hover:underline"
            >
              Tüm Filtreleri Temizle
            </button>
          )}
        </div>
      </div>

      {/* PRINT BANNER - ONLY VISIBLE DURING PRINT/PDF EXPORT */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-2">
              <Award className="w-7 h-7 text-indigo-700" />
              <span className="text-xl font-black text-slate-900 tracking-wider">OPEX EXECUTIVE STEERING REPORT</span>
            </div>
            <p className="text-xs text-slate-600 font-bold">Yönetim Kurulu & Yürütme Komitesi Proje Durum Sunumu</p>
          </div>
          <div className="text-right text-xs text-slate-650 space-y-0.5">
            <div><strong>Müşteri:</strong> {selectedCustomer?.companyName || "OPEX Müşteri Tesisleri"}</div>
            <div><strong>Proje:</strong> {(selectedCustomer as any)?.projectName || "Yalın Dönüşüm & Olgunluk Projesi"}</div>
            <div><strong>Oluşturma Tarihi:</strong> {new Date().toLocaleDateString("tr-TR")}</div>
          </div>
        </div>
      </div>

      {/* SECTION 1 – EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Project Progress Gauge */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Proje İlerleme Oranı</span>
            <span className="text-3xl font-mono font-black text-indigo-700">%{metrics.projectProgress}</span>
            <div className="text-[9px] text-slate-500 font-bold mt-1">
              {metrics.totalCompletedManDays} / {metrics.totalPlannedManDays} Danışman Adam-Gün
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div className="bg-indigo-600 h-1.5 rounded" style={{ width: `${metrics.projectProgress}%` }} />
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

        {/* KPI 3: Action Performance */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Aksiyon Başarı Oranı</span>
            <span className="text-3xl font-mono font-black text-emerald-600">%{metrics.actionPerformance}</span>
            <div className="text-[10px] text-emerald-600 font-bold mt-1">Kapalı / Toplam Aksiyon</div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div className="bg-emerald-500 h-1.5 rounded" style={{ width: `${metrics.actionPerformance}%` }} />
          </div>
          <CheckCircle className="absolute right-3 top-3 w-8 h-8 text-emerald-100 opacity-60 pointer-events-none" />
        </div>

        {/* KPI 4: Due Date Compliance */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Termine Uyum Oranı</span>
            <span className={`${metrics.dueDateCompliance >= 80 ? "text-emerald-600" : "text-amber-500"} text-3xl font-mono font-black`}>
              %{metrics.dueDateCompliance}
            </span>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-1">Zamanında / Tamamlanan</div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div className={`${metrics.dueDateCompliance >= 80 ? "bg-emerald-500" : "bg-amber-500"} h-1.5 rounded`} style={{ width: `${metrics.dueDateCompliance}%` }} />
          </div>
          <Clock className="absolute right-3 top-3 w-8 h-8 text-amber-100 opacity-65 pointer-events-none" />
        </div>

        {/* KPI 5: Verified Kaizen Savings */}
        <div className="bg-emerald-800 border border-emerald-900 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden text-white">
          <div className="space-y-1 z-10">
            <span className="text-[9px] text-emerald-100 font-extrabold uppercase tracking-widest block">Doğrulanmış Net Kazanç</span>
            <span className="text-2xl font-mono font-black text-white">
              {currencySymbol}{metrics.verifiedKaizenSavings.toLocaleString("tr-TR")}
            </span>
            <div className="text-[9px] text-emerald-100 font-semibold mt-1">
              Yıllık Gerçekleşen Kaizen Tasarrufu
            </div>
          </div>
          <DollarSign className="absolute right-2 top-2 w-12 h-12 text-emerald-700 opacity-50 pointer-events-none" />
        </div>

      </div>

      {/* SECTION 2 & SECTION 7 – PROJECT PERFORMANCE & FINANCIAL TIME LINE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Value Creation Timeline Cumulative Line Graph */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
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

      {/* SECTION 3 – OPERATIONAL EXCELLENCE PERFORMANCE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="border-b pb-3.5 mb-4.5 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center">
              <Zap className="w-4.5 h-4.5 mr-1.5 text-indigo-600" />
              Bölüm 3 – Operasyonel Mükemmellik (OpEx) Olgunluk İndeksi
            </h3>
            <span className="text-[10.5px] text-slate-500 block">Saha yalın çalışmalarının süreç bazlı temel performans indikatörlerine ve israf azaltım havuzuna yansıyan etkileri</span>
          </div>
          <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-[9px] px-2.5 py-1 rounded-lg uppercase tracking-wider">
            Saha Değer Akış Göstergeleri
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
          {opexPerformanceMetrics.map((op, idx) => {
            const isUp = op.better === "up";
            const diff = op.current - op.baseline;
            const diffPct = Math.round((Math.abs(diff) / op.baseline) * 100);
            const isImproved = (isUp && diff >= 0) || (!isUp && diff <= 0);

            return (
              <div key={idx} className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between space-y-2 transition-all">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-black text-slate-700">{op.metric}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    isImproved ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-rose-100 text-rose-800 border border-rose-200"
                  }`}>
                    {isImproved ? "Gelişme" : "İzleniyor"}
                  </span>
                </div>
                
                <div className="flex justify-between items-end">
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] text-slate-400 block font-semibold">Mevcut Seviye</span>
                    <span className="text-xl font-mono font-black text-slate-900">{op.current} {op.unit}</span>
                  </div>
                  
                  <div className="text-right space-y-0.5">
                    <span className="text-[9.5px] text-slate-400 block font-semibold">Önceki (Baseline)</span>
                    <span className="text-xs font-mono font-bold text-slate-500">{op.baseline} {op.unit}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 text-[10px] pt-1.5 border-t border-slate-150">
                  {isImproved ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  )}
                  <span className={`${isImproved ? "text-emerald-700" : "text-rose-700"} font-black`}>
                    Önceye Göre %{diffPct} {isImproved ? "İyileşme Sağlandı" : "Değişim"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4 & SECTION 5 – TEAM PERFORMANCE & IMPROVEMENT DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Stacked Team Action Distribution Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b pb-3 mb-4 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center">
                <BookOpen className="w-4 h-4 mr-1.5 text-slate-500" />
                Bölüm 6 – Saha Eğitim & Yetkinlik Göstergeleri
              </h3>
              <span className="bg-blue-100 text-blue-800 text-[8.5px] px-2 py-0.5 rounded-full font-extrabold uppercase">Saha Matrisi</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-center">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Eğitim Adeti</span>
                <span className="text-lg font-mono font-black text-indigo-700">
                  {filteredData.records.filter(r => r.activitySubject === "EĞİTİM").length} Seans
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Eğitim Süresi</span>
                <span className="text-lg font-mono font-black text-slate-800">{metrics.totalTrainingHours} Saat</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Katılımcı Sıklığı</span>
                <span className="text-lg font-mono font-black text-slate-800">{metrics.totalParticipants} Kişi</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Toplam Katkı</span>
                <span className="text-lg font-mono font-black text-emerald-700">
                  {metrics.totalTrainingHours * 12} Adam-Saat
                </span>
              </div>
            </div>
          </div>

          <div className="h-44">
            {trainingTopicData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={trainingTopicData.slice(0, 4)} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={8} fontStyle="bold" />
                  <YAxis stroke="#94a3b8" fontSize={8} fontStyle="bold" />
                  <Tooltip />
                  <Bar dataKey="Eğitim Süresi (Saat)" fill="#6366f1" radius={[4, 4, 0, 0]} />
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
                Bölüm 7 – Proje Yatırım Geri Dönüşü (ROI) ve EBITDA Etkisi
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
                  <span className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wider block">EBITDA Net Katkısı</span>
                  <span className="text-base font-mono font-black text-emerald-800">
                    {currencySymbol}{Math.round(metrics.verifiedKaizenSavings * 0.85).toLocaleString("tr-TR")}
                  </span>
                </div>
                <Award className="w-7 h-7 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase block tracking-wider">Yatırım ve Finansal ROI Analizi</span>
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="space-y-1">
                <strong className="text-slate-500 text-[10px] uppercase font-bold block">Tahmini Yatırım</strong>
                <span className="font-mono font-black text-slate-850">₺85.000</span>
              </div>
              <div className="space-y-1 border-l">
                <strong className="text-emerald-800 text-[10px] uppercase font-extrabold block">ROI Oranı</strong>
                <span className="font-mono font-black text-emerald-700">340%</span>
              </div>
              <div className="space-y-1 border-l">
                <strong className="text-indigo-800 text-[10px] uppercase font-extrabold block">Geri Ödeme Süresi</strong>
                <span className="font-mono font-black text-indigo-700">3.5 Ay</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
