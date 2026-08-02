import React, { useState } from "react";
import { CompanyWorkspaceExtended } from "../../types/workspace";
import { Sparkles, RefreshCw, AlertCircle, Copy, Check, Activity } from "lucide-react";

interface AiSummaryTabProps {
  workspace: CompanyWorkspaceExtended;
  onUpdateCachedSummary: (summary: string) => void;
}

export default function AiSummaryTab({ workspace, onUpdateCachedSummary }: AiSummaryTabProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateAiSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("gemba_token");
      if (!token) {
        throw new Error("Oturum açma token'ı bulunamadı. Lütfen giriş yapın.");
      }

      const response = await fetch("/api/gemini/customer-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          companyName: workspace.companyName || "Belirtilmemiş",
          industry: workspace.industry || "Belirtilmemiş",
          productionType: workspace.productionType || "Belirtilmemiş",
          employeeCount: workspace.workforce.totalEmployees || 0,
          annualRevenue: workspace.operational.annualProductionQuantity || 0,
          currency: "Adet",
          copexScore: workspace.opex.opexScore || 50,
          notes: workspace.opex.currentImprovementProgram || "Ön çalışma devam ediyor.",
          preliminaryAssessmentReport: workspace.opex.strategicObjectives.join(", ") || "Yol haritası inceleniyor.",
          operationalInfo: workspace.operational,
          opexInfo: workspace.opex
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Sunucu hatası oluştu.");
      }

      const data = await response.json();
      if (data.success && data.summary) {
        onUpdateCachedSummary(data.summary);
      } else {
        throw new Error("Yapay zeka özet formatı geçersiz.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Yapay zeka özeti alınırken bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = () => {
    if (!workspace.aiSummaryCached) return;
    navigator.clipboard.writeText(workspace.aiSummaryCached);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple clean markdown viewer for beautiful layout (renders titles and lists in styled Tailwind blocks)
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");

    return (
      <div className="space-y-4 text-xs text-gray-700 leading-relaxed font-normal">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("###")) {
            return (
              <h4 key={idx} className="font-bold text-gray-900 text-xs mt-6 mb-2 border-b border-gray-100 pb-1 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-zinc-950 rounded-xs"></span>
                {trimmed.replace("###", "").trim()}
              </h4>
            );
          }
          if (trimmed.startsWith("##")) {
            return (
              <h3 key={idx} className="font-bold text-gray-900 text-sm mt-8 mb-3 flex items-center gap-2">
                <span className="w-2 h-4 bg-zinc-900 rounded-xs"></span>
                {trimmed.replace("##", "").trim()}
              </h3>
            );
          }
          if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
            return (
              <li key={idx} className="ml-4 pl-1 list-disc text-gray-600 my-1">
                {trimmed.substring(1).trim()}
              </li>
            );
          }
          if (trimmed === "") {
            return <div key={idx} className="h-2"></div>;
          }
          return <p key={idx}>{trimmed}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-6" id="ai-summary-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50 border border-zinc-100 p-4.5 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-zinc-900 text-white rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-xs flex items-center gap-1.5">
              Yapay Zeka Müşteri Analiz Özetleyici (AI executive Summary)
            </h4>
            <p className="text-[10px] text-gray-500 mt-1 leading-normal">
              Firma kartı, fabrika alanları, çalışan yapısı ve OpEx olgunluk verilerini okuyarak kurumsal bir yalın dönüşüm özeti çıkarır.
            </p>
          </div>
        </div>
        <button
          id="btn-generate-ai-summary"
          onClick={generateAiSummary}
          disabled={loading}
          className="px-4 py-2 bg-zinc-950 text-white hover:bg-zinc-800 disabled:bg-gray-100 disabled:text-gray-400 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {loading ? (
            <>
              <Activity className="w-4 h-4 animate-pulse" />
              Rapor Üretiliyor...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Yapay Zeka Raporunu Güncelle
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="flex gap-2.5 items-center p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs" id="ai-summary-error">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center space-y-3" id="ai-summary-loader">
          <div className="w-8 h-8 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-gray-400 animate-pulse font-medium">Gemba analitiği okunuyor, Gemini-3.5-flash ile yönetici özeti derleniyor...</p>
        </div>
      )}

      {!loading && workspace.aiSummaryCached && (
        <div className="border border-gray-100 rounded-xl p-6 bg-white relative group" id="ai-summary-result-card">
          <button
            id="btn-copy-ai-summary"
            onClick={handleCopyText}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-zinc-900 hover:bg-gray-50 border border-gray-100 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-medium"
            title="Kopyala"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" />
                <span>Kopyalandı!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Kopyala</span>
              </>
            )}
          </button>

          <div className="prose max-w-none">
            {renderMarkdown(workspace.aiSummaryCached)}
          </div>
        </div>
      )}

      {!loading && !workspace.aiSummaryCached && (
        <div className="text-center py-12 border border-dashed border-gray-100 rounded-xl" id="ai-summary-empty">
          <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-medium">Henüz bir Yapay Zeka özeti üretilmedi. Sağ üstteki butona basarak ilk raporu hemen hazırlayabilirsiniz.</p>
        </div>
      )}
    </div>
  );
}
