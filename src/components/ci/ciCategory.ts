// CI project category, derived from the title / description / opportunity type (projects have no
// category field yet). Moved out of KaizenManager (plan step C1); rules unchanged.
import type { KaizenCard } from "../../types";

// Categories whose savings count as cost-of-poor-quality reduction.
export const COPQ_CATEGORIES = ["Kalite", "Hurda / Fire"];

// Category mapping helper for deep insights
export function getKaizenCategory(proj: KaizenCard) {
  const title = (proj.title || "").toLowerCase();
  const desc = ((proj.description || "") + " " + (proj.descriptionBefore || "")).toLowerCase();
  const oppType = (proj.opportunityType || "").toLowerCase();
  
  if (oppType.includes("kalite") || title.includes("kalite") || desc.includes("kalite") || desc.includes("rework") || title.includes("hata") || desc.includes("hata") || desc.includes("düzeltme")) {
    return "Kalite";
  }
  if (oppType.includes("isg") || title.includes("isg") || desc.includes("isg") || desc.includes("güvenlik") || title.includes("güvenlik") || desc.includes("iş sağlığı")) {
    return "İSG (HSE)";
  }
  if (oppType.includes("hurda") || title.includes("hurda") || desc.includes("hurda") || oppType.includes("scrap") || title.includes("scrap") || desc.includes("fire") || title.includes("fire") || desc.includes("kayıp")) {
    return "Hurda / Fire";
  }
  if (oppType.includes("verimlilik") || title.includes("verimlilik") || desc.includes("verimlilik") || title.includes("oee") || desc.includes("oee") || title.includes("smed") || desc.includes("smed") || desc.includes("setup")) {
    return "Verimlilik";
  }
  if (oppType.includes("üretkenlik") || title.includes("üretkenlik") || desc.includes("üretkenlik") || desc.includes("kapasite") || desc.includes("hız") || title.includes("hız")) {
    return "Üretkenlik";
  }
  return "Diğer / Operasyonel";
}
