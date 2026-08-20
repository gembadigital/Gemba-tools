import React, { useState, useEffect, useMemo } from "react";
import { useFactory } from "../context/FactoryContext";
import {
  Award, TrendingUp, Shield, Sparkles, BookOpen, AlertCircle, FileText, 
  Plus, Calendar, CheckCircle2, Save, Trash2, Printer, Lock, Layout, 
  ChevronRight, Brain, AlertTriangle, FileSpreadsheet, Activity, Target
} from "lucide-react";
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, Cell
} from "recharts";
import Markdown from "react-markdown";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { domToCanvas } from "modern-screenshot";
import gembaGIcon from "../assets/images/gemba_g_icon.png";

interface OpexCategory {
  id: string;
  name: string;
  weight: number;
}

interface OpexQuestion {
  id: string;
  categoryId: string;
  categoryName: string;
  subject: string;
  subjectId: string;
  weight: number;
  idealState: string;
  rubric: Record<number | string, string>;
}

interface Assessment {
  id: string;
  organization_id: string;
  customerId: string;
  auditName: string;
  auditDate: string;
  overallScore: number; // 0 to 100
  categoryScores: Record<string, number>; // categoryId -> avg score out of 5
  answers: Record<string, number>; // questionId -> score (0-5, or -1 for N/A)
  comments: Record<string, string>; // questionId -> comment
  categoryComments?: Record<string, string>; // categoryId -> general category notes
  status: "draft" | "completed";
  created_at: string;
  updated_at: string;
  
  // NEW COMPREHENSIVE FIELDS
  auditNo?: number;
  assessorParticipants?: string;
  customerParticipants?: string;
  targetScores?: Record<string, number>;
  targetPriorities?: Record<string, boolean>;
  targetNotes?: Record<string, string>;
  customRubrics?: Record<string, string>;
  assessorAssignments?: Record<string, string>;
  targetPreAnswers?: number[];
}

const TARGET_PRE_QUESTIONS = [
  "FİRMA BÜNYESİNDE YALIN ÜRETİM ÇALIŞMALARI UYGULANMAKTADIR.",
  "SÜREKLİ GELİŞİM BİR DEPARTMAN TARAFINDAN YÖNETİLMEKTEDİR.",
  "MEVCUTTA ÖNERİ / KAIZEN SİSTEMİ KURULU AKTİF BİR ŞEKİLDE ÇALIŞMAKTADIR.",
  "SAHADA AKTİF GÖRSEL HEDEF TAKİBİ YAPILMAKTADIR.",
  "GÖRSEL FABRİKA UYGULAMALARI BAŞLAMIŞTIR.",
  "DAHA ÖNCE YALIN DÖNÜŞÜM EĞİTİMLERİ ALINMIŞ, UYGULAMALAR BAŞLAMIŞTIR."
];

const getPreAssessmentMetrics = (preAnswersArray: number[]) => {
  const weight = 5;
  const answers = preAnswersArray && preAnswersArray.length === 6 ? preAnswersArray : [1, 1, 1, 1, 1, 1];
  const results = answers.map(ans => ans * weight);
  const totalScore = results.reduce((sum, val) => sum + val, 0);
  const category = totalScore <= 20 ? "B" : "A";
  const targetPct = category === "B" ? 45 : 70;
  return {
    results,
    totalScore,
    category,
    targetPct
  };
};

// Scoring engine — verified against the original Power Apps "Denetimi Bitir" formula (decoded
// from the .msapp source) and the real question bank, where every category's question weights
// sum to ~20 by design. Because of that, "Σ (soru puanı × soru ağırlığı)" for a category lands
// naturally in 0-100 — it's already a net score, not a fraction that needs a % sign.
//
// -1 = not yet answered (excluded, doesn't donate/receive weight). -2 = N/A (excluded from
// scoring, but its weight is redistributed equally across the category's *answered* questions —
// same rule the Power Apps formula applies — so marking something N/A doesn't silently shrink
// the category's achievable score).
function computeOpexScores(
  questions: OpexQuestion[],
  categories: OpexCategory[],
  answers: Record<string, number>
): { categoryScores: Record<string, number>; overallScore: number } {
  const categoryScores: Record<string, number> = {};
  const touchedCategoryIds: string[] = [];

  categories.forEach(cat => {
    const catQuestions = questions.filter(q => q.categoryId === cat.id);
    const touched = catQuestions.filter(q => {
      const v = answers[q.id];
      return v !== undefined && v !== -1;
    });
    if (touched.length > 0) touchedCategoryIds.push(cat.id);

    const naQuestions = touched.filter(q => answers[q.id] === -2);
    const scoredQuestions = touched.filter(q => (answers[q.id] ?? -1) >= 0);
    const naWeightSum = naQuestions.reduce((s, q) => s + q.weight, 0);
    const extraPerSurvivor = scoredQuestions.length > 0
      ? Math.round((naWeightSum / scoredQuestions.length) * 100) / 100
      : 0;

    const categoryTotal = scoredQuestions.reduce((sum, q) => {
      const effectiveWeight = Math.round((q.weight + extraPerSurvivor) * 100) / 100;
      return sum + answers[q.id] * effectiveWeight;
    }, 0);
    categoryScores[cat.id] = Math.round(categoryTotal * 100) / 100;
  });

  const touchedScores = touchedCategoryIds.map(id => categoryScores[id]);
  const overallScore = touchedScores.length > 0
    ? Math.round((touchedScores.reduce((s, v) => s + v, 0) / touchedScores.length) * 100) / 100
    : 0;

  return { categoryScores, overallScore };
}

interface OpexAssessmentProps {
  selectedCustomer: any;
  customers: any[];
  onUpdateCustomer?: (updatedCustomer: any) => void | Promise<void>;
  currentUser?: any;
}

export default function OpexAssessment({ selectedCustomer, customers, onUpdateCustomer, currentUser }: OpexAssessmentProps) {
  const isAdmin = currentUser?.role === "Admin";
  const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";

  // Question bank (categories + questions) — fetched from the backend, not bundled: this is the
  // assessment methodology itself, shared org-wide and editable by Admins via the Soru Bankası tab.
  const [categories, setCategories] = useState<OpexCategory[]>([]);
  const [questions, setQuestions] = useState<OpexQuestion[]>([]);
  const [isQuestionBankLoading, setIsQuestionBankLoading] = useState(true);

  const fetchQuestionBank = async () => {
    if (!token) return;
    try {
      const [catRes, qRes] = await Promise.all([
        fetch("/api/business/opex-categories", { headers: { "Authorization": `Bearer ${token}` } }).then(r => r.json()),
        fetch("/api/business/opex-questions", { headers: { "Authorization": `Bearer ${token}` } }).then(r => r.json())
      ]);
      if (catRes.success) setCategories(catRes.data);
      if (qRes.success) setQuestions(qRes.data);
    } catch (e) {
      console.error("Failed to load OpEx question bank", e);
    } finally {
      setIsQuestionBankLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestionBank();
  }, []);

  // App States
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("A");
  const [activeTab, setActiveTab] = useState<"summary" | "target" | "assignment" | "evaluate" | "report">("summary");
  
  // Admin: Soru Bankası (question bank) editor state
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [questionBankSaving, setQuestionBankSaving] = useState<string | null>(null);

  const handleUpdateQuestionWeight = async (question: OpexQuestion, newWeight: number) => {
    if (Number.isNaN(newWeight) || newWeight < 0) return;
    handleUpdateQuestionField(question, { weight: newWeight });
  };

  const handleUpdateQuestionField = async (question: OpexQuestion, updates: Partial<OpexQuestion>) => {
    if (!token) return;
    setQuestionBankSaving(question.id);
    setQuestions(prev => prev.map(q => q.id === question.id ? { ...q, ...updates } : q));
    try {
      await fetch("/api/business/opex-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ ...question, ...updates })
      }).then(r => r.json());
    } catch (e) {
      console.error("Failed to save question", e);
    } finally {
      setQuestionBankSaving(null);
    }
  };

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newAuditName, setNewAuditName] = useState("");
  const [newAuditDate, setNewAuditDate] = useState(new Date().toISOString().split("T")[0]);
  const [newAssessorParticipants, setNewAssessorParticipants] = useState("");
  const [newCustomerParticipants, setNewCustomerParticipants] = useState("");

  const [creationTargetScore, setCreationTargetScore] = useState<number>(45);
  const [creationPreAnswers, setCreationPreAnswers] = useState<number[]>([1, 1, 1, 1, 1, 1]);
  const [creationAssignments, setCreationAssignments] = useState<Record<string, string>>({});

  // UI Interactive States
  const [showTargetPanel, setShowTargetPanel] = useState(false);
  const [showAssessorPanel, setShowAssessorPanel] = useState(false);

  // Real co-auditor roster for this customer — was a hardcoded list of 4 fictional people
  // ("Atakan Zehir", "Kemal Doğan", "Caner Yılmaz", "Zeynep Kaya") that got written directly into
  // persisted Assessment.assessorAssignments. Now sourced from /api/business/customers/{id}/team
  // (same real-team endpoint KaizenManager/PtrTimeStudy use), scoped to whoever is actually
  // assigned to this factory. The logged-in user is always included so they can self-assign.
  const [assessorsList, setAssessorsList] = useState<{ id: string; name: string }[]>(
    currentUser ? [{ id: currentUser.id, name: currentUser.full_name || "Ben" }] : []
  );

  useEffect(() => {
    if (!selectedCustomer?.id || !token) return;
    fetch(`/api/business/customers/${selectedCustomer.id}/team`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.data) return;
        const { primaryConsultant, consultants } = data.data;
        const roster: { id: string; name: string }[] = [];
        if (currentUser) roster.push({ id: currentUser.id, name: currentUser.full_name || "Ben" });
        [primaryConsultant, ...(consultants || [])].forEach((c: any) => {
          if (c && c.id && !roster.some(r => r.id === c.id)) roster.push({ id: c.id, name: c.full_name });
        });
        setAssessorsList(roster);
      })
      .catch(err => console.error("Failed to load real assessor roster in OpexAssessment", err));
  }, [selectedCustomer?.id, token]);

  const [currentAssessorId, setCurrentAssessorId] = useState<string>(currentUser?.id || "");
  const [filterAssignedOnly, setFilterAssignedOnly] = useState<boolean>(true);

  const displayedCategories = useMemo(() => {
    if (!activeAssessment) return categories;
    if (!filterAssignedOnly) return categories;
    const filtered = categories.filter(cat => {
      const assigned = activeAssessment.assessorAssignments?.[cat.id] || currentUser?.id || "";
      return assigned === currentAssessorId;
    });
    // If no categories are assigned to this assessor, fallback to showing all
    return filtered.length > 0 ? filtered : categories;
  }, [categories, activeAssessment, filterAssignedOnly, currentAssessorId]);

  const getSystemLevelText = (score: number) => {
    if (score < 40) return "İSRAF YOĞUN";
    if (score < 60) return "GELİŞMEKTE OLAN";
    if (score < 80) return "SİSTEMATİK UYGULAMA";
    return "MÜKEMMELLİK (WORLD CLASS)";
  };

  // Same red/amber/sky/emerald tiering used for status pills elsewhere in this component —
  // keeps the score cards' color tied to the actual result instead of a fixed hardcoded green.
  const getSystemLevelTone = (score: number) => {
    if (score < 40) return { bg: "bg-red-50", text: "text-red-700" };
    if (score < 60) return { bg: "bg-amber-50", text: "text-amber-700" };
    if (score < 80) return { bg: "bg-sky-50", text: "text-sky-700" };
    return { bg: "bg-emerald-50", text: "text-emerald-700" };
  };

  // AI State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCategoryLoading, setAiCategoryLoading] = useState<string | null>(null);

  // Load assessments from DB on mount/customer switch
  const fetchAssessments = async () => {
    if (!selectedCustomer?.id || !token) return;
    try {
      const res = await fetch("/api/business/opex-assessments", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-factory-id": selectedCustomer.id
        }
      }).then(r => r.json());

      if (res.success && res.data.length > 0) {
        setAssessments(res.data);
        // Default to latest assessment
        const sorted = [...res.data].sort((a, b) => new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime());
        setActiveAssessment(sorted[0]);
      } else {
        // No real audits for this customer yet — honest empty state, not fabricated history.
        setAssessments([]);
        setActiveAssessment(null);
      }
    } catch (e) {
      console.error("Failed to load opex assessments", e);
    }
  };

  useEffect(() => {
    fetchAssessments();
    setAiReport(null);
    setAiError(null);
  }, [selectedCustomer?.id]);

  // One-time self-heal: computeOpexScores() was rebuilt (see comment above the function) to fix
  // category scores that used to be stored as an unweighted 0-5 average while overallScore was a
  // separately-computed weighted 0-100 figure. Assessments saved before that fix still carry the
  // old, inconsistent numbers in the DB — recompute from each assessment's own stored `answers`
  // (the source of truth) against the current formula and persist the correction. Idempotent: once
  // stored values match the recomputation, this is a no-op.
  useEffect(() => {
    if (!isAdmin || !token || !selectedCustomer?.id) return;
    if (questions.length === 0 || categories.length === 0 || assessments.length === 0) return;

    const stale = assessments.filter(a => {
      const { categoryScores, overallScore } = computeOpexScores(questions, categories, a.answers || {});
      if (Math.abs((a.overallScore || 0) - overallScore) > 0.01) return true;
      return Object.keys(categoryScores).some(
        catId => Math.abs((a.categoryScores?.[catId] || 0) - categoryScores[catId]) > 0.01
      );
    });
    if (stale.length === 0) return;

    (async () => {
      for (const assessment of stale) {
        const { categoryScores, overallScore } = computeOpexScores(questions, categories, assessment.answers || {});
        const corrected: Assessment = { ...assessment, categoryScores, overallScore, updated_at: new Date().toISOString() };
        try {
          const res = await fetch("/api/business/opex-assessments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
              "x-factory-id": selectedCustomer.id
            },
            body: JSON.stringify(corrected)
          }).then(r => r.json());
          if (res.success) {
            setAssessments(prev => prev.map(a => a.id === res.data.id ? res.data : a));
            setActiveAssessment(prev => prev && prev.id === res.data.id ? res.data : prev);
          }
        } catch (e) {
          console.error("Failed to reconcile stale opex assessment score", assessment.id, e);
        }
      }
    })();
  }, [isAdmin, token, selectedCustomer?.id, questions, categories, assessments]);

  // Switch Active Assessment
  const handleSelectAssessment = (id: string) => {
    const selected = assessments.find(a => a.id === id);
    if (selected) {
      setActiveAssessment(selected);
      setAiReport(null);
      setAiError(null);
    }
  };

  // NEW INTERACTIVE HANDLERS FOR AUDIT TARGETS & COLLABORATION
  const handleTargetScoreChange = (catId: string, val: number) => {
    if (!activeAssessment || activeAssessment.status === "completed") return;
    const newTargets = { ...(activeAssessment.targetScores || {}), [catId]: val };
    setActiveAssessment(prev => prev ? { ...prev, targetScores: newTargets } : null);
    setTimeout(() => {
      handleSaveDraft(undefined, undefined, undefined);
    }, 50);
  };

  const handleTargetPriorityChange = (catId: string, val: boolean) => {
    if (!activeAssessment || activeAssessment.status === "completed") return;
    const newPriorities = { ...(activeAssessment.targetPriorities || {}), [catId]: val };
    setActiveAssessment(prev => prev ? { ...prev, targetPriorities: newPriorities } : null);
    setTimeout(() => {
      handleSaveDraft(undefined, undefined, undefined);
    }, 50);
  };

  const handleTargetNoteChange = (catId: string, val: string) => {
    if (!activeAssessment || activeAssessment.status === "completed") return;
    const newNotes = { ...(activeAssessment.targetNotes || {}), [catId]: val };
    setActiveAssessment(prev => prev ? { ...prev, targetNotes: newNotes } : null);
  };

  const handleCustomRubricChange = (questionId: string, score: number, val: string) => {
    if (!activeAssessment || activeAssessment.status === "completed") return;
    const newRubrics = { ...(activeAssessment.customRubrics || {}), [`${questionId}_${score}`]: val };
    setActiveAssessment(prev => prev ? { ...prev, customRubrics: newRubrics } : null);
  };

  const handleAssessorAssignmentChange = (catId: string, assessorId: string) => {
    if (!activeAssessment || activeAssessment.status === "completed") return;
    const newAssignments = { ...(activeAssessment.assessorAssignments || {}), [catId]: assessorId };
    setActiveAssessment(prev => prev ? { ...prev, assessorAssignments: newAssignments } : null);
    setTimeout(() => {
      handleSaveDraft(undefined, undefined, undefined);
    }, 50);
  };

  // Add a new Assessment (e.g. Audit-1, Audit-2 etc)
  const handleCreateAssessment = async () => {
    if (!newAuditName.trim()) {
      alert("Lütfen denetim adını giriniz.");
      return;
    }

    const defaultAnswers: Record<string, number> = {};
    const defaultComments: Record<string, string> = {};
    const defaultCategoryScores: Record<string, number> = {};
    const defaultTargetScores: Record<string, number> = {};
    const defaultTargetPriorities: Record<string, boolean> = {};
    const defaultTargetNotes: Record<string, string> = {};
    const defaultAssessorAssignments: Record<string, string> = {};

    questions.forEach(q => {
      defaultAnswers[q.id] = -1; // -1 represents unanswered / to be filled
      defaultComments[q.id] = "";
    });

    // Selected target score is already a 0-100 net number — applied as-is to every category.
    categories.forEach(c => {
      defaultCategoryScores[c.id] = 0;
      defaultTargetScores[c.id] = creationTargetScore;
      defaultTargetPriorities[c.id] = false;
      defaultTargetNotes[c.id] = `Hedef: ${creationTargetScore}`;

      // Load selected assignments configured during creation
      defaultAssessorAssignments[c.id] = creationAssignments[c.id] || currentUser?.id || "";
    });

    const calculatedAuditNo = assessments.filter(a => a.customerId === selectedCustomer.id).length + 1;

    const payload: Partial<Assessment> = {
      customerId: selectedCustomer.id,
      auditName: newAuditName,
      auditDate: newAuditDate,
      overallScore: 0,
      categoryScores: defaultCategoryScores,
      answers: defaultAnswers,
      comments: defaultComments,
      categoryComments: {},
      status: "draft",
      auditNo: calculatedAuditNo,
      assessorParticipants: newAssessorParticipants || "Atakan Zehir (Baş Denetçi)",
      customerParticipants: newCustomerParticipants || "Saha Ekibi",
      targetScores: defaultTargetScores,
      targetPriorities: defaultTargetPriorities,
      targetNotes: defaultTargetNotes,
      assessorAssignments: defaultAssessorAssignments,
      customRubrics: {},
      targetPreAnswers: creationPreAnswers
    };

    try {
      const res = await fetch("/api/business/opex-assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-factory-id": selectedCustomer.id
        },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res.success) {
        setAssessments(prev => [res.data, ...prev]);
        setActiveAssessment(res.data);
        setIsCreating(false);
        setNewAuditName("");
        setNewAssessorParticipants("");
        setNewCustomerParticipants("");
        setActiveTab("evaluate");
      }
    } catch (e) {
      console.error("Failed to create assessment", e);
    }
  };

  // Save changes to current Draft
  const handleSaveDraft = async (
    updatedAnswers?: Record<string, number>, 
    updatedComments?: Record<string, string>,
    updatedCategoryComments?: Record<string, string>,
    customAssessment?: Assessment
  ) => {
    const baseAssessment = customAssessment || activeAssessment;
    if (!baseAssessment) return;

    const finalAnswers = updatedAnswers || baseAssessment.answers;
    const finalComments = updatedComments || baseAssessment.comments;
    const finalCategoryComments = updatedCategoryComments || baseAssessment.categoryComments || {};

    const { categoryScores, overallScore } = computeOpexScores(questions, categories, finalAnswers);

    const updatedAssessment: Assessment = {
      ...baseAssessment,
      answers: finalAnswers,
      comments: finalComments,
      categoryComments: finalCategoryComments,
      categoryScores,
      overallScore,
      updated_at: new Date().toISOString()
    };

    try {
      const res = await fetch("/api/business/opex-assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-factory-id": selectedCustomer.id
        },
        body: JSON.stringify(updatedAssessment)
      }).then(r => r.json());

      if (res.success) {
        setAssessments(prev => prev.map(a => a.id === res.data.id ? res.data : a));
        setActiveAssessment(res.data);
      }
    } catch (e) {
      console.error("Failed to save opex draft", e);
    }
  };

  // Select score for a question
  const handleScoreSelect = (questionId: string, score: number) => {
    if (!activeAssessment || activeAssessment.status === "completed") return;
    const newAnswers = { ...activeAssessment.answers, [questionId]: score };
    handleSaveDraft(newAnswers, undefined, undefined);
  };

  // Change comment for a question
  const handleCommentChange = (questionId: string, comment: string) => {
    if (!activeAssessment || activeAssessment.status === "completed") return;
    const newComments = { ...activeAssessment.comments, [questionId]: comment };
    // Just update active state to prevent laggy typing, then we can save draft
    setActiveAssessment(prev => prev ? { ...prev, comments: newComments } : null);
  };

  // Change category level comment
  const handleCategoryCommentChange = (categoryId: string, comment: string) => {
    if (!activeAssessment || activeAssessment.status === "completed") return;
    const newCategoryComments = { ...(activeAssessment.categoryComments || {}), [categoryId]: comment };
    setActiveAssessment(prev => prev ? { ...prev, categoryComments: newCategoryComments } : null);
  };

  // AI Category Analysis invocation
  const handleAnalyzeCategory = async (catId: string) => {
    if (!activeAssessment || !token) return;
    setAiCategoryLoading(catId);

    const cat = categories.find(c => c.id === catId);
    const catQuestions = questions.filter(q => q.categoryId === catId);

    // Prepare questions data for payload
    const payloadQuestions = catQuestions.map(q => {
      const score = activeAssessment.answers[q.id] !== undefined ? activeAssessment.answers[q.id] : -1;
      const comment = activeAssessment.comments[q.id] || "";
      const rubricText = score >= 0 && q.rubric[score] ? q.rubric[score] : "";
      return {
        id: q.id,
        subject: q.subject,
        idealState: q.idealState,
        score,
        comment,
        rubricText
      };
    });

    try {
      const resp = await fetch("/api/gemini/opex-category-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          categoryId: catId,
          categoryName: cat?.name || "",
          questions: payloadQuestions
        })
      });

      const res = await resp.json();
      if (res.success && res.analysis) {
        const newCategoryComments = { ...(activeAssessment.categoryComments || {}), [catId]: res.analysis };
        handleSaveDraft(undefined, undefined, newCategoryComments);
      } else {
        alert(res.error || "Bölüm değerlendirmesi üretilemedi.");
      }
    } catch (err: any) {
      alert("Hata: " + (err.message || "Yapay zeka servisiyle iletişim kurulamadı."));
    } finally {
      setAiCategoryLoading(null);
    }
  };

  // Real firm-template export: server clones the actual "OpEx Assessment" reporting template
  // (18 category detail sheets, native radar/bar charts intact) and injects this assessment's
  // data into it, so the download is the real client-facing report, not a from-scratch approximation.
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [excelExportError, setExcelExportError] = useState<string | null>(null);
  // Downloads the .xlsx via the browser's save dialog and returns the filename it was saved
  // under (or null on failure) — shared by the Excel button and the PDF button below, since a
  // PDF export of THIS report means "the same Excel workbook, saved as PDF from Excel/Print",
  // not a separate document.
  const downloadOpexExcel = async (): Promise<string | null> => {
    if (!activeAssessment || !token) return null;
    try {
      const res = await fetch(`/api/business/opex-assessments/${activeAssessment.id}/export-excel`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Rapor oluşturulamadı." }));
        throw new Error(err.error || "Rapor oluşturulamadı.");
      }
      // Filename (short customer name + YYAA + firm-wide sequence number) is decided server-side
      // in buildOpexExportFilename — read it back from Content-Disposition instead of duplicating
      // that naming logic here, so the two can't drift apart.
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
      const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : `${selectedCustomer?.companyName || "Müşteri"}-OpexAssessment.xlsx`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return filename;
    } catch (e: any) {
      setExcelExportError(e.message || "Rapor indirilemedi.");
      return null;
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    setExcelExportError(null);
    await downloadOpexExcel();
    setIsExportingExcel(false);
  };

  // jsPDF's built-in standard fonts (Helvetica etc.) only support WinAnsi/Latin-1 — İ, ı, Ş, ş,
  // Ğ, ğ aren't in that set and render as garbled digits/symbols (Ç/ç/Ö/ö/Ü/ü are fine, they're
  // valid Latin-1). Transliterate just those five letters rather than embedding a Unicode font
  // just for this export — same fix OpexProjectDashboard.tsx's PDF export already uses.
  const pdfSafe = (s: string): string => String(s)
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g");

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

  const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // A real, self-contained single-page PDF (A4 landscape) — not the .xlsx or a print of the live
  // page. Captures the actual on-screen radar/bar chart DOM (via domToCanvas, same technique
  // OpexProjectDashboard.tsx's PDF export uses) and lays the category table, comparison table,
  // KPI cards and both charts out on one page with jsPDF/autoTable, mirroring the reference
  // one-page summary report layout.
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const handleExportPdf = async () => {
    if (!activeAssessment) return;
    setIsExportingPdf(true);
    setExcelExportError(null);
    try {
      const [radarImg, barImg, logoDataUrl] = await Promise.all([
        captureChartImage("opex-pdf-radar-chart"),
        captureChartImage("opex-pdf-bar-chart"),
        loadImageAsDataUrl(gembaGIcon)
      ]);

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 10;
      const customerName = selectedCustomer?.companyName || "Müşteri";
      const reportNo = `${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(activeAssessment.auditNo || 1).padStart(2, "0")}`;

      // Header banner
      doc.setFillColor(47, 85, 151); // #2f5597
      doc.rect(0, 0, pageWidth, 22, "F");
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, "PNG", marginX, 4, 14, 14); } catch { /* non-fatal */ }
      }
      const titleX = logoDataUrl ? marginX + 18 : marginX;
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(15);
      doc.text(pdfSafe("OPEX ASSESSMENT"), titleX, 10);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text(pdfSafe(`${customerName} — Assessment Sonuçları`), titleX, 17);
      doc.setFontSize(8);
      doc.text(pdfSafe(`Rapor Tarihi/No: ${new Date().toLocaleDateString("tr-TR")} / ${reportNo}`), pageWidth - marginX, 10, { align: "right" });
      doc.text(pdfSafe(`Denetim No: ${activeAssessment.auditNo || 1}`), pageWidth - marginX, 17, { align: "right" });
      doc.setTextColor(15, 23, 42);

      const startY = 28;
      const colGap = 8;
      const leftW = (pageWidth - marginX * 2 - colGap) * 0.42;
      const rightX = marginX + leftW + colGap;
      const rightW = pageWidth - marginX * 2 - leftW - colGap;

      // LEFT: category table (Kategori / Kategori Adı / Hedef / Sonuç)
      const tableRows = categories.map(cat => {
        const scorePct = Math.round(activeAssessment.categoryScores[cat.id] || 0);
        const targetPct = Math.round(activeAssessment.targetScores?.[cat.id] ?? 45);
        return [cat.id, pdfSafe(cat.name), String(targetPct), String(scorePct)];
      });
      autoTable(doc, {
        startY,
        margin: { left: marginX },
        tableWidth: leftW,
        head: [[pdfSafe("Kategori"), pdfSafe("Kategori Adı"), pdfSafe("Hedef"), pdfSafe("Sonuç")]],
        body: tableRows,
        styles: { fontSize: 6.8, cellPadding: 1.3, textColor: [51, 65, 85] },
        headStyles: { fillColor: [47, 85, 151], textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: leftW * 0.12, halign: "center", fontStyle: "bold" },
          1: { cellWidth: leftW * 0.58 },
          2: { cellWidth: leftW * 0.15, halign: "center" },
          3: { cellWidth: leftW * 0.15, halign: "center", fontStyle: "bold" }
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 3) {
            const target = Number(data.row.raw[2]);
            const result = Number(data.row.raw[3]);
            data.cell.styles.textColor = result >= target ? [4, 120, 87] : result >= target - 15 ? [180, 83, 9] : [190, 18, 60];
          }
        }
      });

      // Below the category table: the bar chart image
      const afterTableY = (doc as any).lastAutoTable.finalY + 6;
      if (barImg) {
        const barH = Math.min(pageHeight - marginX - afterTableY, leftW / barImg.aspectRatio);
        doc.addImage(barImg.dataUrl, "PNG", marginX, afterTableY, barH * barImg.aspectRatio, barH);
      }

      // RIGHT, top: Denetleme No / Hedef / Sonuç mini table
      autoTable(doc, {
        startY,
        margin: { left: rightX },
        tableWidth: rightW * 0.42,
        head: [[pdfSafe("Denetleme"), pdfSafe("Hedef"), pdfSafe("Sonuç")]],
        body: overallComparisonData.map(d => [d.name, String(d.Hedef), String(d.Sonuç)]),
        styles: { fontSize: 7, cellPadding: 1.5, halign: "center", textColor: [51, 65, 85] },
        headStyles: { fillColor: [47, 85, 151], textColor: [255, 255, 255], fontStyle: "bold" }
      });

      // RIGHT, top-right: Sistem Seviyesi + Denetim Puanı KPI cards, next to the mini table
      const cardsX = rightX + rightW * 0.42 + 6;
      const cardsW = rightW - rightW * 0.42 - 6;
      const cardH = 18;
      doc.setFillColor(47, 85, 151);
      doc.roundedRect(cardsX, startY, cardsW, cardH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("Helvetica", "bold");
      doc.text(pdfSafe("SİSTEM SEVİYESİ"), cardsX + 3, startY + 6);
      doc.setFontSize(11);
      doc.text(pdfSafe(getSystemLevelText(activeAssessment.overallScore)), cardsX + 3, startY + 14, { maxWidth: cardsW - 6 });

      doc.setFillColor(47, 85, 151);
      doc.roundedRect(cardsX, startY + cardH + 4, cardsW, cardH, 2, 2, "F");
      doc.setFontSize(7);
      doc.text(pdfSafe("DENETİM PUANI"), cardsX + 3, startY + cardH + 4 + 6);
      doc.setFontSize(16);
      doc.text(String(Math.round(activeAssessment.overallScore)), cardsX + 3, startY + cardH + 4 + 15);
      doc.setTextColor(15, 23, 42);

      // RIGHT, bottom: the radar chart image, filling the remaining space
      const radarTop = startY + Math.max((doc as any).lastAutoTable.finalY - startY, cardH * 2 + 4) + 6;
      if (radarImg) {
        const availH = pageHeight - marginX - radarTop;
        const availW = rightW;
        let h = Math.min(availH, availW / radarImg.aspectRatio);
        let w = h * radarImg.aspectRatio;
        if (w > availW) { w = availW; h = w / radarImg.aspectRatio; }
        doc.addImage(radarImg.dataUrl, "PNG", rightX + (availW - w) / 2, radarTop, w, h);
      }

      doc.save(`${(customerName.split(/\s+/)[0] || customerName)}-${reportNo}.pdf`);
    } catch (e: any) {
      console.error("Failed to generate OpEx PDF summary", e);
      setExcelExportError(e.message || "PDF raporu oluşturulamadı.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Complete and Lock the Audit
  const handleCompleteAudit = async () => {
    if (!activeAssessment) return;
    
    // Check if any question is still unanswered (score === -1)
    const unansweredCount = Object.values(activeAssessment.answers).filter(v => v === -1).length;
    if (unansweredCount > 0) {
      if (!window.confirm(`Dikkat: Hala cevaplanmamış ${unansweredCount} soru bulunmaktadır. Bu soruları 0 olarak kabul edip denetimi tamamlamak ve kilitlemek istediğinize emin misiniz?`)) {
        return;
      }
    } else {
      if (!window.confirm("Denetimi tamamlayıp kilitlemek istediğinize emin misiniz? Kilitlendikten sonra cevaplar üzerinde değişiklik yapılamayacaktır.")) {
        return;
      }
    }

    // Replace all -1 answers with 0 for locking
    const finalAnswers = { ...activeAssessment.answers };
    Object.keys(finalAnswers).forEach(k => {
      if (finalAnswers[k] === -1) {
        finalAnswers[k] = 0;
      }
    });

    const { categoryScores, overallScore } = computeOpexScores(questions, categories, finalAnswers);

    const lockedAssessment: Assessment = {
      ...activeAssessment,
      answers: finalAnswers,
      categoryScores,
      overallScore,
      status: "completed",
      updated_at: new Date().toISOString()
    };

    try {
      // 1. Save locked assessment in DB
      const res = await fetch("/api/business/opex-assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-factory-id": selectedCustomer.id
        },
        body: JSON.stringify(lockedAssessment)
      }).then(r => r.json());

      if (res.success) {
        setAssessments(prev => prev.map(a => a.id === res.data.id ? res.data : a));
        setActiveAssessment(res.data);

        // 2. Sync / Update the customer's core `copexScore` in the main database.
        // Goes through App.tsx's onUpdateCustomer so its `customers` state (and every screen
        // reading from it — CustomerRecords, the factory selector, Executive Dashboard) reflects
        // the new score immediately instead of staying stale until a full reload.
        const updatedCustomer = {
          ...selectedCustomer,
          copexScore: overallScore,
          assessmentDate: new Date().toISOString().split("T")[0]
        };

        if (onUpdateCustomer) {
          await onUpdateCustomer(updatedCustomer);
        } else {
          await fetch("/api/business/customers", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(updatedCustomer)
          });
        }

        alert(`Tebrikler! ${res.data.auditName} başarıyla kilitlendi. Genel OpEx puanı ${overallScore} olarak güncellendi.`);
      }
    } catch (e) {
      console.error("Failed to complete opex assessment", e);
    }
  };

  // Delete Assessment
  const handleDeleteAssessment = async (id: string) => {
    if (!window.confirm("Bu değerlendirme kaydını kalıcı olarak silmek istediğinizden emin misiniz?")) return;
    try {
      const res = await fetch(`/api/business/opex-assessments/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      }).then(r => r.json());

      if (res.success) {
        const updated = assessments.filter(a => a.id !== id);
        setAssessments(updated);
        if (activeAssessment?.id === id) {
          setActiveAssessment(updated.length > 0 ? updated[0] : null);
        }
      }
    } catch (e) {
      console.error("Failed to delete assessment", e);
    }
  };

  // Suggest Default Audit Name
  useEffect(() => {
    if (isCreating) {
      const nextNum = assessments.length + 1;
      setNewAuditName(`OPEX Denetim no ${nextNum}`);
    }
  }, [isCreating, assessments.length]);

  // Current category questions list
  const currentCategoryQuestions = useMemo(() => {
    return questions.filter(q => q.categoryId === selectedCategoryId);
  }, [selectedCategoryId, questions]);

  // Compute category details for Sidebar progress
  const categoryProgress = useMemo(() => {
    if (!activeAssessment) return {};
    const results: Record<string, { answered: number; total: number; average: number }> = {};
    
    categories.forEach(cat => {
      const catQuestions = questions.filter(q => q.categoryId === cat.id);
      let answeredCount = 0;
      let totalSum = 0;
      catQuestions.forEach(q => {
        const ans = activeAssessment.answers[q.id];
        if (ans !== undefined && ans >= 0) {
          answeredCount++;
          totalSum += ans;
        }
      });
      results[cat.id] = {
        answered: answeredCount,
        total: catQuestions.length,
        average: answeredCount > 0 ? Math.round((totalSum / answeredCount) * 100) / 100 : 0
      };
    });
    return results;
  }, [activeAssessment, categories, questions]);

  // Dynamic calculations for Power BI Report page matching screenshot
  const customerAssessments = useMemo(() => {
    return assessments
      .filter(a => a.customerId === selectedCustomer?.id)
      .sort((a, b) => (a.auditNo || 0) - (b.auditNo || 0));
  }, [assessments, selectedCustomer?.id]);

  const previousAssessment = useMemo(() => {
    if (!activeAssessment || !customerAssessments.length) return null;
    const currentNo = activeAssessment.auditNo || 1;
    return customerAssessments.find(a => a.auditNo === currentNo - 1) || null;
  }, [activeAssessment, customerAssessments]);

  const radarChartDataScaled = useMemo(() => {
    if (!activeAssessment) return [];
    return categories.map(cat => {
      const rawScore = activeAssessment.categoryScores[cat.id] || 0;
      // Same 45-point creation-time default used by the category table (see targetPct above) —
      // without it, an old record with no targetScores collapses the whole "Hedef" radar ring to
      // the center (radius 0), which is invisible rather than a genuine "no target" ring.
      const rawTarget = activeAssessment.targetScores?.[cat.id] ?? 45;
      return {
        subject: cat.name,
        name: cat.name,
        "Gerçekleşen": Math.round(rawScore),
        "Hedef": Math.round(rawTarget)
      };
    });
  }, [activeAssessment, categories]);

  const comparisonRadarData = useMemo(() => {
    if (!activeAssessment || !previousAssessment) return [];
    return categories.map(cat => {
      const prevRawScore = previousAssessment.categoryScores[cat.id] || 0;
      const currRawScore = activeAssessment.categoryScores[cat.id] || 0;
      return {
        subject: cat.name,
        name: cat.name,
        "Önceki Sonuç": Math.round(prevRawScore),
        "Mevcut Sonuç": Math.round(currRawScore)
      };
    });
  }, [activeAssessment, previousAssessment, categories]);

  // Radar axis labels are full category names (not bare "A"/"B"/"C" codes) — recharts doesn't
  // wrap long tick text on its own, so this splits each name across 2 lines at the nearest word
  // boundary to the midpoint.
  const renderWrappedRadarTick = (props: any) => {
    const { x, y, payload, textAnchor } = props;
    const words = String(payload.value).split(" ");
    let line1 = String(payload.value);
    let line2 = "";
    if (words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      line1 = words.slice(0, mid).join(" ");
      line2 = words.slice(mid).join(" ");
    }
    return (
      <text x={x} y={y} textAnchor={textAnchor} fontSize={9} fontWeight={700} fill="#334155">
        <tspan x={x} dy={line2 ? "-0.3em" : "0.3em"}>{line1}</tspan>
        {line2 && <tspan x={x} dy="1.1em">{line2}</tspan>}
      </text>
    );
  };
  const RADAR_RADIUS_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  // Value labels at each radar point — a white "halo" stroke behind the dark text (paintOrder
  // draws the stroke first) keeps the number legible whether it lands on the filled area or the
  // plain white background outside it.
  const renderRadarValueLabel = (props: any) => {
    const { x, y, value } = props;
    return (
      <text x={x} y={y - 8} textAnchor="middle" fontSize={10} fontWeight={800} fill="#0f172a" stroke="#ffffff" strokeWidth={3} paintOrder="stroke">
        {value}
      </text>
    );
  };

  const overallComparisonData = useMemo(() => {
    return customerAssessments.map(a => {
      let targetPct = 0;
      if (a.targetPreAnswers) {
        const metrics = getPreAssessmentMetrics(a.targetPreAnswers);
        targetPct = metrics.targetPct;
      } else if (a.targetScores) {
        const keys = Object.keys(a.targetScores);
        if (keys.length > 0) {
          const sum = keys.reduce((s, k) => s + (a.targetScores?.[k] ?? 0), 0);
          targetPct = Math.round(sum / keys.length);
        }
      }
      return {
        name: `D-${a.auditNo || 1}`,
        "Hedef": targetPct,
        "Sonuç": a.overallScore || 0
      };
    });
  }, [customerAssessments]);

  // AI Insights with Gemini
  const handleTriggerAiInsight = async () => {
    if (!activeAssessment || !token) return;
    setIsAiLoading(true);
    setAiError(null);
    setAiReport(null);

    // Compute strong & weak areas
    const scores = Object.entries(activeAssessment.categoryScores).map(([id, val]) => {
      const cat = categories.find(c => c.id === id);
      return { id, score: val, name: cat?.name || "" };
    });

    const sortedScores = [...scores].sort((a,b) => b.score - a.score);
    const strengths = sortedScores.slice(0, 3);
    const weaknesses = sortedScores.slice(-3).reverse();

    const prompt = `
      Sen 15+ yıllık saha tecrübesine sahip seçkin bir Kıdemli Operasyonel Mükemmellik (OpEx) ve Yalın Üretim Danışmanısın.
      Aşağıdaki fabrikanın OpEx Değerlendirme Sonuçlarını detaylı olarak analiz et:
      
      FABRİKA BİLGİLERİ:
      - Firma Adı: ${selectedCustomer?.companyName}
      - Sektör: ${selectedCustomer?.industry}
      - Üretim Tipi: ${selectedCustomer?.productionType}
      - Çalışan Sayısı: ${selectedCustomer?.employeeCount}
      
      DENETİM DETAYLARI:
      - Denetim Adı: ${activeAssessment.auditName}
      - Genel OpEx Olgunluk Puanı: ${activeAssessment.overallScore} / 100
      - En Güçlü 3 Alan:
        ${strengths.map(s => `  * ${s.id} - ${s.name}: ${s.score} / 100`).join("\n")}
      - En Fazla Gelişime Açık (Zayıf) 3 Alan:
        ${weaknesses.map(w => `  * ${w.id} - ${w.name}: ${w.score} / 100`).join("\n")}

      Tüm Kategori Puanları (100 üzerinden):
      ${scores.map(s => `* ${s.id} - ${s.name}: ${s.score}`).join("\n")}
      
      Lütfen bu verilere dayanarak, tesis yöneticisine hitaben son derece klinik, net, saha gerçeklerine uygun ve heyecan verici olmayan teknik bir OpEx İyileştirme Yol Haritası hazırla. Rapor tamamen Türkçe olmalı ve şu markdown başlıklarını içermelidir:
      
      ### 1. Genel Olgunluk Seviyesi ve Yalın Durum Değerlendirmesi
      - Genel olgunluk puanı ${activeAssessment.overallScore} (100 üzerinden) olan bu tesisi sektör kriterlerine göre nerede konumlandırıyoruz? Bu olgunluğun saha kültürüne yansıması nasıldır?
      
      ### 2. Kritik Güçlü Alanlar ve Sürdürülebilirlik Stratejisi
      - En güçlü 3 alanın (${strengths.map(s => s.name).join(", ")}) getirilerini yorumla. Bu başarıların tesiste standart hale gelmesi için ne yapılmalı?
      
      ### 3. Zayıf Alanlar ve Acil Müdahale Gerektiren Muda (Kayıp) Odakları
      - En zayıf 3 alanı (${weaknesses.map(w => w.name).join(", ")}) derinlemesine analiz et. Bu alanlardaki düşük skorların fabrikadaki verimsizliklere ve finansal kayıplara etkisi nedir?
      
      ### 4. 6 Aylık Öncelikli İyileştirme Yol Haritası ve Beklenen Kazançlar
      - Gelecek 6 ayda atılması gereken somut, mekanik, saha bazlı (Kaizen, 5S, SMED, Standart İş, Otonom Bakım, Görsel Yönetim vb.) 3-4 kritik iyileştirme adımını planla.
      
      Giriş veya sonuçta yapay zeka jargonu (örn. "Harika bir gün dilerim", "Analizi sizin için derledim") veya gereksiz pazarlama süslemeleri kullanma. Doğrudan profesyonel bulgulara odaklan.
    `;

    try {
      const resp = await fetch("/api/gemini/executive-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          year: "2026",
          consultant: "Atakan Zehir",
          stats: {
            activeCustomers: 1,
            ongoingProjects: 2,
            completedProjects: 1,
            totalCiProjects: 3,
            totalKaizens: 15,
            expectedSavings: 2000000,
            realizedSavings: 1500000,
            avgSuccessRate: activeAssessment.overallScore
          },
          consultantPerformance: [],
          capacityData: [],
          riskDistribution: { healthy: 1, risky: 0, critical: 0 },
          portfolioData: [],
          customPrompt: prompt // Sending prompt to customize executive insights output
        })
      });

      const res = await resp.json();
      if (res.success) {
        setAiReport(res.report);
      } else {
        setAiError(res.error || "Yapay zeka analizi oluşturulamadı. Lütfen sunucu bağlantısını doğrulayın.");
      }
    } catch (err: any) {
      setAiError(err.message || "Bilinmeyen sunucu bağlantı hatası.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const assignedAssessorId = activeAssessment?.assessorAssignments?.[selectedCategoryId] || currentUser?.id || "";
  const hasPermission = activeAssessment ? (currentAssessorId === assignedAssessorId || activeAssessment.status === "completed") : true;

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-500 text-white p-2 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">OpEx Assessment Modülü</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                6 Aylık Değerlendirme & Gelişim Aşamaları (OpexAssessmentListe)
              </p>
            </div>
          </div>
        </div>

        {/* Audit Select and Creation Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {assessments.length > 0 && !isCreating && (
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Seçili Değerlendirme:</span>
              <select
                className="text-xs font-bold text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer"
                value={activeAssessment?.id || ""}
                onChange={(e) => handleSelectAssessment(e.target.value)}
              >
                {assessments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.auditName} ({a.status === "completed" ? a.overallScore : "Taslak"}) - {new Date(a.auditDate).toLocaleDateString("tr-TR")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowQuestionBank(v => !v)}
              className={`text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer ${
                showQuestionBank ? "bg-purple-700 text-white" : "bg-white border border-purple-200 text-purple-700 hover:bg-purple-50"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Soru Bankası</span>
            </button>
          )}

          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Denetim Başlat</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCreating(false)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Formu Kapat
            </button>
          )}
        </div>
      </div>

      {/* DETAILED AUDIT CREATION FORM CARD */}
      {isCreating && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs transition-all duration-300">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
            <Plus className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-tight">Yeni OpEx Denetimi Ekle</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Otomatik denetim sıra no ve tarih ataması ile iş birliği odaklı değerlendirme formu</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-extrabold uppercase block">Denetim No / Sıra No</label>
              <div className="w-full text-xs font-black bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-500">
                Denetim No: #{assessments.filter(a => a.customerId === selectedCustomer?.id).length + 1} (Otomatik Atandı)
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-extrabold uppercase block">Denetim Tarihi</label>
              <div className="w-full text-xs font-black bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-500">
                {new Date().toLocaleDateString("tr-TR")} (Otomatik Atandı)
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-extrabold uppercase block">Denetim Başlığı / Adı</label>
              <input
                type="text"
                placeholder="Örn: OPEX Denetim no 1"
                className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-400 text-slate-800"
                value={newAuditName}
                onChange={(e) => setNewAuditName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-extrabold uppercase block">Uygulayıcı Firmadan Katılımcılar (Denetçiler)</label>
              <input
                type="text"
                placeholder="İsim Soyisim giriniz (Örn: Atakan Zehir, Caner Yılmaz)"
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-400 text-slate-800"
                value={newAssessorParticipants}
                onChange={(e) => setNewAssessorParticipants(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-extrabold uppercase block">Denetlenen Firmadan Katılımcılar (Fabrika Ekibi)</label>
              <input
                type="text"
                placeholder="İsim Soyisim giriniz (Örn: Murat Öztürk, Elif Yılmaz)"
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-400 text-slate-800"
                value={newCustomerParticipants}
                onChange={(e) => setNewCustomerParticipants(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-extrabold uppercase block">Denetim Hedef Puanı (0-100)</label>
              <select
                className="w-full text-xs font-black bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-400 text-slate-800 cursor-pointer"
                value={creationTargetScore}
                onChange={(e) => setCreationTargetScore(Number(e.target.value))}
              >
                <option value={45}>45 (Sınıf B Olgunluk Hedefi)</option>
                <option value={70}>70 (Sınıf A Mükemmellik Hedefi)</option>
                <option value={30}>30 (Aşama 1 Başlangıç Hedefi)</option>
                <option value={50}>50 (Aşama 2 Kurulum Hedefi)</option>
                <option value={80}>80 (Sürdürülebilirlik Hedefi)</option>
              </select>
            </div>
          </div>

          {/* HEDEF PUAN BELİRLEME (ÖN DEĞERLENDİRME) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-3xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight mb-0.5">HEDEF PUAN BELİRLEME PANELİ (ÖN DEĞERLENDİRME)</h4>
              <p className="text-[10px] text-slate-500 font-medium">Aşağıdaki 6 kritik ön değerlendirme sorusuna göre tesisin hedef sınıfı ve hedef olgunluk puanı belirlenir. Toplam puan 0-20 ise Sınıf B, 21-30 ise Sınıf A hedeflenir.</p>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                    <th className="p-3 text-center w-12">NO</th>
                    <th className="p-3">SORU</th>
                    <th className="p-3 text-center w-28">AĞIRLIK PUANI</th>
                    <th className="p-3 text-center w-28">CEVAP (0/1)</th>
                    <th className="p-3 text-center w-28">SONUÇ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {TARGET_PRE_QUESTIONS.map((qText, idx) => {
                    const currentAnswer = creationPreAnswers[idx] !== undefined ? creationPreAnswers[idx] : 1;
                    const resultVal = currentAnswer * 5;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center font-mono font-bold text-slate-400 border-r border-slate-100">{idx + 1}</td>
                        <td className="p-3 text-slate-800 text-[11px] leading-relaxed max-w-[400px] font-bold uppercase">{qText}</td>
                        <td className="p-3 text-center font-mono font-extrabold text-slate-500 border-l border-r border-slate-100">5</td>
                        <td className="p-3 text-center border-r border-slate-100 w-28">
                          <select
                            value={currentAnswer}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const newAnswers = [...creationPreAnswers];
                              newAnswers[idx] = val;
                              setCreationPreAnswers(newAnswers);
                              
                              // Automatically set target score based on category
                              const metrics = getPreAssessmentMetrics(newAnswers);
                              setCreationTargetScore(metrics.targetPct);
                            }}
                            className="text-xs font-black text-slate-900 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                          >
                            <option value={0}>0 (Hayır)</option>
                            <option value={1}>1 (Evet)</option>
                          </select>
                        </td>
                        <td className="p-3 text-center font-mono font-black text-slate-900 bg-slate-50/40 w-28">{resultVal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Live creation metrics feedback */}
            {(() => {
              const metrics = getPreAssessmentMetrics(creationPreAnswers);
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-150">
                    <span className="text-[11px] text-slate-400 font-bold block uppercase">ÖN DEĞERLENDİRME TOPLAMI</span>
                    <span className="text-lg font-black text-slate-800 font-mono">{metrics.totalScore} / 30</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-150">
                    <span className="text-[11px] text-slate-400 font-bold block uppercase">HEDEF SINIFI</span>
                    <span className={`text-lg font-black font-mono uppercase ${metrics.category === "A" ? "text-emerald-700" : "text-amber-700"}`}>
                      SINIF {metrics.category}
                    </span>
                  </div>
                  <div className="bg-[#2f5597]/5 rounded-xl p-3 text-center border border-[#2f5597]/20">
                    <span className="text-[11px] text-[#2f5597] font-extrabold block uppercase">OTOMATİK HEDEF PUANI</span>
                    <span className="text-lg font-black text-[#2f5597] font-mono">{metrics.targetPct}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* DENETİM MADDE / SORUMLU ATAMALARI */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-3xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight mb-0.5">DENETİM MADDE ATAMA VE SORUMLULUK PANELİ</h4>
              <p className="text-[10px] text-slate-500 font-medium">Lütfen denetim öncesinde her bir opex maddesi / kategorisi için ilgili sorumlu denetçiyi seçin. Sorumlu denetçiler sisteme giriş yaptıklarında yalnızca kendi maddelerini değerlendirebileceklerdir.</p>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                    <th className="p-3 text-center w-24">KATEGORİ KODU</th>
                    <th className="p-3">KATEGORİ ADI</th>
                    <th className="p-3">YENİ DENETÇİ (ATANAN)</th>
                    <th className="p-3">ATANMIŞ DENETÇİ DURUMU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {categories.map((cat) => {
                    const assignedAssessorId = creationAssignments[cat.id] || currentUser?.id || "";
                    const assignedName = assessorsList.find(a => a.id === assignedAssessorId)?.name || "Atanmadı";
                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-black text-slate-900 text-center w-24 bg-slate-50/20">{cat.id}</td>
                        <td className="p-3 text-slate-800 text-[11px] font-black uppercase">{cat.name}</td>
                        <td className="p-3 w-56">
                          <select
                            value={assignedAssessorId}
                            onChange={(e) => {
                              const newAssigns = { ...creationAssignments, [cat.id]: e.target.value };
                              setCreationAssignments(newAssigns);
                            }}
                            className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer w-full"
                          >
                            {assessorsList.map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 w-48">
                          <span className="inline-flex items-center space-x-1 bg-purple-50 text-purple-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-purple-100">
                            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                            <span>{assignedName}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-200 justify-end">
            <button
              onClick={() => setIsCreating(false)}
              className="text-slate-500 hover:bg-slate-100 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              onClick={handleCreateAssessment}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Denetimi Başlat ve Kaydet</span>
            </button>
          </div>
        </div>
      )}

      {/* ADMIN: SORU BANKASI / AĞIRLIK YÖNETİMİ — independent of any specific audit; edits here
          apply to the shared question bank used by every future denetim. */}
      {isAdmin && showQuestionBank && (
        <div className="bg-white border border-purple-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
            <BookOpen className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-tight">Soru Bankası / Ağırlık Yönetimi</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Her kategorinin soru ağırlıkları toplamı normalde 20'dir (5 puanlık skala × 20 = 100 net kategori puanı). Toplam 20'den farklıysa kırmızı ile işaretlenir.
              </p>
            </div>
          </div>

          {isQuestionBankLoading ? (
            <p className="text-xs text-slate-400 font-bold text-center py-6">Yükleniyor...</p>
          ) : (
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              {categories.map(cat => {
                const catQuestions = questions.filter(q => q.categoryId === cat.id);
                const weightSum = Math.round(catQuestions.reduce((s, q) => s + q.weight, 0) * 100) / 100;
                const isBalanced = weightSum === 20;
                return (
                  <div key={cat.id} className="border border-slate-150 rounded-xl overflow-hidden">
                    <div className={`flex items-center justify-between px-4 py-2.5 ${isBalanced ? "bg-slate-50" : "bg-red-50"}`}>
                      <span className="text-xs font-black text-slate-800 uppercase">{cat.id} - {cat.name}</span>
                      <span className={`text-xs font-mono font-black ${isBalanced ? "text-slate-500" : "text-red-600"}`}>
                        Toplam Ağırlık: {weightSum} {!isBalanced && "(20 olmalı)"}
                      </span>
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                      <tbody className="divide-y divide-slate-100">
                        {catQuestions.map(q => (
                          <tr key={q.id}>
                            <td className="p-2.5 w-16 font-mono font-bold text-slate-500 align-top">{q.id}</td>
                            <td className="p-2.5 space-y-1.5 align-top">
                              <input
                                type="text"
                                defaultValue={q.subject}
                                disabled={questionBankSaving === q.id}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val && val !== q.subject) handleUpdateQuestionField(q, { subject: val });
                                }}
                                className="w-full text-slate-800 font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-purple-400"
                                placeholder="Soru başlığı"
                              />
                              <textarea
                                defaultValue={q.idealState}
                                disabled={questionBankSaving === q.id}
                                rows={2}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val && val !== q.idealState) handleUpdateQuestionField(q, { idealState: val });
                                }}
                                className="w-full text-slate-500 font-normal bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 resize-y focus:outline-none focus:border-purple-400"
                                placeholder="İdeal durum / soru metni"
                              />
                            </td>
                            <td className="p-2.5 w-28 text-right align-top">
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                defaultValue={q.weight}
                                disabled={questionBankSaving === q.id}
                                onBlur={(e) => {
                                  const val = Number(e.target.value);
                                  if (val !== q.weight) handleUpdateQuestionWeight(q, val);
                                }}
                                className="w-20 text-xs font-black text-purple-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right focus:outline-none focus:border-purple-400"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TABS SWITCHER */}
      {activeAssessment && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-tight border transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === "summary"
                ? "bg-[#2f5597] text-white border-[#2f5597] shadow-xs"
                : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Denetim Özeti</span>
          </button>
          <button
            onClick={() => setActiveTab("target")}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-tight border transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === "target"
                ? "bg-[#2f5597] text-white border-[#2f5597] shadow-xs"
                : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50"
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Hedef Puan Belirleme</span>
          </button>
          <button
            onClick={() => setActiveTab("assignment")}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-tight border transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === "assignment"
                ? "bg-[#2f5597] text-white border-[#2f5597] shadow-xs"
                : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Sorumlu Atama</span>
          </button>
          <button
            onClick={() => setActiveTab("evaluate")}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-tight border transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === "evaluate"
                ? "bg-[#2f5597] text-white border-[#2f5597] shadow-xs"
                : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Değerlendirme Formu</span>
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-tight border transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === "report"
                ? "bg-[#2f5597] text-white border-[#2f5597] shadow-xs"
                : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Genel Analiz Raporu (Power BI)</span>
          </button>
        </div>
      )}

      {/* NO ASSESSMENT EMPTY STATE */}
      {!activeAssessment && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 shadow-xs text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-bold text-gray-900">Değerlendirme Verisi Bulunmuyor</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {selectedCustomer?.companyName} için henüz kayıtlı OpEx değerlendirme denetimi bulunmuyor. Üstteki panelden hemen yeni bir denetim başlatarak ilk değerlendirmeyi tamamlayabilirsiniz.
            </p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-slate-950 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>İlk Denetimi Başlat</span>
          </button>
        </div>
      )}

      {/* SUMMARY TAB CONTENT */}
      {activeAssessment && activeTab === "summary" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          
          {/* LEFT/CENTER COLUMN: CATEGORIES TABLE (2/3 width on large screen) */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-[#2f5597] text-white border-b-2 border-slate-200">
                  <th className="p-3 font-extrabold text-left uppercase text-xs tracking-wider">KATEGORİ</th>
                  <th className="p-3 font-extrabold text-center uppercase text-xs tracking-wider w-28">HEDEF</th>
                  <th className="p-3 font-extrabold text-center uppercase text-xs tracking-wider w-28">SONUÇ</th>
                  <th className="p-3 font-extrabold text-center uppercase text-xs tracking-wider w-36">İLERLEME / DURUM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                {categories.map(cat => {
                  const stats = categoryProgress[cat.id] || { answered: 0, total: 0, average: 0 };
                  const targetScore = activeAssessment.targetScores?.[cat.id];
                  const hasTarget = targetScore !== undefined;
                  const targetPct = hasTarget ? Math.round(targetScore) : 0;
                  const resultPct = Math.round(activeAssessment.categoryScores[cat.id] || 0);

                  // Status check
                  let statusText = "";
                  let statusColor = "";
                  if (stats.answered === stats.total) {
                    statusText = "Tamamlandı";
                    statusColor = "text-emerald-700 bg-emerald-50 border-emerald-100";
                  } else if (stats.answered > 0) {
                    statusText = `${stats.answered}/${stats.total} Soru`;
                    statusColor = "text-amber-700 bg-amber-50 border-amber-100";
                  } else {
                    statusText = "Başlanmadı";
                    statusColor = "text-slate-400 bg-slate-50 border-slate-100";
                  }
                  
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-left border-r border-slate-200 font-extrabold uppercase text-slate-800 text-[11px] leading-relaxed">
                        {cat.id} - {cat.name}
                      </td>
                      <td className="p-3 text-center border-r border-slate-200 font-black text-slate-900 font-mono text-sm bg-slate-50/30">
                        {hasTarget ? targetPct : "—"}
                      </td>
                      <td className={`p-3 text-center border-r border-slate-200 font-black font-mono text-sm ${hasTarget && resultPct >= targetPct ? "text-emerald-600 bg-emerald-50/20" : "text-slate-800 bg-slate-50/10"}`}>
                        {resultPct}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`inline-flex items-center text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${statusColor}`}>
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* RIGHT COLUMN: PUAN & SİSTEM SEVİYESİ CARDS (1/3 width on large screen) */}
          <div className="space-y-6">
            
            {/* DENETİM PUANI CARD */}
            <div className="border-2 border-[#2f5597] rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-[#2f5597] text-white text-center py-3 font-extrabold tracking-wider text-xs uppercase border-b-2 border-white">
                DENETİM PUANI
              </div>
              <div className={`${getSystemLevelTone(activeAssessment.overallScore).bg} ${getSystemLevelTone(activeAssessment.overallScore).text} text-center py-6`}>
                <span className="text-4xl font-black font-mono">
                  {activeAssessment.overallScore}
                </span>
                <span className="text-xs font-bold block mt-1 opacity-80">
                  Genel Olgunluk Oranı
                </span>
              </div>
            </div>

            {/* SİSTEM SEVİYESİ CARD */}
            <div className="border-2 border-[#2f5597] rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-[#2f5597] text-white text-center py-3 font-extrabold tracking-wider text-xs uppercase border-b-2 border-white">
                SİSTEM SEVİYESİ
              </div>
              <div className={`${getSystemLevelTone(activeAssessment.overallScore).bg} ${getSystemLevelTone(activeAssessment.overallScore).text} text-center py-6`}>
                <span className="text-2xl font-black tracking-tight block uppercase">
                  {getSystemLevelText(activeAssessment.overallScore)}
                </span>
                <span className="text-xs font-bold block mt-1 opacity-80">
                  Saha Kültür Olgunluk Sınıfı
                </span>
              </div>
            </div>

            {/* ACTION BUTTON: RAPOR OLUŞTUR */}
            <button
              onClick={() => setActiveTab("report")}
              className="w-full bg-[#595959] hover:bg-[#4d4d4d] text-white font-extrabold text-sm py-4 rounded-xl shadow-md transition-all cursor-pointer text-center uppercase tracking-wider flex items-center justify-center space-x-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>Rapor Oluştur</span>
            </button>

            {/* COLLABORATIVE AUDIT SUMMARY / ASSESSORS ASSIGNED */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-3xs">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Denetçi İş Birliği Detayları</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-bold text-slate-500">Denetim No:</span>
                  <span className="font-black text-slate-800">#{activeAssessment.auditNo || 1}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-bold text-slate-500">Uygulayıcı Ekip:</span>
                  <span className="font-semibold text-slate-800 text-right max-w-[180px] truncate">{activeAssessment.assessorParticipants || "Atakan Zehir"}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="font-bold text-slate-500">Fabrika Karşılayıcı Ekip:</span>
                  <span className="font-semibold text-slate-800 text-right max-w-[180px] truncate">{activeAssessment.customerParticipants || "Saha Sorumluları"}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="font-bold text-slate-500">Kilitlenme Durumu:</span>
                  <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-full border ${activeAssessment.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-orange-50 text-orange-700 border-orange-100"}`}>
                    {activeAssessment.status === "completed" ? "Kilitli (Kesinleşti)" : "Taslak"}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* EVALUATE TAB CONTENT */}
      {activeAssessment && activeTab === "evaluate" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* LEFT COLUMN: Categories Sidebar List */}
            <div className="hidden lg:block lg:col-span-1 bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase">İnceleme Konuları</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">18 Kritik Kategori</p>
              </div>
              
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {displayedCategories.map(cat => {
                  const stats = categoryProgress[cat.id] || { answered: 0, total: 0, average: 0 };
                  const isSelected = selectedCategoryId === cat.id;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer border flex flex-col justify-between gap-1 group ${
                        isSelected
                          ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                          : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <span className="text-[11px] font-black uppercase tracking-wide group-hover:translate-x-0.5 transition-all">
                          {cat.id} - {cat.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between w-full mt-1.5">
                        {/* Completed / Total ratio progress */}
                        <span className={`text-[11px] font-mono font-bold ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                          {stats.answered}/{stats.total} Soru
                        </span>

                        {/* Average score badge */}
                        {stats.answered > 0 && (
                          <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-md ${
                            isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                          }`}>
                            Ort: {stats.average.toFixed(1)}/5
                          </span>
                        )}
                      </div>

                      {/* Progress Bar background */}
                      <div className="w-full bg-slate-200/50 rounded-full h-1 mt-1 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isSelected ? "bg-emerald-400" : "bg-emerald-500"
                          }`}
                          style={{ width: `${(stats.answered / stats.total) * 100}%` }}
                        ></div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Assessment Lock Card */}
              {activeAssessment.status === "draft" ? (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 space-y-2.5 mt-4">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-orange-700 font-bold leading-normal">
                      Bu değerlendirme şu anda taslak durumundadır. Cevapları doldurduktan sonra aşağıdaki butona tıklayarak denetimi sonlandırabilirsiniz.
                    </p>
                  </div>
                  <button
                    onClick={handleCompleteAudit}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Denetimi Bitir ve Kilitle</span>
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-4 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[10px] text-slate-600 font-extrabold uppercase">Bu Denetim Kilitlenmiştir</span>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Active Category Questions list */}
            <div className="col-span-1 lg:col-span-3 space-y-5">
              
              {/* MOBILE/TABLET RESPONSIVE DROPDOWN CATEGORY SELECTOR */}
              <div className="block lg:hidden bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">Kategori Seçin</label>
                  <label className="flex items-center space-x-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterAssignedOnly}
                      onChange={(e) => setFilterAssignedOnly(e.target.checked)}
                      className="w-3 h-3 text-slate-900 rounded focus:ring-slate-500 border-slate-300"
                    />
                    <span className="text-[11px] font-bold text-slate-500">Bana Atananları Filtrele</span>
                  </label>
                </div>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer"
                >
                  {displayedCategories.map(cat => {
                    const stats = categoryProgress[cat.id] || { answered: 0, total: 0, average: 0 };
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.id} - {cat.name} ({stats.answered}/{stats.total} Soru, Ort: {stats.average.toFixed(1)}/5)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* DYNAMIC AUDIT PARTICIPANTS DETAILS STRIP */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] font-black text-slate-400 block uppercase tracking-wider">UYGULAYICI FİRMA KATILIMCILARI (DENETÇİLER)</span>
                  <span className="font-extrabold text-slate-800">{activeAssessment.assessorParticipants || "Tanımlanmadı"}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-black text-slate-400 block uppercase tracking-wider">DENETLENEN FİRMA KATILIMCILARI (FABRİKA EKİBİ)</span>
                  <span className="font-extrabold text-slate-800">{activeAssessment.customerParticipants || "Tanımlanmadı"}</span>
                </div>
              </div>

              {/* MULTI-ASSESSOR COLLABORATION & USER SIMULATOR */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 block uppercase">Denetçi İş Birliği Paneli (Simülasyon)</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-700">Mevcut Çalışan Denetçi:</span>
                      <select
                        value={currentAssessorId}
                        onChange={(e) => setCurrentAssessorId(e.target.value)}
                        className="text-xs font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
                      >
                        {assessorsList.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterAssignedOnly}
                        onChange={(e) => setFilterAssignedOnly(e.target.checked)}
                        className="w-3.5 h-3.5 text-slate-900 rounded focus:ring-slate-500 border-slate-300"
                      />
                      <span className="text-[11px] font-extrabold text-slate-600">Yalnızca Bana Atananları Listele</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1 text-left md:text-right">
                  <span className="text-[10px] font-black text-slate-400 block uppercase">Bölüm Sorumlusu</span>
                  <div className="flex items-center space-x-2 justify-start md:justify-end">
                    <span className="text-xs font-extrabold text-purple-700">
                      {assessorsList.find(a => a.id === assignedAssessorId)?.name || "Atanamadı"}
                    </span>
                    {activeAssessment.status !== "completed" && (
                      <select
                        value={assignedAssessorId}
                        onChange={(e) => handleAssessorAssignmentChange(selectedCategoryId, e.target.value)}
                        className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 focus:outline-none cursor-pointer"
                      >
                        {assessorsList.map(a => (
                          <option key={a.id} value={a.id}>Sorumlu Ata: {a.name.split(" ")[0]}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* TARGET SETTING (HEDEF BELİRLEME) PANEL FOR FIRST AUDITS AND TOGGLE */}
              <div className="bg-purple-50/50 border border-purple-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="flex items-start space-x-2">
                    <Target className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-black text-purple-950 uppercase tracking-tight">Hedef Belirleme & Ön Değerlendirme Formu</h3>
                      <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">
                        {activeAssessment.auditNo === 1 
                          ? "Firma ilk denetime girdiğinden dolayı hedef olgunluk seviyeleri tanımlanmalıdır." 
                          : "Gelişim aşamaları ve süreç olgunluk hedeflerini buradan takip edebilirsiniz."}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTargetPanel(!showTargetPanel)}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    {showTargetPanel ? "Hedef Tablosunu Gizle" : "Hedef Tablosunu Göster"}
                  </button>
                </div>

                {showTargetPanel && (
                  <div className="bg-white border border-purple-100 rounded-xl p-4 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-purple-100 text-purple-400 font-black text-[11px] uppercase tracking-wider">
                          <th className="py-2.5">KOD & SÜREÇ ALANI</th>
                          <th className="py-2.5">HEDEF PUAN (0-100)</th>
                          <th className="py-2.5 text-center">ÖNCELİKLİ ALAN</th>
                          <th className="py-2.5">STRATEJİK YOL HARİTASI PLAN NOTU</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map(cat => {
                          const targetScore = activeAssessment.targetScores?.[cat.id];
                          const isPriority = !!(activeAssessment.targetPriorities?.[cat.id]);
                          const note = (activeAssessment.targetNotes?.[cat.id]) || "";

                          return (
                            <tr key={cat.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="py-2 font-bold text-slate-800">
                                {cat.id} - {cat.name}
                              </td>
                              <td className="py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={5}
                                  disabled={activeAssessment.status === "completed"}
                                  value={targetScore ?? ""}
                                  placeholder="Belirlenmedi"
                                  onChange={(e) => handleTargetScoreChange(cat.id, e.target.value === "" ? 0 : Number(e.target.value))}
                                  className="w-24 text-xs font-black text-purple-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                                />
                              </td>
                              <td className="py-2 text-center">
                                <input
                                  type="checkbox"
                                  disabled={activeAssessment.status === "completed"}
                                  checked={isPriority}
                                  onChange={(e) => handleTargetPriorityChange(cat.id, e.target.checked)}
                                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-200 cursor-pointer"
                                />
                              </td>
                              <td className="py-2">
                                <input
                                  type="text"
                                  disabled={activeAssessment.status === "completed"}
                                  placeholder="Örn: Yalın standartların takibi ve eğitimi"
                                  value={note}
                                  onChange={(e) => handleTargetNoteChange(cat.id, e.target.value)}
                                  onBlur={() => handleSaveDraft()}
                                  className="w-full text-xs bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-semibold focus:outline-none focus:border-purple-400"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* SECURITY / PERMISSION WARNING OVERLAY FOR CO-AUDITING */}
              {!hasPermission && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start space-x-2.5 text-xs shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-extrabold uppercase text-[10px] text-rose-900 block tracking-wider">Salt Okunur Mod (Erişim Kısıtlı)</span>
                    <p className="leading-relaxed font-semibold">
                      Bu bölüm ({selectedCategoryId} - {categories.find(c => c.id === selectedCategoryId)?.name}), <strong>{assessorsList.find(a => a.id === assignedAssessorId)?.name}</strong> denetçisine atanmıştır.
                      Şu an simüle edilen kullanıcı <strong>{assessorsList.find(a => a.id === currentAssessorId)?.name}</strong> olduğundan puanlama yapamazsınız. Sağ üstteki panelden aktif denetçiyi değiştirebilirsiniz.
                    </p>
                  </div>
                </div>
              )}

              {/* Active Category Banner */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono">AKTİF İNCELEME KATEGORİSİ</span>
                  <h2 className="text-base font-extrabold uppercase tracking-tight mt-0.5">
                    {selectedCategoryId} - {categories.find(c => c.id === selectedCategoryId)?.name}
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Toplam Ağırlık</span>
                  <span className="text-lg font-black font-mono text-emerald-400">
                    {categories.find(c => c.id === selectedCategoryId)?.weight}
                  </span>
                </div>
              </div>

            {/* Questions Cards container */}
            <div className="space-y-4">
              {currentCategoryQuestions.map((q, idx) => {
                const currentScore = activeAssessment.answers[q.id] !== undefined ? activeAssessment.answers[q.id] : -1;
                const isCompleted = activeAssessment.status === "completed";

                return (
                  <div 
                    key={q.id}
                    className={`bg-white border rounded-2xl p-5 shadow-xs space-y-4 transition-all hover:border-slate-300 ${
                      currentScore >= 0 
                        ? "border-l-4 border-l-emerald-500" 
                        : currentScore === -2
                        ? "border-l-4 border-l-orange-500 bg-orange-50/20"
                        : "border-l-4 border-l-slate-200"
                    }`}
                  >
                    {/* ID, subject, weight header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-50 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="bg-slate-100 text-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md font-mono">
                            {q.id}
                          </span>
                          <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                            {q.subject}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-2 leading-relaxed">
                          {q.idealState}
                        </h4>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">AĞIRLIK:</span>
                        <span className="text-xs font-black text-slate-700 font-mono">{q.weight}</span>
                      </div>
                    </div>

                    {/* SCORE SELECTOR AND RUBRICS */}
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">SAHA PUAN TESPİTİ (0-5 VEYA N/A)</span>
                        
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[0, 1, 2, 3, 4, 5].map(score => {
                            const isSelected = currentScore === score;
                            return (
                              <button
                                key={score}
                                disabled={isCompleted}
                                onClick={() => handleScoreSelect(q.id, score)}
                                className={`w-10 h-10 rounded-xl text-sm font-black font-mono flex items-center justify-center border transition-all ${
                                  isCompleted ? "cursor-not-allowed opacity-65" : "cursor-pointer"
                                } ${
                                  isSelected
                                    ? "bg-slate-900 border-slate-900 text-white scale-105 shadow-xs"
                                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                }`}
                              >
                                {score}
                              </button>
                            );
                          })}

                          {/* N/A Scoring option button */}
                          <button
                            disabled={isCompleted}
                            onClick={() => handleScoreSelect(q.id, -2)}
                            className={`px-3.5 h-10 rounded-xl text-xs font-black transition-all border ${
                              isCompleted ? "cursor-not-allowed opacity-65" : "cursor-pointer"
                            } ${
                              currentScore === -2
                                ? "bg-orange-600 border-orange-600 text-white scale-105 shadow-xs"
                                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            N/A
                          </button>
                        </div>
                      </div>

                      {/* Editable Rubric / Score Determination Text Box */}
                      {currentScore >= 0 && (
                        <div className="bg-amber-50/55 border border-amber-200/80 rounded-xl p-3.5 space-y-1.5">
                          <span className="font-black text-amber-950 block text-[11px] uppercase tracking-wider">
                            Skor Tespit Tanımı (Özelleştirilebilir, Saha Tespitini Düzenleyin):
                          </span>
                          <textarea
                            disabled={isCompleted}
                            rows={2}
                            className="w-full text-xs bg-white border border-amber-200 focus:outline-none focus:border-amber-400 rounded-lg p-2.5 font-semibold text-amber-900 shadow-3xs leading-relaxed"
                            value={
                              (activeAssessment.customRubrics && activeAssessment.customRubrics[`${q.id}_${currentScore}`]) !== undefined
                                ? activeAssessment.customRubrics[`${q.id}_${currentScore}`]
                                : q.rubric[currentScore] || ""
                            }
                            onChange={(e) => handleCustomRubricChange(q.id, currentScore, e.target.value)}
                            onBlur={() => handleSaveDraft(undefined, undefined, undefined)}
                            placeholder="Bu skor seviyesi için saha tespit kriterlerini özelleştirin..."
                          />
                        </div>
                      )}

                      {currentScore === -2 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 leading-relaxed font-semibold italic">
                          Bu kriter denetim kapsamı dışı (N/A) bırakılmıştır. Skor hesaba ve bölüm ortalamasına katılmayacaktır.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* GENEL BÖLÜM DEĞERLENDİRMESİ CARD */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>Genel Bölüm Değerlendirmesi ({selectedCategoryId})</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Bu bölümle ilgili genel tespitler, güçlü/zayıf noktalar ve iyileştirme tavsiyeleri
                    </p>
                  </div>
                  
                  {/* AI Assistant Button */}
                  {activeAssessment.status !== "completed" && (
                    <button
                      onClick={() => handleAnalyzeCategory(selectedCategoryId)}
                      disabled={aiCategoryLoading === selectedCategoryId}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>{aiCategoryLoading === selectedCategoryId ? "Analiz Ediliyor..." : "AI Değerlendirmesi Üret (3 Cümle)"}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <textarea
                    disabled={activeAssessment.status === "completed"}
                    rows={4}
                    className="w-full text-xs bg-white border border-slate-200 focus:outline-none focus:border-slate-400 rounded-xl p-3 placeholder-slate-400 font-semibold text-slate-700 leading-relaxed shadow-xs"
                    placeholder="Bölüme dair genel tespitlerinizi buraya yazın veya üstteki AI butonuna basarak anket puanlarına göre otomatik 3 cümlelik klinik değerlendirme raporu oluşturun..."
                    value={(activeAssessment.categoryComments && activeAssessment.categoryComments[selectedCategoryId]) || ""}
                    onChange={(e) => handleCategoryCommentChange(selectedCategoryId, e.target.value)}
                    onBlur={() => handleSaveDraft(undefined, undefined, activeAssessment.categoryComments)}
                  />
                  
                  {/* AI Info Tip */}
                  <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-bold uppercase">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>Yapay zeka asistanı, bu kategorideki her soruya verdiğiniz puanları ve saha notlarını analiz ederek 3 cümlelik teknik yorum üretir.</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TARGET TAB CONTENT */}
      {activeAssessment && activeTab === "target" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-6 space-y-6">
          {/* Header Info Banner like the Lavender layout in screenshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-extrabold block uppercase">Mevcut Denetim Detayları</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-bold text-slate-700">
                <span>Firma: <strong className="text-slate-950 font-black uppercase">{selectedCustomer?.companyName}</strong></span>
                <span className="text-slate-300">|</span>
                <span>Denetleme: <strong className="text-slate-950 font-black">OPEX</strong></span>
                <span className="text-slate-300">|</span>
                <span>Denetim No: <strong className="text-slate-950 font-black">#{activeAssessment.auditNo || 1}</strong></span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold block uppercase md:text-right">Durum</span>
              <span className={`inline-flex items-center space-x-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${activeAssessment.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-orange-50 text-orange-700 border-orange-100"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeAssessment.status === "completed" ? "bg-emerald-500" : "bg-orange-500 animate-pulse"}`}></span>
                <span>{activeAssessment.status === "completed" ? "Kilitlendi" : "Devam Ediyor"}</span>
              </span>
            </div>
          </div>

          {/* Title Area */}
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-[#2f5597] uppercase tracking-tight">HEDEF PUAN BELİRLEME FORMU (ÖN DEĞERLENDİRME)</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aşağıdaki 6 kritik soruyu Evet (1) veya Hayır (0) olarak cevaplayarak fabrikanın ana hedef sınıfını (A veya B Sınıfı) belirleyin.</p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#2f5597] text-white border-b-2 border-slate-200 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="p-4 w-12 text-center">NO</th>
                  <th className="p-4">SORU</th>
                  <th className="p-4 text-center w-36">AĞIRLIK PUANI</th>
                  <th className="p-4 text-center w-36">PUAN (0/1)</th>
                  <th className="p-4 text-center w-36">SONUÇ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                {(() => {
                  const preAnswers = activeAssessment.targetPreAnswers || [1, 1, 1, 1, 1, 1];
                  const { results, totalScore, category, targetPct } = getPreAssessmentMetrics(preAnswers);

                  return (
                    <>
                      {TARGET_PRE_QUESTIONS.map((qText, idx) => {
                        const currentAnswer = preAnswers[idx] !== undefined ? preAnswers[idx] : 1;
                        const resultVal = results[idx];
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-center font-mono font-bold text-slate-400 border-r border-slate-100">{idx + 1}</td>
                            <td className="p-4 text-slate-800 text-[11px] leading-relaxed max-w-[450px] font-bold uppercase">{qText}</td>
                            <td className="p-4 text-center font-mono font-extrabold text-slate-500 border-l border-r border-slate-100">5</td>
                            <td className="p-4 text-center border-r border-slate-100">
                              <select
                                disabled={activeAssessment.status === "completed"}
                                value={currentAnswer}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const currentPreAnswers = [...preAnswers];
                                  currentPreAnswers[idx] = val;
                                  
                                  const metrics = getPreAssessmentMetrics(currentPreAnswers);
                                  const targetVal = metrics.targetPct; // already a 0-100 net number

                                  const updatedTargetScores = { ...(activeAssessment.targetScores || {}) };
                                  const updatedTargetNotes = { ...(activeAssessment.targetNotes || {}) };
                                  categories.forEach(c => {
                                    updatedTargetScores[c.id] = targetVal;
                                    updatedTargetNotes[c.id] = `Hedef sınıfı belirlendi: ${targetVal}`;
                                  });

                                  const updatedAssessment: Assessment = {
                                    ...activeAssessment,
                                    targetPreAnswers: currentPreAnswers,
                                    targetScores: updatedTargetScores,
                                    targetNotes: updatedTargetNotes
                                  };
                                  setActiveAssessment(updatedAssessment);
                                  handleSaveDraft(undefined, undefined, undefined, updatedAssessment);
                                }}
                                className="text-xs font-black text-slate-900 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer"
                              >
                                <option value={0}>0 (Hayır)</option>
                                <option value={1}>1 (Evet)</option>
                              </select>
                            </td>
                            <td className="p-4 text-center font-mono font-black text-slate-900 bg-slate-50/40 text-sm">{resultVal}</td>
                          </tr>
                        );
                      })}

                      {/* Footer Summary Blocks */}
                      <tr className="bg-slate-100 font-extrabold uppercase">
                        <td colSpan={2} className="p-4 text-right text-slate-500 text-[10px] tracking-wider border-r border-slate-200">
                          DEĞERLENDİRME TOPLAMI:
                        </td>
                        <td className="p-4 text-center font-mono text-sm text-slate-600 border-r border-slate-200">
                          30 (Maks)
                        </td>
                        <td className="p-4 bg-slate-200/50 text-center font-mono text-sm text-slate-950 border-r border-slate-200">
                          {preAnswers.reduce((a, b) => a + b, 0)} / 6
                        </td>
                        <td className="p-4 text-center font-mono text-lg text-emerald-700 bg-emerald-50">
                          {totalScore}
                        </td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Bottom KPI summary row matching screenshot */}
          {(() => {
            const preAnswers = activeAssessment.targetPreAnswers || [1, 1, 1, 1, 1, 1];
            const { totalScore, category, targetPct } = getPreAssessmentMetrics(preAnswers);

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                {/* Total score panel */}
                <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-1">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">TOPLAM PUAN</span>
                  <span className="text-3xl font-black text-slate-900 font-mono">{totalScore}</span>
                  <span className="text-[11px] text-slate-400 font-bold uppercase">(6 Soru x Ağırlık 5)</span>
                </div>

                {/* Category panel */}
                <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-1">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">KATEGORİ</span>
                  <span className={`text-3xl font-black font-mono ${category === "A" ? "text-emerald-700" : "text-amber-700"}`}>
                    Sınıf {category}
                  </span>
                  <span className="text-[11px] text-slate-400 font-bold uppercase">(0-20 Sınıf B, 21-30 Sınıf A)</span>
                </div>

                {/* Target Score panel */}
                <div className="border-2 border-[#2f5597] rounded-2xl p-5 bg-blue-50/30 flex flex-col items-center justify-center text-center space-y-1">
                  <span className="text-[10px] text-[#2f5597] font-black uppercase tracking-wider">BELİRLENEN HEDEF ORAN</span>
                  <span className="text-3xl font-black text-[#2f5597] font-mono">{targetPct}</span>
                  <span className="text-[11px] text-slate-500 font-extrabold uppercase">
                    ({category === "B" ? "Sınıf B Olgunluk" : "Sınıf A Mükemmellik"})
                  </span>
                </div>
              </div>
            );
          })()}

          {activeAssessment.status === "draft" && (
            <div className="bg-[#e2f0d9] border border-[#a9d18e] text-[#385723] rounded-2xl p-4 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-[#385723] shrink-0" />
              <span>Belirlenen sınıf hedefleri tüm değerlendirme konularının hedeflerine otomatik olarak yansıtılmıştır. Değerlendirme Formunu doldurmaya devam edebilirsiniz.</span>
            </div>
          )}
        </div>
      )}

      {/* ASSIGNMENT TAB CONTENT */}
      {activeAssessment && activeTab === "assignment" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-black text-[#2f5597] uppercase tracking-tight">DENETÇİ MADDE ATAMA VE SORUMLULUK PANELİ</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kategorileri denetçi uzmanlıklarına göre dağıtabilir ve atamaları yönetebilirsiniz.</p>
            </div>
            
            {/* Filter of the active user for quickly finding what they are responsible for */}
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shrink-0">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Yalnızca Benim Maddelerim:</span>
              <input
                type="checkbox"
                checked={filterAssignedOnly}
                onChange={(e) => setFilterAssignedOnly(e.target.checked)}
                className="w-4 h-4 text-[#2f5597] rounded focus:ring-[#2f5597] border-slate-300 cursor-pointer"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-[#2f5597] text-white border-b-2 border-slate-200 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="p-4 text-center w-24">BÖLÜM KODU</th>
                  <th className="p-4">DENETİM KATEGORİSİ</th>
                  <th className="p-4 text-center w-40">SORU SAYISI</th>
                  <th className="p-4 text-center w-52">SORUMLU DENETÇİ</th>
                  <th className="p-4 text-center w-44">İLERLEME DURUMU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                {categories.map((cat) => {
                  const stats = categoryProgress[cat.id] || { answered: 0, total: 0, average: 0 };
                  const assignedAssessorId = activeAssessment.assessorAssignments?.[cat.id] || currentUser?.id || "";
                  const assignedName = assessorsList.find(a => a.id === assignedAssessorId)?.name || "Atanmadı";
                  const isMyAssignment = assignedAssessorId === currentAssessorId;

                  if (filterAssignedOnly && !isMyAssignment) return null;

                  return (
                    <tr key={cat.id} className={`hover:bg-slate-50 transition-colors ${isMyAssignment ? "bg-blue-50/10" : ""}`}>
                      <td className="p-4 text-center font-mono font-black text-slate-900 border-r border-slate-100 bg-slate-50/20 w-24">{cat.id}</td>
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="text-slate-800 text-[11px] font-black uppercase block">{cat.name}</span>
                          {isMyAssignment && (
                            <span className="inline-flex items-center text-[11px] font-extrabold text-[#2f5597] bg-blue-50 px-1.5 py-0.5 rounded">
                              Size Atandı
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center font-mono text-slate-500 font-bold border-l border-r border-slate-100 w-40">
                        {stats.total} Soru
                      </td>
                      <td className="p-4 w-52 border-r border-slate-100">
                        <select
                          disabled={activeAssessment.status === "completed"}
                          value={assignedAssessorId}
                          onChange={(e) => handleAssessorAssignmentChange(cat.id, e.target.value)}
                          className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer w-full focus:border-slate-400"
                        >
                          {assessorsList.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-center w-44">
                        <div className="flex flex-col items-center space-y-1">
                          <span className={`inline-flex items-center text-[11px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            stats.answered === stats.total
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : stats.answered > 0
                              ? "bg-amber-50 text-amber-700 border-amber-100"
                              : "bg-slate-50 text-slate-400 border-slate-100"
                          }`}>
                            {stats.answered === stats.total ? "Tamamlandı" : stats.answered > 0 ? `${stats.answered}/${stats.total} Soru` : "Başlanmadı"}
                          </span>
                          
                          {/* Progress bar */}
                          <div className="w-24 bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${stats.answered === stats.total ? "bg-emerald-500" : "bg-amber-500"}`}
                              style={{ width: `${(stats.answered / stats.total) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT TAB CONTENT (Power BI Style Dashboard) */}
      {activeAssessment && activeTab === "report" && (
        <div className="space-y-6">

          {/* Top Dropdown Selector to Switch Audits (Power BI Style) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">AKTİF RAPOR SEÇİMİ</span>
              <div className="flex items-center space-x-2">
                <select
                  value={activeAssessment.id}
                  onChange={(e) => handleSelectAssessment(e.target.value)}
                  className="bg-white border border-slate-200 text-[#2f5597] text-xs font-black px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#2f5597] cursor-pointer shadow-2xs min-w-[320px] max-w-[480px] uppercase"
                >
                  {customerAssessments.map(a => (
                    <option key={a.id} value={a.id}>
                      {selectedCustomer?.companyName} + OPEX + {a.auditNo || 1} (Denetleme No)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-xs text-slate-500 font-bold font-mono">
                <span>Denetçi: <strong className="text-slate-800 uppercase">{activeAssessment.assessorParticipants || "Atakan Zehir"}</strong></span>
                <span className="mx-2">|</span>
                <span>Tarih: <strong className="text-slate-800">{new Date(activeAssessment.auditDate).toLocaleDateString("tr-TR")}</strong></span>
              </div>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                title="Tek sayfalık A4 özet raporu PDF olarak indir"
                className="flex items-center space-x-1.5 bg-rose-700 hover:bg-rose-600 text-white text-[11px] font-black uppercase px-3 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isExportingPdf ? "Hazırlanıyor..." : "PDF'e Aktar"}</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                title="Firma şablonuyla Excel raporu indir"
                className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-black uppercase px-3 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{isExportingExcel ? "Hazırlanıyor..." : "Excel'e Aktar"}</span>
              </button>
            </div>
          </div>
          {excelExportError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold rounded-xl px-4 py-2.5 flex items-center space-x-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{excelExportError}</span>
            </div>
          )}

          {/* Main Power BI Report Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: CATEGORIES TABLE & DEVIATION COMPARISON (xl:col-span-5) */}
            <div className="xl:col-span-5 space-y-6">
              
              {/* Category Scores Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="bg-[#2f5597] text-white px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-tight">KATEGORİ BAZLI ANALİZ TABLOSU</h3>
                  <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded">Mevcut Durum</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black text-[11px] uppercase tracking-wider">
                        <th className="p-2.5 w-16 text-center">Kategori</th>
                        <th className="p-2.5">Kategori Adı</th>
                        <th className="p-2.5 w-16 text-center">Hedef</th>
                        <th className="p-2.5 w-16 text-center">Sonuç</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 font-bold text-slate-700">
                      {categories.map((cat, idx) => {
                        const scorePct = Math.round(activeAssessment.categoryScores[cat.id] || 0);
                        // Every assessment is seeded with a per-category target at creation time
                        // (see creationTargetScore) — a genuinely missing value here means an old
                        // record that predates that, not "no target required", so fall back to
                        // that same 45-point default rather than a misleading 0.
                        const targetPct = Math.round(activeAssessment.targetScores?.[cat.id] ?? 45);

                        return (
                          <tr key={cat.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-2.5 text-center font-black text-[#2f5597] border-r border-slate-100 bg-slate-50/30 w-16">{cat.id}</td>
                            <td className="p-2.5 text-slate-900 font-black uppercase text-[10px] truncate max-w-[200px]" title={cat.name}>{cat.name}</td>
                            <td className="p-2.5 text-center font-mono font-extrabold text-slate-500 border-l border-r border-slate-100 bg-slate-50/10 w-16">{targetPct}</td>
                            <td className={`p-2.5 text-center font-mono font-black border-r border-slate-100 w-16 ${
                              scorePct >= targetPct
                                ? "text-emerald-700 bg-emerald-50/30"
                                : scorePct >= targetPct - 15
                                ? "text-amber-700 bg-amber-50/30"
                                : "text-red-700 bg-red-50/30"
                            }`}>
                              {scorePct}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Denetleme Sonuç Karşılaştırması Bar Chart (Overall comparison of audits) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4" id="opex-pdf-bar-chart">
                <div>
                  <h3 className="text-xs font-black text-slate-950 uppercase tracking-tight">Denetleme Sonuç Karşılaştırması</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Denetimler Arası Hedef vs Gerçekleşen Olgunluk Gelişimi
                  </p>
                </div>

                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overallComparisonData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: "bold" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar name="Hedef" dataKey="Hedef" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar name="Sonuç" dataKey="Sonuç" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: KPI CARDS, MAIN RADAR, & COMPARISON RADAR (xl:col-span-7) */}
            <div className="xl:col-span-7 space-y-6">
              
              {/* Top Sub-Grid: Overall Table & KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                
                {/* Overall Audits Table (col-span-5) */}
                <div className="md:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#2f5597] text-white font-extrabold uppercase text-[11px] tracking-wider">
                          <th className="p-3 text-center">Denetleme No</th>
                          <th className="p-3 text-center border-l border-white/10">Hedef</th>
                          <th className="p-3 text-center border-l border-white/10">Sonuç</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                        {customerAssessments.map((a, index) => {
                          let targetPct = 0;
                          if (a.targetPreAnswers) {
                            targetPct = getPreAssessmentMetrics(a.targetPreAnswers).targetPct;
                          } else if (a.targetScores) {
                            const keys = Object.keys(a.targetScores);
                            if (keys.length > 0) {
                              const sum = keys.reduce((s, k) => s + (a.targetScores?.[k] ?? 0), 0);
                              targetPct = Math.round(sum / keys.length);
                            }
                          }
                          const isActive = a.id === activeAssessment.id;
                          return (
                            <tr key={a.id} className={`hover:bg-slate-50/50 ${isActive ? "bg-slate-100/80 font-black text-slate-950" : ""}`}>
                              <td className="p-3 text-center font-mono">{a.auditNo || (index + 1)}</td>
                              <td className="p-3 text-center font-mono border-l border-slate-100 text-slate-500">{targetPct}</td>
                              <td className="p-3 text-center font-mono border-l border-slate-100 text-[#1e3a8a]">{a.overallScore}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-slate-50 p-2 border-t border-slate-100 text-[11px] text-slate-400 font-extrabold text-center uppercase tracking-wider">
                    Ölçüm Geçmişi ve Trend Kayıtları
                  </div>
                </div>

                {/* Sistem Seviyesi Card (col-span-4) */}
                <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">Sistem Seviyesi</span>
                  <div className="bg-[#2f5597] text-white rounded-xl p-4 flex items-center justify-center text-center h-full min-h-[75px]">
                    <span className="text-xs font-black uppercase tracking-tight">
                      {(() => {
                        const score = activeAssessment.overallScore;
                        if (score < 40) return "İSRAF YOĞUN";
                        if (score < 60) return "GELİŞMEKTE OLAN";
                        if (score < 80) return "SİSTEMATİK UYGULAMA";
                        return "SÜRDÜRÜLEBİLİR";
                      })()}
                    </span>
                  </div>
                </div>

                {/* Denetim Puanı Card (col-span-3) */}
                <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">Denetim Puanı</span>
                  <div className="bg-[#2f5597] text-white rounded-xl p-4 flex items-center justify-center h-full min-h-[75px]">
                    <span className="text-3xl font-black font-mono">
                      {activeAssessment.overallScore}
                    </span>
                  </div>
                </div>

              </div>

              {/* Main Radar and Previous Comparison Row */}
              <div className="space-y-6">
                
                {/* 1. Radar Chart: Active Assessment Hedef vs Gerçekleşen — the per-category
                    Hedef/Sonuç numbers already live in the table on the left, so this card is
                    just the radar itself, given real room instead of a cramped side-by-side slot
                    duplicating that same table. */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3" id="opex-pdf-radar-chart">
                  <div>
                    <h3 className="text-xs font-black text-[#2f5597] uppercase tracking-tight">Mevcut Durum Olgunluk Profili</h3>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      Mevcut Denetim Puanı (Gerçekleşen) vs Belirlenen Hedef Puanı — 18 Bölüm
                    </p>
                  </div>

                  <div className="h-[480px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarChartDataScaled}>
                        <PolarGrid stroke="#dbe3ee" />
                        <PolarAngleAxis dataKey="subject" tick={renderWrappedRadarTick} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} ticks={RADAR_RADIUS_TICKS} tick={{ fill: "#64748b", fontSize: 9 }} />
                        <Radar name="Hedef" dataKey="Hedef" stroke="#60a5fa" fill="transparent" strokeDasharray="4 3" strokeWidth={2} />
                        <Radar name="Gerçekleşen" dataKey="Gerçekleşen" stroke="#1e3a8a" fill="#2f5597" fillOpacity={0.45} strokeWidth={2}
                          label={renderRadarValueLabel} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Radar Chart: Previous Assessment Comparison (If auditNo >= 2) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  {previousAssessment ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                      <div className="md:col-span-5 h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={comparisonRadarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={renderWrappedRadarTick} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} ticks={RADAR_RADIUS_TICKS} tick={{ fill: "#64748b", fontSize: 8 }} />
                            <Radar name="Önceki Sonuç" dataKey="Önceki Sonuç" stroke="#94a3b8" fill="transparent" strokeDasharray="4 4" />
                            <Radar name="Mevcut Sonuç" dataKey="Mevcut Sonuç" stroke="#1e3a8a" fill="#1e3a8a" fillOpacity={0.35}
                              label={renderRadarValueLabel} />
                            <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="md:col-span-7 space-y-3">
                        <div>
                          <h3 className="text-xs font-black text-[#2f5597] uppercase tracking-tight">Gelişim Karşılaştırma Analizi</h3>
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                            Bu grafik, mevcut değerlendirme puanları ile bir önceki denetim (Denetleme No: #{previousAssessment.auditNo || 1}) arasındaki gelişimi göstermektedir.
                          </p>
                        </div>
                        <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[180px] overflow-y-auto shadow-3xs">
                          <table className="w-full text-left text-[10px] border-collapse">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 font-black text-slate-500 text-[11px] uppercase tracking-wider">
                              <tr>
                                <th className="p-2 w-12 text-center">Bölüm</th>
                                <th className="p-2">Önceki Puan</th>
                                <th className="p-2">Mevcut Puan</th>
                                <th className="p-2 text-center">Fark (Gelişim)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                              {categories.map((cat) => {
                                const prevPct = Math.round(previousAssessment.categoryScores[cat.id] || 0);
                                const currPct = Math.round(activeAssessment.categoryScores[cat.id] || 0);
                                const diff = currPct - prevPct;

                                return (
                                  <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-2 text-center font-black text-[#2f5597] border-r border-slate-150 bg-slate-50/30 font-mono">{cat.id}</td>
                                    <td className="p-2 font-mono text-slate-500">{prevPct}</td>
                                    <td className="p-2 font-mono text-slate-900 font-black">{currPct}</td>
                                    <td className={`p-2 text-center font-mono font-black ${
                                      diff > 0
                                        ? "text-emerald-700 bg-emerald-50/25"
                                        : diff < 0
                                        ? "text-red-700 bg-red-50/25"
                                        : "text-slate-500 bg-slate-50/20"
                                    }`}>
                                      {diff > 0 ? `+${diff}` : `${diff}`}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                      <TrendingUp className="w-10 h-10 text-slate-300 stroke-1" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-slate-800 uppercase">ÖNCEKİ DENETİM BULUNAMADI</h4>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-[320px] mx-auto">
                          Bu firma için henüz bir önceki karşılaştırma denetimi bulunmamaktadır. En az 2 denetim tamamlandığında geçmiş karşılaştırma analizi ve fark tablosu otomatik olarak burada belirecektir.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>

          {/* AI CONSULTANT FEEDBACK (POWERED BY GEMINI) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-950 uppercase tracking-tight flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-600 animate-pulse shrink-0" />
                  <span>Yapay Zeka OpEx Analiz Raporu (Senior Lean Consultant Engine)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Fabrika olgunluk verileri analiz edilerek Gemini tarafından üretilen stratejik yol haritası
                </p>
              </div>
              <button
                disabled={isAiLoading}
                onClick={handleTriggerAiInsight}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 shrink-0 animate-spin-slow" />
                <span>{isAiLoading ? "Analiz Ediliyor..." : "AI Olgunluk Analizi Üret"}</span>
              </button>
            </div>

            {/* AI Output renderer */}
            {isAiLoading && (
              <div className="p-8 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-slate-500 font-bold uppercase animate-pulse">Gemba Verileri ve Rubrik Tanımları Yapay Zeka Tarafından Analiz Ediliyor...</p>
              </div>
            )}

            {aiError && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-xl flex items-center space-x-2 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {aiReport && !isAiLoading && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 prose max-w-none text-slate-800">
                <Markdown>{aiReport}</Markdown>
              </div>
            )}

            {!aiReport && !isAiLoading && (
              <div className="p-6 text-center text-slate-400 text-xs">
                Sahanın güçlü/zayıf yanlarını ve 6 aylık öncelikli iyileştirme adımlarını içeren yapay zeka danışmanlık raporunu yukarıdaki butona tıklayarak oluşturabilirsiniz.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
