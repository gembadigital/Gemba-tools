import React, { useState, useRef, useEffect } from "react";
import { Customer } from "../types";
import { 
  GitCommit, RefreshCw, Layers, MapPin, Sliders, Play, 
  Trash2, HelpCircle, Download, FileText, Settings, Sparkles, 
  ZoomIn, Maximize2, Minimize2, Plus, Check, Eye, EyeOff, 
  ChevronRight, TrendingDown, Info, Trash, Edit2, BarChart2,
  AlertTriangle, ArrowRight, DollarSign, Activity, FileSpreadsheet,
  Undo, Redo, Grid, Camera, Save, Copy, PlusCircle, History,
  TrendingUp, Coins
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";

interface FlowImprovementProps {
  selectedCustomer: Customer;
}

interface ProcessNode {
  id: string;
  name: string;
  x: number;
  y: number;
  department: string;
  icon: string; // "assembly" | "cnc" | "press" | "warehouse" | "quality" | "shipping"
  operatorCount: number;
  cycleTime: number; // in seconds
  area: number; // m²
  remarks: string;
}

interface FlowPath {
  id: string;
  name: string;
  flowType: "Raw Material" | "Semi Finished" | "Finished Goods" | "Operator Movement" | "Forklift" | "AGV" | "Manual Transport" | "Waste Flow" | "Information Flow";
  waypoints: { x: number; y: number; nodeId?: string }[];
  frequency: number; // trans/day
  isVisible: boolean;
}

interface FactoryLayout {
  id: string;
  name: string;
  backgroundUrl: string | null;
  scaleFactor: number; // calculated scale (meters per pixel)
  widthMeters: number; // user specified physical layout width
  lengthMeters: number; // user specified physical layout length/height
  imageWidthPx: number; // real image resolution width
  imageHeightPx: number; // real image resolution height
  nodes: ProcessNode[];
  flows: FlowPath[];
}

interface VerticalTransfer {
  id: string;
  name: string;
  type: "stairs" | "elevator" | "conveyor";
  fromLayoutId: string;
  toLayoutId: string;
  frequency: number; // transfers/day
  distanceMeters: number; // vertical meters
}

interface Scenario {
  id: string;
  name: string;
  version: "Current" | "Future v1" | "Future v2" | "Simulations";
  layouts: FactoryLayout[];
  activeLayoutId: string;
  verticalTransfers: VerticalTransfer[];
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
}

const FLOW_TYPES_CONFIG = {
  "Raw Material": { name: "Hammadde Akışı", color: "#EF4444", costCoeff: 2.5, strokeDash: "0", speed: 1.5 },
  "Semi Finished": { name: "Yarı Mamul Akışı", color: "#3B82F6", costCoeff: 1.8, strokeDash: "0", speed: 1.5 },
  "Finished Goods": { name: "Mamul Sevkiyatı", color: "#10B981", costCoeff: 2.0, strokeDash: "0", speed: 1.5 },
  "Operator Movement": { name: "Operatör Yürüyüşü", color: "#F59E0B", costCoeff: 1.2, strokeDash: "4 4", speed: 1.2 },
  "Forklift": { name: "Forklift Trafiği", color: "#8B5CF6", costCoeff: 4.5, strokeDash: "0", speed: 4.5 },
  "AGV": { name: "AGV Taşıma", color: "#EC4899", costCoeff: 0.8, strokeDash: "0", speed: 2.0 },
  "Manual Transport": { name: "Manuel Taşıma", color: "#06B6D4", costCoeff: 1.5, strokeDash: "2 2", speed: 1.0 },
  "Waste Flow": { name: "İsraf Akışı (Muda)", color: "#6B7280", costCoeff: 3.0, strokeDash: "6 3", speed: 1.5 },
  "Information Flow": { name: "Bilgi / Kanban Akışı", color: "#14B8A6", costCoeff: 0.1, strokeDash: "1 3", speed: 999 },
};

const STATION_ICONS = {
  assembly: { icon: "🛠️", label: "Montaj Hücresi" },
  cnc: { icon: "⚙️", label: "CNC İşleme" },
  press: { icon: "🌀", label: "Pres İstasyonu" },
  warehouse: { icon: "📦", label: "Hammadde / Depo" },
  quality: { icon: "🧪", label: "Kalite Kontrol & Test" },
  shipping: { icon: "🚚", label: "Paketleme & Sevk" },
};

export default function FlowImprovement({
  selectedCustomer
}: FlowImprovementProps) {
  const token = localStorage.getItem("gemba_token") || "usr_arcelik_admin";

  const [activeTab, setActiveTab] = useState<"current" | "future" | "comparison" | "mali-veri">("current");
  const [flowTypesConfig, setFlowTypesConfig] = useState(FLOW_TYPES_CONFIG);
  const [verticalTransferCoeffs, setVerticalTransferCoeffs] = useState({ elevator: 12.0, conveyor: 2.0, stairs: 4.0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawingMode, setDrawingMode] = useState<"select" | "draw" | "node">("select");
  const [selectedFlowType, setSelectedFlowType] = useState<keyof typeof FLOW_TYPES_CONFIG>("Raw Material");
  
  // Layer visibility toggles
  const [showLayers, setShowLayers] = useState({
    backdrop: true,
    stations: true,
    materialFlow: true,
    operatorFlow: true,
    vehicleFlow: true,
    heatmap: false
  });

  // Snapping options
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToObjects, setSnapToObjects] = useState(true);

  // Zoom / Pan state
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Simulation parameters (What-if Scenario & ROI)
  const [simLaborCost, setSimLaborCost] = useState(85); // ₺/hour
  const [simFuelCostCoeff, setSimFuelCostCoeff] = useState(1.2); // Forklift cost coeff multiplier
  const [simWorkingDays, setSimWorkingDays] = useState(250);
  const [simImplementationCost, setSimImplementationCost] = useState(180000); // ₺ investment cost

  // Detailed Financial Salary parameters
  const [netMonthlySalary, setNetMonthlySalary] = useState(25000); // ₺/month Net
  const [employerOverheadPercent, setEmployerOverheadPercent] = useState(40); // % SGK + meals + transport etc.
  const [monthlyWorkingHours, setMonthlyWorkingHours] = useState(180); // Hours/month
  const [factoryAreaUnitPrice, setFactoryAreaUnitPrice] = useState(150); // ₺ / m² monthly rental value / unit area cost

  useEffect(() => {
    const hourlyCost = (netMonthlySalary * (1 + employerOverheadPercent / 100)) / monthlyWorkingHours;
    setSimLaborCost(parseFloat(hourlyCost.toFixed(2)));
  }, [netMonthlySalary, employerOverheadPercent, monthlyWorkingHours]);

  // Scenarios state
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>("sc_current");
  
  // Undo/Redo & Auditing state
  const [history, setHistory] = useState<Scenario[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Selection states
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  // Confirm dialogs
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [printCanvasUrl, setPrintCanvasUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper log function
  const addLog = (action: string, details: string) => {
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString("tr-TR"),
      action,
      details
    };
    setAuditLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  // Default initial high fidelity scenarios
  const defaultScenarios: Scenario[] = [
    {
      id: "sc_current",
      name: "Mevcut Fabrika Akış Yerleşimi",
      version: "Current",
      activeLayoutId: "ly_ground",
      layouts: [
        {
          id: "ly_ground",
          name: "Zemin Kat (Main Production Floor)",
          backgroundUrl: null,
          scaleFactor: 0.15, // 1 px = 0.15 m
          widthMeters: 114,
          lengthMeters: 63,
          imageWidthPx: 760,
          imageHeightPx: 420,
          nodes: [
            { id: "nd_1", name: "Malzeme Kabul & Depo", x: 80, y: 340, department: "Lojistik", icon: "warehouse", operatorCount: 3, cycleTime: 120, area: 180, remarks: "Koridorlar dar ve sevkiyat bekleme alanı kısıtlı" },
            { id: "nd_2", name: "Pres İstasyonu", x: 180, y: 120, department: "Presler", icon: "press", operatorCount: 2, cycleTime: 40, area: 120, remarks: "Yerleşim planı düzensiz" },
            { id: "nd_3", name: "CNC Bükme Alanı", x: 360, y: 120, department: "Sac Şekillendirme", icon: "cnc", operatorCount: 1, cycleTime: 55, area: 80, remarks: "Tampon depo alanı yetersiz" },
            { id: "nd_4", name: "Robotik Kaynak", x: 540, y: 120, department: "Kaynakhane", icon: "assembly", operatorCount: 1, cycleTime: 75, area: 100, remarks: "Duman emiş performansı zayıf" },
            { id: "nd_5", name: "Boyahane Giriş", x: 680, y: 220, department: "Yüzey İşlem", icon: "quality", operatorCount: 4, cycleTime: 200, area: 240, remarks: "Sabit hızlı konveyör askısı darboğaz" },
            { id: "nd_6", name: "Mamul Paketleme & Sevk", x: 260, y: 340, department: "Lojistik", icon: "shipping", operatorCount: 4, cycleTime: 150, area: 140, remarks: "Sevkiyat çıkış kapısı önü tıkalı" }
          ],
          flows: [
            {
              id: "fl_1",
              name: "Sac Hammadde Akışı",
              flowType: "Raw Material",
              frequency: 12,
              isVisible: true,
              waypoints: [
                { x: 80, y: 340, nodeId: "nd_1" },
                { x: 180, y: 120, nodeId: "nd_2" },
                { x: 360, y: 120, nodeId: "nd_3" }
              ]
            },
            {
              id: "fl_2",
              name: "Yarı Mamul Transferi",
              flowType: "Semi Finished",
              frequency: 24,
              isVisible: true,
              waypoints: [
                { x: 360, y: 120, nodeId: "nd_3" },
                { x: 540, y: 120, nodeId: "nd_4" },
                { x: 680, y: 220, nodeId: "nd_5" }
              ]
            },
            {
              id: "fl_3",
              name: "Forklift Taşıma Rotası",
              flowType: "Forklift",
              frequency: 18,
              isVisible: true,
              waypoints: [
                { x: 180, y: 120, nodeId: "nd_2" },
                { x: 420, y: 240 },
                { x: 680, y: 220, nodeId: "nd_5" }
              ]
            },
            {
              id: "fl_4",
              name: "Operatör Yürüyüş Yolu",
              flowType: "Operator Movement",
              frequency: 35,
              isVisible: true,
              waypoints: [
                { x: 360, y: 120, nodeId: "nd_3" },
                { x: 260, y: 240 },
                { x: 80, y: 340, nodeId: "nd_1" }
              ]
            }
          ]
        },
        {
          id: "ly_first",
          name: "1. Kat (Üst Montaj & Paketleme)",
          backgroundUrl: null,
          scaleFactor: 0.12,
          widthMeters: 91,
          lengthMeters: 50,
          imageWidthPx: 760,
          imageHeightPx: 420,
          nodes: [
            { id: "nd_7", name: "Montaj Hattı", x: 380, y: 210, department: "Montaj", icon: "assembly", operatorCount: 14, cycleTime: 42, area: 160, remarks: "Klasik hat düzeni, yüksek hareket kayıpları" }
          ],
          flows: [
            {
              id: "fl_5",
              name: "Montaj İçi Besleme",
              flowType: "Manual Transport",
              frequency: 15,
              isVisible: true,
              waypoints: [
                { x: 380, y: 210, nodeId: "nd_7" },
                { x: 200, y: 210 }
              ]
            }
          ]
        }
      ],
      verticalTransfers: [
        { id: "vt_1", name: "Yük Asansörü 1", type: "elevator", fromLayoutId: "ly_ground", toLayoutId: "ly_first", frequency: 15, distanceMeters: 5.5 },
        { id: "vt_2", name: "Hammadde Dik Konveyör", type: "conveyor", fromLayoutId: "ly_ground", toLayoutId: "ly_first", frequency: 10, distanceMeters: 5.5 }
      ]
    },
    {
      id: "sc_future",
      name: "Yalın U-Hücre ve Süpermarket Tasarımı (Gelecek v1)",
      version: "Future v1",
      activeLayoutId: "ly_ground",
      layouts: [
        {
          id: "ly_ground",
          name: "Zemin Kat (Main Production Floor)",
          backgroundUrl: null,
          scaleFactor: 0.15,
          widthMeters: 114,
          lengthMeters: 63,
          imageWidthPx: 760,
          imageHeightPx: 420,
          nodes: [
            { id: "nd_1", name: "Malzeme Kabul & Depo", x: 80, y: 340, department: "Lojistik", icon: "warehouse", operatorCount: 3, cycleTime: 120, area: 150, remarks: "Yeniden yapılandırılmış yalın malzeme alanı" },
            { id: "nd_2", name: "Pres İstasyonu", x: 160, y: 220, department: "Presler", icon: "press", operatorCount: 2, cycleTime: 40, area: 120, remarks: "Malzeme kabulüne yaklaştırıldı" },
            { id: "nd_3", name: "CNC Bükme Alanı", x: 250, y: 220, department: "Sac Şekillendirme", icon: "cnc", operatorCount: 1, cycleTime: 55, area: 80, remarks: "Kesintisiz hücre akışı için konumlandırıldı" },
            { id: "nd_4", name: "Robotik Kaynak", x: 350, y: 220, department: "Kaynakhane", icon: "assembly", operatorCount: 1, cycleTime: 75, area: 100, remarks: "Hücre akışına entegre" },
            { id: "nd_5", name: "Boyahane Giriş", x: 480, y: 220, department: "Yüzey İşlem", icon: "quality", operatorCount: 4, cycleTime: 200, area: 240, remarks: "Akış hattı optimize edildi" },
            { id: "nd_6", name: "Mamul Paketleme & Sevk", x: 260, y: 340, department: "Lojistik", icon: "shipping", operatorCount: 4, cycleTime: 150, area: 140, remarks: "U-tipi çıkış noktası" }
          ],
          flows: [
            {
              id: "fl_1",
              name: "Yalın Sac Akışı",
              flowType: "Raw Material",
              frequency: 12,
              isVisible: true,
              waypoints: [
                { x: 80, y: 340, nodeId: "nd_1" },
                { x: 160, y: 220, nodeId: "nd_2" },
                { x: 250, y: 220, nodeId: "nd_3" }
              ]
            },
            {
              id: "fl_2",
              name: "Hücre İçi Akış",
              flowType: "Semi Finished",
              frequency: 24,
              isVisible: true,
              waypoints: [
                { x: 250, y: 220, nodeId: "nd_3" },
                { x: 350, y: 220, nodeId: "nd_4" },
                { x: 480, y: 220, nodeId: "nd_5" }
              ]
            },
            {
              id: "fl_3",
              name: "AGV Otomatik Besleme",
              flowType: "AGV",
              frequency: 18,
              isVisible: true,
              waypoints: [
                { x: 160, y: 220, nodeId: "nd_2" },
                { x: 320, y: 280 },
                { x: 480, y: 220, nodeId: "nd_5" }
              ]
            },
            {
              id: "fl_4",
              name: "Operatör Yolları",
              flowType: "Operator Movement",
              frequency: 14, // optimized
              isVisible: true,
              waypoints: [
                { x: 250, y: 220, nodeId: "nd_3" },
                { x: 80, y: 340, nodeId: "nd_1" }
              ]
            }
          ]
        },
        {
          id: "ly_first",
          name: "1. Kat (Üst Montaj & Paketleme)",
          backgroundUrl: null,
          scaleFactor: 0.12,
          widthMeters: 91,
          lengthMeters: 50,
          imageWidthPx: 760,
          imageHeightPx: 420,
          nodes: [
            { id: "nd_7", name: "Montaj Hattı", x: 320, y: 280, department: "Montaj", icon: "assembly", operatorCount: 10, cycleTime: 42, area: 160, remarks: "U-Tipi hücre dönüşümü yapıldı" }
          ],
          flows: [
            {
              id: "fl_5",
              name: "U-Tipi Akış",
              flowType: "Manual Transport",
              frequency: 8,
              isVisible: true,
              waypoints: [
                { x: 320, y: 280, nodeId: "nd_7" },
                { x: 220, y: 280 }
              ]
            }
          ]
        }
      ],
      verticalTransfers: [
        { id: "vt_1", name: "Yük Asansörü 1", type: "elevator", fromLayoutId: "ly_ground", toLayoutId: "ly_first", frequency: 8, distanceMeters: 5.5 },
        { id: "vt_2", name: "Hammadde Dik Konveyör", type: "conveyor", fromLayoutId: "ly_ground", toLayoutId: "ly_first", frequency: 4, distanceMeters: 5.5 }
      ]
    }
  ];

  // Whole-module persistence: scenarios/layouts/nodes/flows, the editable flow-type & vertical-
  // transfer cost coefficients, and the financial parameters are saved to
  // /api/business/spaghetti-flow-settings as one blob per customer, and restored here on customer
  // select. `settingsReady` gates the auto-save effect below so it never fires with default values
  // before the real saved data (or the "nothing saved yet" case) arrives.
  const [settingsReady, setSettingsReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  useEffect(() => {
    setSelectedNodeId(null);
    setSelectedFlowId(null);
    setSettingsReady(false);
    fetch("/api/business/spaghetti-flow-settings", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomer.id
      }
    })
      .then(res => res.json())
      .then(res => {
        const d = (res.success && res.data && res.data.data) ? res.data.data : null;
        const loaded: Scenario[] = d?.scenarios || [];
        if (loaded && loaded.length > 0) {
          setScenarios(loaded);
          setActiveScenarioId(loaded[0].id);
          setHistory([JSON.parse(JSON.stringify(loaded))]);
          setHistoryIndex(0);
          addLog("Proje Yüklendi", "Mevcut çizimler veritabanından başarıyla aktarıldı.");
        } else {
          setScenarios(defaultScenarios);
          setActiveScenarioId(defaultScenarios[0].id);
          setHistory([JSON.parse(JSON.stringify(defaultScenarios))]);
          setHistoryIndex(0);
          addLog("Varsayılan Proje Yüklendi", "Zemin Kat ve Üst Kat yerleşim şablonları yüklendi.");
        }
        setFlowTypesConfig(d?.flowTypesConfig || FLOW_TYPES_CONFIG);
        setVerticalTransferCoeffs(d?.verticalTransferCoeffs || { elevator: 12.0, conveyor: 2.0, stairs: 4.0 });
        setSimFuelCostCoeff(d?.simFuelCostCoeff ?? 1.2);
        setSimWorkingDays(d?.simWorkingDays ?? 250);
        setSimImplementationCost(d?.simImplementationCost ?? 180000);
        setNetMonthlySalary(d?.netMonthlySalary ?? 25000);
        setEmployerOverheadPercent(d?.employerOverheadPercent ?? 40);
        setMonthlyWorkingHours(d?.monthlyWorkingHours ?? 180);
        setFactoryAreaUnitPrice(d?.factoryAreaUnitPrice ?? 150);
        setSettingsReady(true);
      })
      .catch(err => {
        console.error("Failed to load Spaghetti Flow settings", err);
        setScenarios(defaultScenarios);
        setActiveScenarioId(defaultScenarios[0].id);
        setHistory([JSON.parse(JSON.stringify(defaultScenarios))]);
        setHistoryIndex(0);
        setSettingsReady(true);
      });
  }, [selectedCustomer.id]);

  // Debounced auto-save: whenever the drawing model or any tunable changes, persist the whole
  // bundle ~900ms after the last change. Gated on settingsReady so this never overwrites the
  // customer's saved data with defaults before they've loaded.
  useEffect(() => {
    if (!settingsReady) return;
    const dataToSave = {
      scenarios, flowTypesConfig, verticalTransferCoeffs,
      simFuelCostCoeff, simWorkingDays, simImplementationCost,
      netMonthlySalary, employerOverheadPercent, monthlyWorkingHours, factoryAreaUnitPrice
    };
    const timeoutId = setTimeout(() => {
      setSaveStatus("saving");
      fetch("/api/business/spaghetti-flow-settings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-factory-id": selectedCustomer.id,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ data: dataToSave })
      })
        .then(res => res.json())
        .then(res => {
          setSaveStatus(res.success ? "success" : "error");
          setTimeout(() => setSaveStatus("idle"), 2000);
        })
        .catch(err => {
          console.error("Failed to save Spaghetti Flow settings", err);
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 2000);
        });
    }, 900);
    return () => clearTimeout(timeoutId);
  }, [
    scenarios, flowTypesConfig, verticalTransferCoeffs,
    simFuelCostCoeff, simWorkingDays, simImplementationCost,
    netMonthlySalary, employerOverheadPercent, monthlyWorkingHours, factoryAreaUnitPrice,
    settingsReady, selectedCustomer.id, token
  ]);

  // Synchronize scenario updates
  const updateScenarios = (newScenarios: Scenario[], bypassHistory: boolean = false) => {
    setScenarios(newScenarios);

    if (!bypassHistory) {
      const nextHistory = history.slice(0, historyIndex + 1);
      setHistory([...nextHistory, JSON.parse(JSON.stringify(newScenarios))]);
      setHistoryIndex(nextHistory.length);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setScenarios(JSON.parse(JSON.stringify(prev)));
      setHistoryIndex(historyIndex - 1);
      addLog("Geri Alındı", "Son çizim veya değişiklik işlemi geri alındı.");
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setScenarios(JSON.parse(JSON.stringify(next)));
      setHistoryIndex(historyIndex + 1);
      addLog("İleri Alındı", "Geri alınan değişiklik tekrar uygulandı.");
    }
  };

  // Active getters
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
  const activeLayout = activeScenario?.layouts.find(l => l.id === activeScenario.activeLayoutId) || activeScenario?.layouts[0];

  // Dynamic calculations metrics
  const calculateLayoutMetrics = (layout: FactoryLayout) => {
    if (!layout) return { totalDistance: 0, materialHandlingCost: 0, walkingTime: 0, crossingCount: 0 };
    
    let totalDistance = 0;
    let materialHandlingCost = 0;
    let walkingTime = 0;

    layout.flows.forEach(flow => {
      let flowDist = 0;
      for (let i = 0; i < flow.waypoints.length - 1; i++) {
        const fromPt = flow.waypoints[i];
        const toPt = flow.waypoints[i+1];
        const pDist = Math.sqrt(Math.pow(toPt.x - fromPt.x, 2) + Math.pow(toPt.y - fromPt.y, 2));
        flowDist += pDist * layout.scaleFactor;
      }

      totalDistance += flowDist;
      const config = flowTypesConfig[flow.flowType];
      
      // Cost calculation
      let costCoeff = config.costCoeff;
      if (flow.flowType === "Forklift") costCoeff *= simFuelCostCoeff;
      materialHandlingCost += flow.frequency * flowDist * costCoeff * simWorkingDays;

      // Walking time
      const speed = config.speed;
      walkingTime += (flowDist / speed) * flow.frequency * simWorkingDays / 3600; // in hours
    });

    // Detect line crossing counts (intersections)
    let crossingCount = 0;
    const segmentsList: { x1: number; y1: number; x2: number; y2: number }[] = [];
    layout.flows.forEach(flow => {
      for (let i = 0; i < flow.waypoints.length - 1; i++) {
        segmentsList.push({
          x1: flow.waypoints[i].x,
          y1: flow.waypoints[i].y,
          x2: flow.waypoints[i+1].x,
          y2: flow.waypoints[i+1].y
        });
      }
    });

    const isIntersecting = (s1: any, s2: any) => {
      const det = (s1.x2 - s1.x1) * (s2.y2 - s2.y1) - (s2.x2 - s2.x1) * (s1.y2 - s1.y1);
      if (det === 0) return false;
      const lambda = ((s2.y2 - s2.y1) * (s2.x2 - s1.x1) + (s2.x1 - s2.x2) * (s2.y2 - s1.y1)) / det;
      const gamma = ((s1.y1 - s1.y2) * (s2.x2 - s1.x1) + (s1.x2 - s1.x1) * (s2.y2 - s1.y1)) / det;
      return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    };

    for (let i = 0; i < segmentsList.length; i++) {
      for (let j = i + 1; j < segmentsList.length; j++) {
        if (isIntersecting(segmentsList[i], segmentsList[j])) {
          crossingCount++;
        }
      }
    }

    return {
      totalDistance: Math.round(totalDistance),
      materialHandlingCost: Math.round(materialHandlingCost),
      walkingTime: Math.round(walkingTime),
      crossingCount
    };
  };

  // Scenario-wide metrics (includes all layouts and vertical transfers)
  const getScenarioMetrics = (scen: Scenario) => {
    if (!scen) return { totalDistance: 0, materialHandlingCost: 0, walkingTime: 0, crossingCount: 0, verticalTransfersCost: 0 };
    
    let totalDistance = 0;
    let materialHandlingCost = 0;
    let walkingTime = 0;
    let crossingCount = 0;
    let verticalTransfersCost = 0;

    scen.layouts.forEach(l => {
      const lMetrics = calculateLayoutMetrics(l);
      totalDistance += lMetrics.totalDistance;
      materialHandlingCost += lMetrics.materialHandlingCost;
      walkingTime += lMetrics.walkingTime;
      crossingCount += lMetrics.crossingCount;
    });

    // Add vertical transfers
    scen.verticalTransfers?.forEach(vt => {
      const vtCoeff = vt.type === "elevator" ? verticalTransferCoeffs.elevator : vt.type === "conveyor" ? verticalTransferCoeffs.conveyor : verticalTransferCoeffs.stairs;
      const vtCost = vt.frequency * vt.distanceMeters * vtCoeff * simWorkingDays;
      verticalTransfersCost += vtCost;
      materialHandlingCost += vtCost;
      totalDistance += vt.distanceMeters * vt.frequency;
      
      if (vt.type === "stairs") {
        walkingTime += (vt.distanceMeters / 0.5) * vt.frequency * simWorkingDays / 3600; // slow walking on stairs
      }
    });

    return {
      totalDistance: Math.round(totalDistance),
      materialHandlingCost: Math.round(materialHandlingCost),
      walkingTime: Math.round(walkingTime),
      crossingCount,
      verticalTransfersCost: Math.round(verticalTransfersCost)
    };
  };

  const activeMetrics = getScenarioMetrics(activeScenario);

  // Redraw Canvas whenever variables change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeLayout) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and translate with Pan and Zoom
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoomScale, zoomScale);

    // 1. Draw grid backdrop if active
    if (snapToGrid) {
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < canvas.width; x += 15) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 15) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    }

    // 2. Draw layout image background if loaded
    if (showLayers.backdrop && activeLayout.backgroundUrl) {
      const img = new Image();
      img.src = activeLayout.backgroundUrl;
      if (img.complete) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
      }
    } else if (showLayers.backdrop) {
      // Draw a neat grey placeholder grid
      ctx.fillStyle = "#fafbfd";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }

    // 3. Draw soft heat map glow
    if (showLayers.heatmap) {
      activeLayout.flows.forEach(flow => {
        const config = flowTypesConfig[flow.flowType];
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 24;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        flow.waypoints.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      });
      ctx.globalAlpha = 1.0;
    }

    // 4. Draw flow lines
    activeLayout.flows.forEach(flow => {
      const config = flowTypesConfig[flow.flowType];
      
      // Filter layer categories
      if (flow.flowType.includes("Material") || flow.flowType.includes("Finished") || flow.flowType.includes("WIP")) {
        if (!showLayers.materialFlow) return;
      }
      if (flow.flowType.includes("Operator") || flow.flowType.includes("Manual")) {
        if (!showLayers.operatorFlow) return;
      }
      if (flow.flowType.includes("Forklift") || flow.flowType.includes("AGV")) {
        if (!showLayers.vehicleFlow) return;
      }

      ctx.strokeStyle = config.color;
      ctx.lineWidth = selectedFlowId === flow.id ? 5 : 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      if (config.strokeDash !== "0") {
        ctx.setLineDash(config.strokeDash.split(" ").map(Number));
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      flow.waypoints.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // Draw vector mid arrows
      for (let i = 0; i < flow.waypoints.length - 1; i++) {
        const from = flow.waypoints[i];
        const to = flow.waypoints[i+1];
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);

        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX - 9 * Math.cos(angle - Math.PI / 6), midY - 9 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(midX - 9 * Math.cos(angle + Math.PI / 6), midY - 9 * Math.sin(angle + Math.PI / 6));
        ctx.fill();

        // Print distance labels along segments
        const pLen = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
        const mLen = (pLen * activeLayout.scaleFactor).toFixed(1);
        ctx.fillStyle = "#334155";
        ctx.font = "8px monospace";
        ctx.fillText(`${mLen}m`, midX + 8, midY - 4);
      }
    });

    // 5. Draw process nodes (stations) with specialized icons
    if (showLayers.stations) {
      activeLayout.nodes.forEach(node => {
        const isSelected = selectedNodeId === node.id;
        ctx.fillStyle = isSelected ? "#312e81" : "#0f172a";
        ctx.strokeStyle = isSelected ? "#6366f1" : "#475569";
        ctx.lineWidth = 2;

        ctx.beginPath();
        // roundRect available in standard canvas context
        ctx.roundRect(node.x - 45, node.y - 20, 90, 40, 8);
        ctx.fill();
        ctx.stroke();

        // Icon representation
        const iconSymbol = STATION_ICONS[node.icon as keyof typeof STATION_ICONS]?.icon || "🏭";
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.fillText(iconSymbol, node.x - 30, node.y + 4);

        // Text representation
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText(node.name.length > 12 ? node.name.substring(0, 10) + ".." : node.name, node.x + 10, node.y - 4);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "7px sans-serif";
        ctx.fillText(`👥${node.operatorCount} Op | ${node.cycleTime}s`, node.x + 10, node.y + 8);
      });
    }

    ctx.restore();
  }, [activeLayout, showLayers, panOffset, zoomScale, selectedNodeId, selectedFlowId, snapToGrid, simFuelCostCoeff, isFullscreen]);

  // Drag and drop / Canvas interaction
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    // The canvas's internal pixel resolution (canvas.width/height) can differ from its
    // CSS-rendered size (rect.width/height) when max-w-full shrinks it — e.g. narrow windows
    // or mobile. Scale the raw client offset into canvas-pixel space before applying pan/zoom.
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;

    return {
      x: Math.round((rawX - panOffset.x) / zoomScale),
      y: Math.round((rawY - panOffset.y) / zoomScale)
    };
  };

  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    // Pan mode with middle click or space key
    if (e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (drawingMode === "node") {
      let finalX = pos.x;
      let finalY = pos.y;
      
      if (snapToGrid) {
        finalX = Math.round(pos.x / 15) * 15;
        finalY = Math.round(pos.y / 15) * 15;
      }

      const newNode: ProcessNode = {
        id: `nd_${Date.now()}`,
        name: "Yeni İstasyon",
        x: finalX,
        y: finalY,
        department: "Üretim",
        icon: "assembly",
        operatorCount: 1,
        cycleTime: 45,
        area: 40,
        remarks: "Kullanıcı tarafından eklendi"
      };

      const updatedLayouts = activeScenario.layouts.map(ly => {
        if (ly.id === activeLayout.id) {
          return { ...ly, nodes: [...ly.nodes, newNode] };
        }
        return ly;
      });

      const updatedScenarios = scenarios.map(sc => {
        if (sc.id === activeScenario.id) {
          return { ...sc, layouts: updatedLayouts };
        }
        return sc;
      });

      updateScenarios(updatedScenarios);
      setSelectedNodeId(newNode.id);
      setDrawingMode("select");
      addLog("İstasyon Eklendi", `"${newNode.name}" konumuna yerleştirildi.`);
      return;
    }

    if (drawingMode === "draw") {
      // Find if clicked near an existing station to snap coordinates
      const nearNode = activeLayout.nodes.find(node => 
        Math.sqrt(Math.pow(node.x - pos.x, 2) + Math.pow(node.y - pos.y, 2)) < 30
      );

      const clickedX = (snapToObjects && nearNode) ? nearNode.x : pos.x;
      const clickedY = (snapToObjects && nearNode) ? nearNode.y : pos.y;

      if (selectedFlowId) {
        const updatedLayouts = activeScenario.layouts.map(ly => {
          if (ly.id === activeLayout.id) {
            return {
              ...ly,
              flows: ly.flows.map(fl => {
                if (fl.id === selectedFlowId) {
                  return {
                    ...fl,
                    waypoints: [...fl.waypoints, { x: clickedX, y: clickedY, nodeId: nearNode?.id }]
                  };
                }
                return fl;
              })
            };
          }
          return ly;
        });

        const updatedScenarios = scenarios.map(sc => {
          if (sc.id === activeScenario.id) {
            return { ...sc, layouts: updatedLayouts };
          }
          return sc;
        });

        updateScenarios(updatedScenarios);
      } else {
        const newFlowId = `fl_${Date.now()}`;
        const newFlow: FlowPath = {
          id: newFlowId,
          name: `${flowTypesConfig[selectedFlowType].name} #${activeLayout.flows.length + 1}`,
          flowType: selectedFlowType,
          frequency: 15,
          isVisible: true,
          waypoints: [{ x: clickedX, y: clickedY, nodeId: nearNode?.id }]
        };

        const updatedLayouts = activeScenario.layouts.map(ly => {
          if (ly.id === activeLayout.id) {
            return { ...ly, flows: [...ly.flows, newFlow] };
          }
          return ly;
        });

        const updatedScenarios = scenarios.map(sc => {
          if (sc.id === activeScenario.id) {
            return { ...sc, layouts: updatedLayouts };
          }
          return sc;
        });

        updateScenarios(updatedScenarios);
        setSelectedFlowId(newFlowId);
        addLog("Akış Başlatıldı", `Yeni akış hattı oluşturuldu.`);
      }
      return;
    }

    if (drawingMode === "select") {
      // Check if clicked near process node card
      const clickedNode = activeLayout.nodes.find(n => 
        Math.abs(n.x - pos.x) < 45 && Math.abs(n.y - pos.y) < 20
      );

      if (clickedNode) {
        setSelectedNodeId(clickedNode.id);
        setSelectedFlowId(null);
        setDraggedNode(clickedNode.id);
        addLog("İstasyon Seçildi", `"${clickedNode.name}" özellikleri yüklendi.`);
        return;
      }

      // Check if clicked near a flow path to select it
      const clickedFlow = activeLayout.flows.find(flow => {
        for (let i = 0; i < flow.waypoints.length - 1; i++) {
          const from = flow.waypoints[i];
          const to = flow.waypoints[i+1];
          // Calculate distance from point to segment
          const l2 = Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2);
          if (l2 === 0) continue;
          const t = Math.max(0, Math.min(1, ((pos.x - from.x) * (to.x - from.x) + (pos.y - from.y) * (to.y - from.y)) / l2));
          const projectionX = from.x + t * (to.x - from.x);
          const projectionY = from.y + t * (to.y - from.y);
          const dist = Math.sqrt(Math.pow(pos.x - projectionX, 2) + Math.pow(pos.y - projectionY, 2));
          if (dist < 12) return true;
        }
        return false;
      });

      if (clickedFlow) {
        setSelectedFlowId(clickedFlow.id);
        setSelectedNodeId(null);
        addLog("Akış Seçildi", `"${clickedFlow.name}" inceleniyor.`);
      } else {
        setSelectedNodeId(null);
        setSelectedFlowId(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (draggedNode && activeScenario) {
      const pos = getMousePos(e);
      let finalX = pos.x;
      let finalY = pos.y;
      
      if (snapToGrid) {
        finalX = Math.round(pos.x / 15) * 15;
        finalY = Math.round(pos.y / 15) * 15;
      }

      const updatedLayouts = activeScenario.layouts.map(ly => {
        if (ly.id === activeLayout.id) {
          // Update node coordinates
          const updatedNodes = ly.nodes.map(n => n.id === draggedNode ? { ...n, x: finalX, y: finalY } : n);
          // Also update all attached waypoints to follow the station
          const updatedFlows = ly.flows.map(fl => ({
            ...fl,
            waypoints: fl.waypoints.map(wp => wp.nodeId === draggedNode ? { ...wp, x: finalX, y: finalY } : wp)
          }));
          return { ...ly, nodes: updatedNodes, flows: updatedFlows };
        }
        return ly;
      });

      const updatedScenarios = scenarios.map(sc => {
        if (sc.id === activeScenario.id) {
          return { ...sc, layouts: updatedLayouts };
        }
        return sc;
      });

      updateScenarios(updatedScenarios, true);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (draggedNode) {
      addLog("İstasyon Taşındı", "Yerleşim koordinatları güncellendi.");
      setDraggedNode(null);
    }
  };

  // Dynamic file/image upload scale determination
  const handleLayoutUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const dataUrl = event.target.result as string;
        
        // Dynamically measure image bounds
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          const naturalWidth = img.naturalWidth || 800;
          const naturalHeight = img.naturalHeight || 450;
          
          // Re-calculate scale: 1 pixel = physical-width / pixel-width
          const calculatedScale = activeLayout.widthMeters / naturalWidth;

          const updatedLayouts = activeScenario.layouts.map(ly => {
            if (ly.id === activeLayout.id) {
              return { 
                ...ly, 
                backgroundUrl: dataUrl,
                imageWidthPx: naturalWidth,
                imageHeightPx: naturalHeight,
                scaleFactor: parseFloat(calculatedScale.toFixed(5))
              };
            }
            return ly;
          });

          const updatedScenarios = scenarios.map(sc => {
            if (sc.id === activeScenario.id) {
              return { ...sc, layouts: updatedLayouts };
            }
            return sc;
          });

          updateScenarios(updatedScenarios);
          addLog("Layout Yüklendi", `Çözünürlük: ${naturalWidth}x${naturalHeight}px, Hesaplanan Ölçek: 1px = ${calculatedScale.toFixed(4)}m`);
        };
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearActiveScenario = () => {
    setShowClearConfirm(true);
  };

  const executeClearActiveScenario = () => {
    const updatedLayouts = activeScenario.layouts.map(ly => {
      if (ly.id === activeLayout.id) {
        return { ...ly, nodes: [], flows: [] };
      }
      return ly;
    });

    const updatedScenarios = scenarios.map(sc => {
      if (sc.id === activeScenario.id) {
        return { ...sc, layouts: updatedLayouts };
      }
      return sc;
    });

    updateScenarios(updatedScenarios);
    setSelectedNodeId(null);
    setSelectedFlowId(null);
    setShowClearConfirm(false);
    addLog("Temizlendi", "Aktif yerleşimdeki tüm istasyonlar ve çizim hatları silindi.");
  };

  // Add / Manage Multiple Layouts (Floor / Buildings)
  const handleAddNewLayout = (name: string) => {
    const newLy: FactoryLayout = {
      id: `ly_${Date.now()}`,
      name,
      backgroundUrl: null,
      scaleFactor: 0.15,
      widthMeters: 100,
      lengthMeters: 55,
      imageWidthPx: 800,
      imageHeightPx: 450,
      nodes: [],
      flows: []
    };

    const updatedScenarios = scenarios.map(sc => {
      if (sc.id === activeScenario.id) {
        return { 
          ...sc, 
          layouts: [...sc.layouts, newLy],
          activeLayoutId: newLy.id
        };
      }
      return sc;
    });

    updateScenarios(updatedScenarios);
    addLog("Kat/Bina Eklendi", `"${name}" yerleşim yöneticisine eklendi.`);
  };

  // Add Vertical Transfer (Elevator / Stair / Conveyor)
  const handleAddVerticalTransfer = (vt: Omit<VerticalTransfer, "id">) => {
    const newVt: VerticalTransfer = {
      ...vt,
      id: `vt_${Date.now()}`
    };

    const updatedScenarios = scenarios.map(sc => {
      if (sc.id === activeScenario.id) {
        return {
          ...sc,
          verticalTransfers: [...(sc.verticalTransfers || []), newVt]
        };
      }
      return sc;
    });

    updateScenarios(updatedScenarios);
    addLog("Dikey Taşıma Eklendi", `${newVt.name} dikey lojistik hattına dahil edildi.`);
  };

  // Excel Export workbook content XLS / CSV with BOM and proper regional separators
  const handleExportExcel = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM to fix Turkish characters in MS Excel!
    csvContent += "=== GEMBA OPEX PLATFORM - LOJİSTİK AKIŞ VE SPAGETTİ ANALİZI ===\r\n";
    csvContent += `Fabrika ID;${selectedCustomer.id}\r\n`;
    csvContent += `Müşteri Adı;${selectedCustomer.companyName}\r\n`;
    csvContent += `Oluşturma Tarihi;${new Date().toLocaleDateString("tr-TR")}\r\n\r\n`;

    // KPIs comparison
    const baseMetrics = getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]);
    const futureMetrics = getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]);

    csvContent += "=== KPI ANALİZ VE KIYASLAMA TABLOSU ===\r\n";
    csvContent += "Metrik;Mevcut Durum;Gelecek Yalın Durum;Fark (%);Tasarruf Tutarı (TL)\r\n";
    
    const distDiff = baseMetrics.totalDistance - futureMetrics.totalDistance;
    csvContent += `Toplam Akış Mesafesi (m);${baseMetrics.totalDistance};${futureMetrics.totalDistance};-%${((distDiff / (baseMetrics.totalDistance || 1)) * 100).toFixed(1)};-\r\n`;
    
    const costDiff = baseMetrics.materialHandlingCost - futureMetrics.materialHandlingCost;
    csvContent += `Yıllık Taşıma Maliyeti (TL);${baseMetrics.materialHandlingCost};${futureMetrics.materialHandlingCost};-%${((costDiff / (baseMetrics.materialHandlingCost || 1)) * 100).toFixed(1)};TL ${costDiff.toLocaleString()}\r\n`;

    const baseLaborCost = baseMetrics.walkingTime * simLaborCost;
    const futureLaborCost = futureMetrics.walkingTime * simLaborCost;
    const laborDiff = baseLaborCost - futureLaborCost;
    csvContent += `Yıllık Operatör Yürüyüş İş Gücü Maliyeti (TL);${baseLaborCost};${futureLaborCost};-%${((laborDiff / (baseLaborCost || 1)) * 100).toFixed(1)};TL ${laborDiff.toLocaleString()}\r\n`;

    const walkingDiff = baseMetrics.walkingTime - futureMetrics.walkingTime;
    csvContent += `Gereksiz Operatör Yürüyüşü (Saat/Yıl);${baseMetrics.walkingTime};${futureMetrics.walkingTime};-%${((walkingDiff / (baseMetrics.walkingTime || 1)) * 100).toFixed(1)};-\r\n`;

    const baseTotalCost = baseMetrics.materialHandlingCost + baseLaborCost;
    const futureTotalCost = futureMetrics.materialHandlingCost + futureLaborCost;
    const totalDiff = baseTotalCost - futureTotalCost;
    csvContent += `TOPLAM LOJİSTİK VE İŞ GÜCÜ MALİYETI (TL);${baseTotalCost};${futureTotalCost};-%${((totalDiff / (baseTotalCost || 1)) * 100).toFixed(1)};TL ${totalDiff.toLocaleString()}\r\n`;

    const crashDiff = baseMetrics.crossingCount - futureMetrics.crossingCount;
    csvContent += `Kritik Çakışma Noktaları (Adet);${baseMetrics.crossingCount};${futureMetrics.crossingCount};-%${((crashDiff / (baseMetrics.crossingCount || 1)) * 100).toFixed(1)};-\r\n`;

    const getScTotalArea = (sc: any) => {
      if (!sc) return 0;
      const activeL = sc.layouts?.find((l: any) => l.id === sc.activeLayoutId) || sc.layouts?.[0];
      if (!activeL) return 0;
      return activeL.nodes?.reduce((sum: number, n: any) => sum + (n.area || 0), 0) || 0;
    };
    const cArea = getScTotalArea(scenarios.find(s => s.id === "sc_current") || scenarios[0]);
    const fArea = getScTotalArea(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]);
    const sArea = Math.max(0, cArea - fArea);
    const sAreaPercent = cArea > 0 ? ((cArea - fArea) / cArea) * 100 : 0;
    const aAreaSavings = sArea * factoryAreaUnitPrice * 12;

    csvContent += `Fabrika İstasyon Alanı (m²);${cArea};${fArea};-%${sAreaPercent.toFixed(1)};-\r\n`;
    csvContent += `Yıllık Alan Kazanım Tasarrufu (TL);${cArea * factoryAreaUnitPrice * 12};${fArea * factoryAreaUnitPrice * 12};-%${sAreaPercent.toFixed(1)};TL ${aAreaSavings.toLocaleString()}\r\n\r\n`;

    // Segment raw details
    csvContent += "=== AKTİF KAT YERLEŞİM ELEMANLARI ===\r\n";
    csvContent += "İstasyon İsmi;Departman;Operatör Sayısı;Çevrim Süresi (sn);Alan (m2);Notlar\r\n";
    activeLayout.nodes.forEach(n => {
      csvContent += `"${n.name}";"${n.department}";${n.operatorCount};${n.cycleTime};${n.area};"${n.remarks}"\r\n`;
    });

    csvContent += "\r\n=== AKTİF AKIŞ SEGMENT DETAYLARI ===\r\n";
    csvContent += "Akış İsmi;Akış Tipi;Günlük Frekans;Toplam Mesafe (m);Maliyet Katkısı (TL);Seyahat Süresi (sn)\r\n";
    activeLayout.flows.forEach(flow => {
      let flowDist = 0;
      for (let i = 0; i < flow.waypoints.length - 1; i++) {
        const from = flow.waypoints[i];
        const to = flow.waypoints[i+1];
        flowDist += Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)) * activeLayout.scaleFactor;
      }
      const config = flowTypesConfig[flow.flowType];
      const annualCost = flow.frequency * flowDist * (config as any).costCoeff * simWorkingDays;
      const travelSec = flowDist / (config as any).speed;
      csvContent += `"${flow.name}";"${(config as any).name}";${flow.frequency};${flowDist.toFixed(1)};${annualCost.toFixed(0)};${travelSec.toFixed(1)}\r\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `GEMBA_Spaghetti_Analiz_Raporu_${selectedCustomer.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog("Excel İndirildi", "Analiz verileri Excel uyumlu CSV dosyası olarak Türkçe karakter desteğiyle dışa aktarıldı.");
  };

  // PDF Executive Report triggers printing view with full Canvas snapshot
  const handleExportPDF = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        const dataUrl = canvas.toDataURL("image/png");
        setPrintCanvasUrl(dataUrl);
      } catch (e) {
        console.error("Canvas to image conversion failed:", e);
      }
    }
    
    // Allow a small delay for state update rendering in PDF-only DOM container
    setTimeout(() => {
      window.print();
      addLog("PDF Raporu Alındı", "Yönetici özet raporu PDF olarak dışa aktarıldı/yazdırıldı.");
    }, 350);
  };

  // PNG download from canvas
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `Gemba_Spaghetti_Model_${activeScenario.id}_${activeLayout.id}.png`;
    link.href = dataUrl;
    link.click();
    addLog("Görsel İndirildi", "Canvas yerleşim şeması PNG olarak kaydedildi.");
  };

  // SVG vector file builder
  const handleExportSVG = () => {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 420" width="100%" height="100%">`;
    svg += `<rect width="760" height="420" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>`;

    // Draw flow path vectors
    activeLayout.flows.forEach(flow => {
      const cfg = flowTypesConfig[flow.flowType];
      let pathD = "";
      flow.waypoints.forEach((pt, i) => {
        pathD += `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y} `;
      });
      svg += `<path d="${pathD}" fill="none" stroke="${cfg.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" ${cfg.strokeDash !== "0" ? `stroke-dasharray="${cfg.strokeDash}"` : ""}/>`;
    });

    // Draw stations
    activeLayout.nodes.forEach(node => {
      svg += `<g transform="translate(${node.x - 45}, ${node.y - 20})">`;
      svg += `<rect width="90" height="40" rx="6" fill="#0f172a" stroke="#475569" stroke-width="2"/>`;
      svg += `<text x="45" y="18" fill="#ffffff" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle">${node.name}</text>`;
      svg += `<text x="45" y="30" fill="#94a3b8" font-family="sans-serif" font-size="7" text-anchor="middle">👥 ${node.operatorCount} Op</text>`;
      svg += `</g>`;
    });

    svg += `</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Gemba_Spaghetti_Vector_${activeLayout.id}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    addLog("SVG İndirildi", "Vektör çizimi SVG dosyası olarak kaydedildi.");
  };

  // Comparative metrics
  const currentScenario = scenarios.find(s => s.id === "sc_current") || scenarios[0];
  const futureScenario = scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0];
  
  const currentMetrics = getScenarioMetrics(currentScenario);
  const futureMetrics = getScenarioMetrics(futureScenario);

  const getScenarioTotalArea = (scen: Scenario) => {
    if (!scen) return 0;
    const activeL = scen.layouts?.find(l => l.id === scen.activeLayoutId) || scen.layouts?.[0];
    if (!activeL) return 0;
    return activeL.nodes.reduce((sum, node) => sum + (node.area || 0), 0);
  };

  const currentArea = getScenarioTotalArea(currentScenario);
  const futureArea = getScenarioTotalArea(futureScenario);
  const savedArea = Math.max(0, currentArea - futureArea);
  const savedAreaPercent = currentArea > 0 ? ((currentArea - futureArea) / currentArea) * 100 : 0;
  const annualAreaSavings = savedArea * factoryAreaUnitPrice * 12;

  // Recharts Pie distribution helper
  const getPieDistributionData = (layout: FactoryLayout) => {
    if (!layout) return [];
    const distMap: Record<string, number> = {};
    layout.flows.forEach(flow => {
      let flowDist = 0;
      for (let i = 0; i < flow.waypoints.length - 1; i++) {
        const from = flow.waypoints[i];
        const to = flow.waypoints[i+1];
        flowDist += Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)) * layout.scaleFactor;
      }
      const label = flowTypesConfig[flow.flowType].name;
      distMap[label] = (distMap[label] || 0) + Math.round(flowDist);
    });
    return Object.keys(distMap).map(key => ({
      name: key,
      value: distMap[key]
    }));
  };

  const pieData = getPieDistributionData(activeLayout);
  const colorsList = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

  // AI Context Optimization Advisor
  const getAIRecommendations = () => {
    const list = [];
    if (!activeLayout || !activeScenario) return [];
    if (activeMetrics.crossingCount > 4) {
      list.push({
        type: "danger",
        title: "Yüksek İSG ve Çakışma Riski",
        text: `Mevcut planda ${activeMetrics.crossingCount} kritik güzergah kesişmesi tespit edildi. Forklift ve yürüyüş yollarını birbirinden ayırmak, çakışmaları sıfıra indirmektedir.`
      });
    }
    
    // Look at distance
    const longestFlow = [...activeLayout.flows].sort((a,b) => {
      const getLen = (fl: FlowPath) => {
        let d = 0;
        for (let i = 0; i < fl.waypoints.length - 1; i++) {
          d += Math.sqrt(Math.pow(fl.waypoints[i+1].x - fl.waypoints[i].x, 2) + Math.pow(fl.waypoints[i+1].y - fl.waypoints[i].y, 2));
        }
        return d;
      };
      return getLen(b) - getLen(a);
    })[0];

    if (longestFlow) {
      list.push({
        type: "warning",
        title: `En Uzun Akış: ${longestFlow.name}`,
        text: `Bu akış hattı toplam taşıma mesafesinin ciddi bir kısmını oluşturmaktadır. Bu hattaki istasyonları yerleşimde fiziksel olarak yan yana kaydırmak yıllık yüksek lojistik kazanç sağlar.`
      });
    }

    // Elevator bottleneck
    const elevators = activeScenario.verticalTransfers?.filter(v => v.type === "elevator");
    const totalElevatorFreq = elevators?.reduce((sum, v) => sum + v.frequency, 0) || 0;
    if (totalElevatorFreq > 10) {
      list.push({
        type: "info",
        title: "Dikey Taşıma Darboğazı",
        text: `Katlar arası asansör lojistik frekansı günlük ${totalElevatorFreq} sefere ulaştı. Sürekli beslemeli dikey bir asansör veya konveyör şutu kullanımı zaman kayıplarını %65 azaltabilir.`
      });
    }

    return list;
  };

  // ROI calculations
  const currentLaborSavingsCost = currentMetrics.walkingTime * simLaborCost;
  const futureLaborSavingsCost = futureMetrics.walkingTime * simLaborCost;
  const totalCurrentCost = currentMetrics.materialHandlingCost + currentLaborSavingsCost;
  const totalFutureCost = futureMetrics.materialHandlingCost + futureLaborSavingsCost;
  const annualSavings = Math.max(0, totalCurrentCost - totalFutureCost);
  const roiPercent = simImplementationCost > 0 ? (annualSavings / simImplementationCost) * 100 : 0;
  const paybackMonths = annualSavings > 0 ? (simImplementationCost / annualSavings) * 12 : 0;

  // Narrative comparison text — generated from the actual current/future scenario metrics
  // instead of static boilerplate, so it reflects whatever the user actually redrew.
  const distanceReductionPercent = currentMetrics.totalDistance > 0
    ? ((currentMetrics.totalDistance - futureMetrics.totalDistance) / currentMetrics.totalDistance) * 100
    : 0;
  const crossingReduction = currentMetrics.crossingCount - futureMetrics.crossingCount;
  const aiAdvisorSummary = (() => {
    const parts: string[] = [];
    if (distanceReductionPercent > 0) {
      parts.push(`toplam malzeme/operatör hareket mesafesi %${distanceReductionPercent.toFixed(1)} azaltılarak`);
    } else if (distanceReductionPercent < 0) {
      parts.push(`toplam hareket mesafesi %${Math.abs(distanceReductionPercent).toFixed(1)} artmış olsa da`);
    }
    if (crossingReduction > 0) {
      parts.push(`${crossingReduction} akış kesişmesi ortadan kaldırılarak`);
    } else if (crossingReduction < 0) {
      parts.push(`${Math.abs(crossingReduction)} yeni akış kesişmesi oluşarak`);
    }
    const changeDesc = parts.length > 0 ? parts.join(" ve ") : "istasyon ve akış yerleşimi yeniden düzenlenerek";
    return `Yapılan lojistik ve spagetti akış simülasyonu sonucunda, ${changeDesc} yıllık taşıma maliyetinde ₺${Math.round(annualSavings).toLocaleString()} tasarruf potansiyeli hesaplanmıştır.`;
  })();
  const improvementProcessSummary = (() => {
    const bits: string[] = [];
    bits.push(distanceReductionPercent !== 0
      ? `Gelecek tasarımda toplam akış mesafesi ${currentMetrics.totalDistance.toLocaleString()} m'den ${futureMetrics.totalDistance.toLocaleString()} m'ye (%${distanceReductionPercent.toFixed(1)} ${distanceReductionPercent >= 0 ? "azalış" : "artış"}) değişmiştir.`
      : `Gelecek tasarımda toplam akış mesafesi ${futureMetrics.totalDistance.toLocaleString()} m olarak ölçülmüştür.`);
    if (crossingReduction !== 0) {
      bits.push(`Lojistik hat kesişme sayısı ${currentMetrics.crossingCount}'den ${futureMetrics.crossingCount}'e ${crossingReduction > 0 ? "düşürülmüştür" : "yükselmiştir"}.`);
    }
    return bits.join(" ");
  })();

  // Render variables
  const [newLayoutName, setNewLayoutName] = useState("");
  const [showAddLayoutModal, setShowAddLayoutModal] = useState(false);

  // Manage custom dikey taşıma state
  const [newVtName, setNewVtName] = useState("Asansör");
  const [newVtType, setNewVtType] = useState<"stairs" | "elevator" | "conveyor">("elevator");
  const [newVtFrom, setNewVtFrom] = useState("");
  const [newVtTo, setNewVtTo] = useState("");
  const [newVtFreq, setNewVtFreq] = useState(10);
  const [newVtDist, setNewVtDist] = useState(5.0);

  // Pre-fill fields
  useEffect(() => {
    if (activeScenario && activeScenario.layouts.length > 1) {
      setNewVtFrom(activeScenario.layouts[0].id);
      setNewVtTo(activeScenario.layouts[1].id);
    }
  }, [activeScenario]);

  return (
    <div className="space-y-6">
      
      {/* Platform Title Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-md tracking-wider uppercase">Sistem Modülü</span>
            <span className="text-[10px] text-slate-400 font-bold">• Fabrika ID: {selectedCustomer.id}</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">Endüstriyel Spaghetti Akış &amp; Yerleşim Analizi</h1>
        </div>
        
        {/* Scenario Version Selector & Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">Senaryo:</span>
            <select
              value={activeScenarioId}
              onChange={(e) => {
                const scId = e.target.value;
                setActiveScenarioId(scId);
                setSelectedNodeId(null);
                setSelectedFlowId(null);
                if (scId === "sc_current") {
                  setActiveTab("current");
                } else {
                  setActiveTab("future");
                }
                addLog("Senaryo Değiştirildi", `Aktif senaryo sürümü güncellendi.`);
              }}
              className="bg-white border border-slate-200 text-xs font-black text-slate-800 rounded-lg py-1 px-2.5 focus:outline-none"
            >
              {scenarios.map(sc => (
                <option key={sc.id} value={sc.id}>
                  {sc.name} ({sc.version})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              // Duplicate to future state if clicked
              if (scenarios.length === 1) {
                const dup: Scenario = {
                  id: "sc_future",
                  name: "Yalın U-Hücre ve Süpermarket Tasarımı (Gelecek v1)",
                  version: "Future v1",
                  activeLayoutId: activeScenario.activeLayoutId,
                  layouts: JSON.parse(JSON.stringify(activeScenario.layouts)),
                  verticalTransfers: JSON.parse(JSON.stringify(activeScenario.verticalTransfers))
                };
                updateScenarios([...scenarios, dup]);
                setActiveScenarioId("sc_future");
                setActiveTab("future");
                addLog("Gelecek Durum Yaratıldı", "Mevcut yerleşim Gelecek Durum simülasyonu için kopyalandı.");
              } else {
                const fut = scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0];
                setActiveScenarioId(fut.id);
                setActiveTab(fut.id === "sc_future" ? "future" : "current");
              }
            }}
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1 border border-indigo-100"
          >
            <Sparkles className="w-3.5 h-3.5" /> Gelecek Yalın Tasarım
          </button>
        </div>
      </div>

      {/* Main Workspace Navigation: Mevcut Durum, İyileştirme Süreci, Karşılaştırma Tablosu */}
      <div className="flex border-b border-slate-200 gap-1 bg-white p-1 rounded-xl border">
        <button
          onClick={() => {
            setActiveTab("current");
            setActiveScenarioId("sc_current");
            setSelectedNodeId(null);
            setSelectedFlowId(null);
            addLog("Mevcut Durum Analizi", "Mevcut Fabrika Akış Yerleşimi görünümüne geçildi.");
          }}
          className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "current" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Sliders className="w-4 h-4" /> 1. Mevcut Durum Analizi
        </button>
        <button
          onClick={() => {
            setActiveTab("future");
            setActiveScenarioId("sc_future");
            setSelectedNodeId(null);
            setSelectedFlowId(null);
            addLog("İyileştirme Süreci", "Yalın U-Hücre ve Süpermarket Tasarımı görünümüne geçildi.");
          }}
          className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "future" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Sparkles className="w-4 h-4" /> 2. İyileştirme Süreci (Gelecek Tasarım)
        </button>
        <button
          onClick={() => {
            setActiveTab("comparison");
            addLog("Karşılaştırma Analizi", "Mevcut ve gelecek durum karşılaştırma matrisine geçildi.");
          }}
          className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "comparison" ? "bg-emerald-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <BarChart2 className="w-4 h-4" /> 3. Karşılaştırma Tablosu &amp; ROI Analizi
        </button>
        <button
          onClick={() => {
            setActiveTab("mali-veri");
            addLog("Mali Veri Girişleri", "Mali veri ve çalışma parametreleri yönetim paneline geçildi.");
          }}
          className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "mali-veri" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Coins className="w-4 h-4" /> 4. Mali Veri &amp; Parametre Girişi
        </button>
      </div>

      {activeTab === "comparison" ? (
        /* COMPARATIVE ANALYSIS DASHBOARD & EXECUTIVE REPORTS */
        <div className="space-y-6">
          
          {/* Comparative Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Yıllık Taşıma Tasarrufu</span>
                <span className="text-xl font-black text-emerald-600 mt-1 block">
                  ₺{annualSavings.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                  📈 %{(((currentMetrics.materialHandlingCost - futureMetrics.materialHandlingCost) / currentMetrics.materialHandlingCost) * 100).toFixed(0)} Maliyet Azaltımı
                </span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <Coins className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Yatırım Payback Süresi</span>
                <span className="text-xl font-black text-slate-800 mt-1 block">
                  {paybackMonths > 0 ? `${paybackMonths.toFixed(1)} Ay` : "Yatırımsız Kazanım"}
                </span>
                <span className="text-[10px] text-slate-400 font-medium block mt-1">
                  Yatırım ROI: {roiPercent.toFixed(0)}% / Yıl
                </span>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Kritik Çakışma Önleme</span>
                <span className="text-xl font-black text-rose-600 mt-1 block">
                  {currentMetrics.crossingCount} ➜ {futureMetrics.crossingCount}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                  🛡️ Lojistik Kesişmeleri Önleme
                </span>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Gereksiz Yürüyüş Tasarrufu</span>
                <span className="text-xl font-black text-indigo-900 mt-1 block">
                  {(currentMetrics.walkingTime - futureMetrics.walkingTime).toLocaleString()} Saat / Yıl
                </span>
                <span className="text-[10px] text-indigo-600 font-bold block mt-1">
                  🌱 Katma Değersiz Hareket Engellendi
                </span>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Activity className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Kazanılan Fabrika Alanı</span>
                <span className="text-xl font-black text-teal-600 mt-1 block">
                  {savedArea} m² Açıldı
                </span>
                <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                  📐 %{savedAreaPercent.toFixed(1)} Alan Tasarrufu
                </span>
                <span className="text-[11px] text-slate-500 font-bold block mt-0.5">
                  💰 Yıllık: ₺{annualAreaSavings.toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
                <Maximize2 className="w-6 h-6" />
              </div>
            </div>

          </div>

          {/* Graphical Comparison Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase">Mesafe ve Yıllık Taşıma Maliyet Analizi</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Toplam Mesafe (M)", Mevcut: currentMetrics.totalDistance, Gelecek: futureMetrics.totalDistance },
                      { name: "Yıllık Taşıma (k₺)", Mevcut: Math.round(currentMetrics.materialHandlingCost / 1000), Gelecek: Math.round(futureMetrics.materialHandlingCost / 1000) }
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Mevcut" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Gelecek" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Advisor & Executive Recommendations Card */}
            <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-1.5 border-b border-slate-800 pb-3 mb-4">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="text-xs font-black uppercase text-white tracking-tight">Spaghetti AI Akış Analiz Danışmanı</h3>
                </div>
                
                <div className="space-y-4 text-xs">
                  <p className="text-slate-300 leading-relaxed">
                    {aiAdvisorSummary}
                  </p>

                  <div className="space-y-2">
                    {getAIRecommendations().map((rec, i) => (
                      <div key={i} className="p-3 bg-slate-850 border-l-4 border-amber-500 rounded text-slate-200">
                        <span className="font-bold text-amber-400 block uppercase text-[11px] mb-0.5">{rec.title}</span>
                        {rec.text}
                      </div>
                    ))}
                    {getAIRecommendations().length === 0 && (
                      <div className="p-3 bg-slate-850 border-l-4 border-emerald-500 rounded text-slate-200">
                        <span className="font-bold text-emerald-400 block uppercase text-[11px] mb-0.5">Süreçler Optimize Edildi</span>
                        Lojistik akış kesişmesi ve dikey taşıma darboğazı tespit edilmedi. Harika bir iş çıkardınız!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PDF Print Executive Trigger */}
              <div className="mt-6 flex flex-col gap-2">
                <button 
                  onClick={handleExportPDF}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4" /> Yönetici Karşılaştırma Raporunu Yazdır / PDF Dışa Aktar
                </button>
                <div className="text-[10px] text-slate-400 text-center font-mono">
                  *Bu rapor, FactoryID: <strong>{selectedCustomer.id}</strong> ilişkisel veri şemasıyla doğrulanmıştır.
                </div>
              </div>

            </div>

          </div>

          {/* SECURELY DETAILED ANALYSIS SECTION: MEVCUT DURUM -> İYİLEŞTİRME SÜRECİ -> KARŞILAŞTIRMA TABLOSU */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5 uppercase">
                <FileText className="w-5 h-5 text-indigo-600" />
                Spaghetti Akış Karşılaştırmalı Değerlendirme Raporu
              </h3>
              <p className="text-xs text-slate-500">Mevcut yerleşim düzeni ile yalın gelecek tasarımı arasındaki farklar, uygulanan iyileştirme süreçleri ve finansal etkiler.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Mevcut Durum Analizi */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-rose-800 bg-rose-50 px-3 py-1.5 rounded-lg w-fit text-xs font-black">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                  1. MEVCUT DURUM ANALİZİ (BAZ ÇİZGİ)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Fabrika yerleşiminde istasyonlar arası mesafeler geniş ve dağınıktır. Doğrusal akış hattı eksikliği nedeniyle yoğun taşıma israfı (transportation waste) ve operatör yürüme kayıpları mevcuttur. 
                </p>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-sans">Toplam Akış:</span>
                    <strong className="text-slate-800 text-sm font-black">{currentMetrics.totalDistance.toLocaleString()} m</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-sans">Yıllık Maliyet:</span>
                    <strong className="text-rose-600 text-sm font-black">₺{currentMetrics.materialHandlingCost.toLocaleString()}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-sans">Akış Çakışması:</span>
                    <strong className="text-rose-600 text-sm font-black">{currentMetrics.crossingCount} Kesişme</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-sans">Operatör Yürüyüşü:</span>
                    <strong className="text-slate-800 text-sm font-black">{currentMetrics.walkingTime.toLocaleString()} Saat/Yıl</strong>
                  </div>
                </div>
              </div>

              {/* 2. İyileştirme Süreci (Gelecek Tasarım) */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg w-fit text-xs font-black">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  2. İYİLEŞTİRME SÜRECİ (GELECEK TASARIM)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {improvementProcessSummary}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-sans">Gelecek Akış:</span>
                    <strong className="text-slate-800 text-sm font-black">{futureMetrics.totalDistance.toLocaleString()} m</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-sans">Gelecek Maliyet:</span>
                    <strong className="text-indigo-600 text-sm font-black">₺{futureMetrics.materialHandlingCost.toLocaleString()}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-sans">Lojistik Kesişme:</span>
                    <strong className="text-indigo-600 text-sm font-black">{futureMetrics.crossingCount} Kesişme</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-sans">Op. Yürüyüş Kazanımı:</span>
                    <strong className="text-indigo-600 text-sm font-black">{(currentMetrics.walkingTime - futureMetrics.walkingTime).toLocaleString()} Saat/Yıl</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Karşılaştırma Tablosu */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
                <BarChart2 className="w-4 h-4 text-emerald-600" />
                3. ENERJİ, MESAFE VE MALİYET KARŞILAŞTIRMA TABLOSU
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider">
                      <th className="p-3">Operasyonel Metrik</th>
                      <th className="p-3 text-right">Mevcut Durum (Baz)</th>
                      <th className="p-3 text-right">İyileştirme Süreci (Gelecek Durum)</th>
                      <th className="p-3 text-right">Fark (%)</th>
                      <th className="p-3 text-right text-emerald-400">Yıllık Tasarruf (TL)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                    <tr>
                      <td className="p-3 font-bold bg-slate-50/50">Toplam Lojistik Akış Mesafesi</td>
                      <td className="p-3 text-right font-mono">{currentMetrics.totalDistance.toLocaleString()} m</td>
                      <td className="p-3 text-right font-mono">{futureMetrics.totalDistance.toLocaleString()} m</td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-bold">
                        -{(((currentMetrics.totalDistance - futureMetrics.totalDistance) / (currentMetrics.totalDistance || 1)) * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">-</td>
                    </tr>
                    <tr className="bg-slate-50/30">
                      <td className="p-3 font-bold bg-slate-50/50">Yıllık Malzeme Taşıma Maliyeti</td>
                      <td className="p-3 text-right font-mono">₺{currentMetrics.materialHandlingCost.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">₺{futureMetrics.materialHandlingCost.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-bold">
                        -{(((currentMetrics.materialHandlingCost - futureMetrics.materialHandlingCost) / (currentMetrics.materialHandlingCost || 1)) * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-extrabold">
                        ₺{(currentMetrics.materialHandlingCost - futureMetrics.materialHandlingCost).toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold bg-slate-50/50">Gereksiz Operatör Yürüyüş Süresi</td>
                      <td className="p-3 text-right font-mono">{currentMetrics.walkingTime.toLocaleString()} Saat/Yıl</td>
                      <td className="p-3 text-right font-mono">{futureMetrics.walkingTime.toLocaleString()} Saat/Yıl</td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-bold">
                        -{(((currentMetrics.walkingTime - futureMetrics.walkingTime) / (currentMetrics.walkingTime || 1)) * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">-</td>
                    </tr>
                    <tr className="bg-slate-50/10">
                      <td className="p-3 font-bold bg-slate-50/50">Yıllık Operatör Yürüyüş İş Gücü Maliyeti (₺)</td>
                      <td className="p-3 text-right font-mono">₺{currentLaborSavingsCost.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">₺{futureLaborSavingsCost.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-bold">
                        -{(((currentLaborSavingsCost - futureLaborSavingsCost) / (currentLaborSavingsCost || 1)) * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-bold">
                        ₺{(currentLaborSavingsCost - futureLaborSavingsCost).toLocaleString()}
                      </td>
                    </tr>
                    <tr className="bg-indigo-50/40 text-indigo-950 font-black">
                      <td className="p-3 font-bold bg-indigo-50/20">TOPLAM YILLIK SİMÜLE EDİLEN LOJİSTİK MALİYET</td>
                      <td className="p-3 text-right font-mono text-rose-600">₺{totalCurrentCost.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-indigo-600">₺{totalFutureCost.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-extrabold">
                        -{(((totalCurrentCost - totalFutureCost) / (totalCurrentCost || 1)) * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-extrabold text-[13px] bg-emerald-500/10 rounded-lg">
                        ₺{annualSavings.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/30">
                      <td className="p-3 font-bold bg-slate-50/50">Kritik Akış Kesişme Noktaları</td>
                      <td className="p-3 text-right font-mono">{currentMetrics.crossingCount} Nokta</td>
                      <td className="p-3 text-right font-mono">{futureMetrics.crossingCount} Nokta</td>
                      <td className="p-3 text-right font-mono text-rose-600 font-bold">
                        {currentMetrics.crossingCount > 0 ? `-${(((currentMetrics.crossingCount - futureMetrics.crossingCount) / currentMetrics.crossingCount) * 100).toFixed(0)}%` : "0%"}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">-</td>
                    </tr>
                    <tr className="bg-slate-50/20">
                      <td className="p-3 font-bold bg-slate-50/50">Fabrika İstasyon Alanı (m²)</td>
                      <td className="p-3 text-right font-mono">{currentArea.toLocaleString()} m²</td>
                      <td className="p-3 text-right font-mono">{futureArea.toLocaleString()} m²</td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-bold">
                        {savedAreaPercent > 0 ? `-${savedAreaPercent.toFixed(1)}%` : `${savedAreaPercent.toFixed(1)}%`}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">-</td>
                    </tr>
                    <tr className="bg-slate-50/40 text-slate-900 font-bold">
                      <td className="p-3 font-bold bg-slate-50/50">Yıllık Alan Kazanım Tasarrufu (TL)</td>
                      <td className="p-3 text-right font-mono text-rose-600">₺{(currentArea * factoryAreaUnitPrice * 12).toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-indigo-600">₺{(futureArea * factoryAreaUnitPrice * 12).toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-extrabold">
                        -{savedAreaPercent.toFixed(1)}%
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-extrabold text-[13px] bg-emerald-500/10 rounded-lg">
                        ₺{annualAreaSavings.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Interactive What-if ROI Simulator Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1">
                <Sliders className="w-4.5 h-4.5 text-indigo-600" />
                Dinamik "What-If" Lojistik ROI Simülatörü
              </h3>
              <p className="text-xs text-slate-500">Maliyet katsayılarını ve iş gücü saatlik ücretlerini değiştirerek yatırım amortisman analizini canlı simüle edin.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-500 font-bold">Operatör İş Gücü Saatlik Ücreti (₺)</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold focus:outline-none"
                  value={simLaborCost}
                  onChange={(e) => setSimLaborCost(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-bold">Forklift Yakıt/Enerji Çarpanı</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold focus:outline-none"
                  value={simFuelCostCoeff}
                  onChange={(e) => setSimFuelCostCoeff(parseFloat(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-bold">Yıllık Çalışma Günü (Gün)</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold focus:outline-none"
                  value={simWorkingDays}
                  onChange={(e) => setSimWorkingDays(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-bold">Öngörülen Yatırım Amortisman Maliyeti (₺)</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold focus:outline-none"
                  value={simImplementationCost}
                  onChange={(e) => setSimImplementationCost(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

        </div>
      ) : activeTab === "mali-veri" ? (
        /* NEW FINANCIAL AND PARAMETER ENTRY SCREEN */
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-md font-black text-slate-900 flex items-center gap-1.5 uppercase">
                  <Coins className="text-indigo-600 w-5 h-5" />
                  Mali Veriler ve Parametre Giriş Ekranı
                </h3>
                <p className="text-xs text-slate-500">Maaşlar, işveren maliyetleri, fabrika m² birim fiyatı ve operatör hızı parametrelerini güncelleyin.</p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full">
                Saatlik İşçilik: ₺{simLaborCost}/Saat
              </span>
            </div>

            {/* Sub-panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Card 1: Labor Cost Parameters */}
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">👥</span>
                  <h4 className="text-sm font-black text-slate-900">İşçilik Maaş ve İşveren Maliyet Girdileri</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold block">Aylık Net Operatör Maaşı (₺/Ay)</label>
                    <input
                      type="number"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={netMonthlySalary}
                      onChange={(e) => setNetMonthlySalary(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold block">İşveren Ek Yük ve Vergiler (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 pr-8 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={employerOverheadPercent}
                        onChange={(e) => setEmployerOverheadPercent(parseFloat(e.target.value) || 0)}
                      />
                      <span className="absolute right-3 top-3 text-slate-400 font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-slate-400">SGK, Yemek, Yol ve Sosyal haklar dahil ek maliyet çarpanı.</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold block">Aylık Fiili Çalışma Süresi (Saat/Ay)</label>
                    <input
                      type="number"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={monthlyWorkingHours}
                      onChange={(e) => setMonthlyWorkingHours(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold block">Hesaplanan İşveren Saatlik Maliyeti</label>
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 font-black rounded-xl p-2.5 text-center text-[13px]">
                      ₺{simLaborCost} / Saat
                    </div>
                  </div>
                </div>

                <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3">
                  <strong className="block mb-0.5">Hesaplama Mantığı:</strong>
                  Saatlik Maliyet = [Net Maaş × (1 + Ek Yük / 100)] / Aylık Çalışma Saati. 
                  Yıllık yürüyüş kayıpları bu maliyet çarpanı temel alınarak finansallaştırılır.
                </div>
              </div>

              {/* Card 2: Factory Area and Financial Value */}
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">📐</span>
                    <h4 className="text-sm font-black text-slate-900">Fabrika Alan Değeri ve Kazanımı</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-500 font-bold block">Aylık m² Birim Değeri / Kira Bedeli (₺ / m²)</label>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={factoryAreaUnitPrice}
                        onChange={(e) => setFactoryAreaUnitPrice(parseFloat(e.target.value) || 0)}
                      />
                      <span className="text-[10px] text-slate-400">Fabrika alanının m² başına aylık fırsat maliyeti veya kira bedeli.</span>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-950">
                    <span className="text-xs font-extrabold uppercase tracking-wide block">Alan Tasarrufu Simülasyon Özeti</span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Mevcut İstasyon Alanı:</span>
                        <strong className="text-slate-800 font-bold">{currentArea.toLocaleString()} m²</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Gelecek İstasyon Alanı:</span>
                        <strong className="text-slate-800 font-bold">{futureArea.toLocaleString()} m²</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Açılan Değerli Alan:</span>
                        <strong className="text-emerald-600 font-bold">{savedArea.toLocaleString()} m² ({savedAreaPercent.toFixed(1)}%)</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Yıllık Alan Finansal Değeri:</span>
                        <strong className="text-emerald-600 font-black">₺{annualAreaSavings.toLocaleString()} / Yıl</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] bg-slate-150 border border-slate-200 text-slate-600 rounded-lg p-3 font-mono">
                  *Açılan Değerli Alan = Mevcut Alan - Gelecek Alan.
                  <br />
                  *Yıllık Alan Tasarrufu = Açılan Alan × m² Birim Fiyatı × 12.
                </div>
              </div>

            </div>

            {/* Operator Transport Time Calculation Detail Section */}
            <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">⏱️</span>
                <h4 className="text-sm font-black text-slate-900">Operatör Taşıma Zamanı Nasıl Hesaplanıyor?</h4>
              </div>

              <div className="text-xs text-slate-700 space-y-3">
                <p>
                  Sistem, her bir lojistik ve operatör akış hattı için seyahat sürelerini ve yıllık maliyetleri şu formüller doğrultusunda dinamik olarak hesaplar:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-extrabold text-indigo-950 block">1. Mesafe Hesaplama:</span>
                    <p className="text-slate-600">
                      Çizilen her bir hattın pikseller cinsinden uzunluğu, seçilen katın fiziksel boyutuna göre hesaplanan <strong>Ölçek Katsayısı (metre/piksel)</strong> ile çarpılarak gerçek taşıma mesafesi (<strong className="font-bold">Mesafe - m</strong>) bulunur.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-extrabold text-indigo-950 block">2. Sefer Başı Taşıma Zamanı (sn):</span>
                    <div className="bg-indigo-50/50 p-2 rounded border border-indigo-100 font-mono text-[11px] text-center my-1">
                      Taşıma Süresi = Mesafe (m) / Akış Tipi Hızı (m/sn)
                    </div>
                    <p className="text-slate-600">
                      Hız, akış tipine bağlıdır. Örneğin, Operatör Yürüyüş hızı default olarak <strong>1.2 m/sn</strong> kabul edilir.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-extrabold text-indigo-950 block">3. Yıllık Toplam Seyahat Süresi (Saat/Yıl):</span>
                    <div className="bg-indigo-50/50 p-2 rounded border border-indigo-100 font-mono text-[11px] text-center my-1">
                      Yıllık Süre = (Taşıma Süresi × Günlük Frekans × Yıllık Çalışma Günü) / 3600
                    </div>
                    <p className="text-slate-600">
                      Her akışın kendi <strong>günlük frekansı</strong> vardır. Yıllık toplam süre bu frekanslar ve yıllık çalışma günü (default: 250) çarpılarak hesaplanır.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-extrabold text-indigo-950 block">4. Yıllık Operatör Yürüyüş İş Gücü Maliyeti (₺/Yıl):</span>
                    <div className="bg-indigo-50/50 p-2 rounded border border-indigo-100 font-mono text-[11px] text-center my-1">
                      Yürüyüş Maliyeti = Yıllık Süre (Saat) × Saatlik İşveren Maliyeti (₺/Saat)
                    </div>
                    <p className="text-slate-600">
                      Operatörün her yürüyüşü katma değersiz zaman (muda) olarak kabul edilir ve saatlik işveren maliyeti ile çarpılarak israfın finansal boyutu ortaya konur.
                    </p>
                  </div>
                </div>

                <div className="bg-indigo-900 text-white p-4 rounded-xl space-y-3">
                  <span className="font-black text-xs block uppercase tracking-wide">Akış Tipi Hız ve Maliyet Çarpan Ayarları</span>
                  <p className="text-[11px] text-indigo-200">Taşıma araçlarının ve operatörlerin ortalama hız ve maliyet katsayılarını özelleştirebilirsiniz:</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(flowTypesConfig).map(([key, config]) => {
                      const cfg = config as any;
                      return (
                        <div key={key} className="p-3 bg-indigo-950/60 border border-indigo-800 rounded-lg space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                            <span className="font-bold text-[11px] text-indigo-100">{cfg.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-indigo-200">
                            <div>
                              <span>Hız (m/s):</span>
                              <input
                                type="number"
                                step="0.1"
                                className="w-full bg-indigo-900 border border-indigo-700 rounded px-1.5 py-0.5 text-white font-bold text-center"
                                value={cfg.speed}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0.1;
                                  setFlowTypesConfig(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key as keyof typeof FLOW_TYPES_CONFIG], speed: val }
                                  }));
                                }}
                              />
                            </div>
                            <div>
                              <span>Çarpan:</span>
                              <input
                                type="number"
                                step="0.1"
                                className="w-full bg-indigo-900 border border-indigo-700 rounded px-1.5 py-0.5 text-white font-bold text-center"
                                value={cfg.costCoeff}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setFlowTypesConfig(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key as keyof typeof FLOW_TYPES_CONFIG], costCoeff: val }
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-indigo-900 text-white p-4 rounded-xl space-y-3">
                  <span className="font-black text-xs block uppercase tracking-wide">Kat Arası Taşıma (Dikey Transfer) Maliyet Katsayıları</span>
                  <p className="text-[11px] text-indigo-200">Asansör, konveyör ve merdiven kullanımının sefer başına maliyet katsayısını özelleştirebilirsiniz (birim: ₺/sefer/metre baz çarpanı):</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {([
                      { key: "elevator", label: "Asansör" },
                      { key: "conveyor", label: "Konveyör" },
                      { key: "stairs", label: "Merdiven" }
                    ] as const).map(({ key, label }) => (
                      <div key={key} className="p-3 bg-indigo-950/60 border border-indigo-800 rounded-lg space-y-1">
                        <span className="font-bold text-[11px] text-indigo-100">{label}</span>
                        <div>
                          <span className="text-[10px] text-indigo-200">Çarpan:</span>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full bg-indigo-900 border border-indigo-700 rounded px-1.5 py-0.5 text-white font-bold text-center"
                            value={verticalTransferCoeffs[key]}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setVerticalTransferCoeffs(prev => ({ ...prev, [key]: val }));
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      ) : (
        /* CURRENT OR FUTURE STATE WORKSPACE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Canvas Panel (Col-Span-8) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Drawing controls toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-3 items-center justify-between shadow-xs">
              
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setDrawingMode("select")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                    drawingMode === "select" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Maximize2 className="w-3.5 h-3.5" /> Seç &amp; Taşı
                </button>
                <button
                  onClick={() => { setDrawingMode("draw"); setSelectedFlowId(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                    drawingMode === "draw" ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" /> Akış Çiz
                </button>
                <button
                  onClick={() => setDrawingMode("node")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                    drawingMode === "node" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" /> İstasyon Ekle
                </button>
              </div>

              {/* Undo / Redo & Clear Actions */}
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-150">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    historyIndex > 0 ? "bg-white text-slate-800 shadow-3xs hover:bg-slate-100" : "text-slate-300 cursor-not-allowed"
                  }`}
                  title="Geri Al"
                >
                  <Undo className="w-3.5 h-3.5" /> Geri
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    historyIndex < history.length - 1 ? "bg-white text-slate-800 shadow-3xs hover:bg-slate-100" : "text-slate-300 cursor-not-allowed"
                  }`}
                  title="İleri"
                >
                  <Redo className="w-3.5 h-3.5" /> İleri
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1" />
                <button
                  onClick={handleClearActiveScenario}
                  className="px-2.5 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-transparent hover:border-rose-100"
                  title="Tüm çizimleri temizle"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Temizle
                </button>
              </div>

              {/* Layout Export Actions */}
              <div className="flex items-center space-x-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLayoutUpload}
                  className="hidden"
                  accept="image/*"
                />

                {/* Direct XLS Export Icon Button */}
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                  title="Excel (XLS) Çıktısı Al"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>XLS Çıktısı</span>
                </button>

                {/* Direct PDF Export Icon Button */}
                <button
                  onClick={handleExportPDF}
                  className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                  title="PDF Yönetici Raporu Al"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  <span>PDF Raporu</span>
                </button>
                
                {/* Custom dropdown actions */}
                <div className="relative group">
                  <button className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer">
                    <Download className="w-3.5 h-3.5" /> Diğer Çıktılar
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 hidden group-hover:block z-30 w-48 text-xs font-bold">
                    <button onClick={handleExportExcel} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel Listesi İndir
                    </button>
                    <button onClick={handleExportPDF} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer">
                      <FileText className="w-4 h-4 text-rose-600" /> PDF Raporu Oluştur
                    </button>
                    <button onClick={handleExportSVG} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer">
                      <FileText className="w-4 h-4 text-orange-600" /> SVG Vektör Kaydet
                    </button>
                    <button onClick={handleExportPNG} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer">
                      <Camera className="w-4 h-4 text-blue-600" /> PNG Görsel İndir
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  title="Kendi yerleşim planınızı yükleyin"
                >
                  🖼️ Layout Yükle
                </button>
              </div>

            </div>

            {/* FLOW TYPE SELECTOR & FULLSCREEN ACTION CONTROLLER */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Activity className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Lojistik Akış Çizim Tipi
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Akış tipini seçin, ardından yukarıdaki <strong className="text-indigo-600">Akış Çiz</strong> butonuyla çizmeye başlayın.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Active Color Dot */}
                <div 
                  className="w-3.5 h-3.5 rounded-full border border-slate-200 shadow-3xs shrink-0 transition-colors duration-200"
                  style={{ backgroundColor: flowTypesConfig[selectedFlowType].color }}
                  title="Aktif Akış Rengi"
                />
                
                {/* Premium Select Dropdown */}
                <select
                  value={selectedFlowType}
                  onChange={(e) => {
                    setSelectedFlowType(e.target.value as any);
                    setDrawingMode("draw");
                    setSelectedFlowId(null); // Clear selected flow to start a new path
                    addLog("Akış Tipi Değiştirildi", `Yeni çizim akış tipi: ${flowTypesConfig[e.target.value as keyof typeof FLOW_TYPES_CONFIG].name}`);
                  }}
                  className="bg-white border border-slate-200 text-xs font-black text-slate-800 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer min-w-[200px]"
                >
                  {Object.entries(flowTypesConfig).map(([key, config]) => (
                    <option key={key} value={key}>
                      {(config as any).name}
                    </option>
                  ))}
                </select>

                {/* Fullscreen Toggle */}
                <button
                  onClick={() => {
                    setIsFullscreen(!isFullscreen);
                    addLog(
                      isFullscreen ? "Normal Ekran" : "Tam Ekran Çizim",
                      isFullscreen ? "Normal ekran görünümüne dönüldü." : "Tam ekran geniş çizim görünümüne geçildi."
                    );
                  }}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 font-black text-xs ${
                    isFullscreen
                      ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                      : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
                  }`}
                  title={isFullscreen ? "Normal Ekrana Dön" : "Geniş Ekran Moduna Geç"}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Normal Ekran</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Ekranı Genişlet</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Flexible Multi-Layout Floor Manager Selection */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-black text-slate-700">Aktif Yerleşim Katı / Binası:</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-1.5">
                {activeScenario?.layouts.map(ly => (
                  <button
                    key={ly.id}
                    onClick={() => {
                      const updated = scenarios.map(sc => {
                        if (sc.id === activeScenario.id) {
                          return { ...sc, activeLayoutId: ly.id };
                        }
                        return sc;
                      });
                      updateScenarios(updated);
                      setSelectedNodeId(null);
                      setSelectedFlowId(null);
                      addLog("Kat Değiştirildi", `"${ly.name}" yerleşim alanına geçiş yapıldı.`);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      activeLayout?.id === ly.id ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {ly.name}
                  </button>
                ))}
                
                <button
                  onClick={() => setShowAddLayoutModal(true)}
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                  title="Yeni kat veya bina yerleşimi ekle"
                >
                  <PlusCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawing Canvas Box */}
            <div className={isFullscreen 
              ? "fixed inset-0 z-50 bg-slate-950 p-6 flex flex-col items-center justify-center overflow-hidden animate-fade-in" 
              : "bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-inner min-h-[460px]"
            }>
              
              {/* Fullscreen Mode Top Controller Bar */}
              {isFullscreen && (
                <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-850 p-3 rounded-2xl mb-4 shrink-0 shadow-lg relative z-20">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/15 text-indigo-400 rounded-xl">
                      <Activity className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">
                        Geniş Ekran Lojistik Akış Modelleme Çizim Alanı
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Aktif yerleşim üzerinde rahatça çizim yapın, yakınlaştırıp uzaklaştırın.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Active Color Dot */}
                    <div 
                      className="w-3.5 h-3.5 rounded-full border border-slate-750 shadow-3xs shrink-0"
                      style={{ backgroundColor: flowTypesConfig[selectedFlowType].color }}
                    />
                    
                    {/* Fullscreen Dropdown Selector */}
                    <select
                      value={selectedFlowType}
                      onChange={(e) => {
                        setSelectedFlowType(e.target.value as any);
                        setDrawingMode("draw");
                        setSelectedFlowId(null);
                        addLog("Akış Tipi Değiştirildi", `Yeni çizim akış tipi: ${flowTypesConfig[e.target.value as keyof typeof FLOW_TYPES_CONFIG].name}`);
                      }}
                      className="bg-slate-950 border border-slate-800 text-xs font-black text-white rounded-xl py-2 px-3 focus:outline-none cursor-pointer"
                    >
                      {Object.entries(flowTypesConfig).map(([key, config]) => (
                        <option key={key} value={key} className="bg-slate-950 text-white">
                          {(config as any).name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        setIsFullscreen(false);
                        addLog("Normal Ekran", "Normal ekran görünümüne dönüldü.");
                      }}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Minimize2 className="w-4 h-4" />
                      Küçült / Normal Ekran
                    </button>
                  </div>
                </div>
              )}

              {/* Drawing mode status indicator floating overlay */}
              {drawingMode === "draw" && (
                <div className={`absolute ${isFullscreen ? "top-24" : "top-4"} left-4 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur-xs px-3 py-2 rounded-xl border border-slate-800 shadow-lg`}>
                  <span 
                    className="w-2.5 h-2.5 rounded-full inline-block animate-pulse shrink-0" 
                    style={{ backgroundColor: flowTypesConfig[selectedFlowType].color }} 
                  />
                  <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider flex items-center gap-1">
                    Aktif Çizim: <strong style={{ color: flowTypesConfig[selectedFlowType].color }}>{flowTypesConfig[selectedFlowType].name}</strong>
                  </span>
                </div>
              )}

              {/* Zoom controls floating bar */}
              <div className={`absolute ${isFullscreen ? "top-24" : "top-4"} right-4 z-10 flex flex-col gap-1 bg-slate-950/80 backdrop-blur-xs p-1 rounded-xl border border-slate-800 shadow-lg`}>
                <button 
                  onClick={() => setZoomScale(prev => Math.min(prev + 0.2, 2.5))}
                  className="p-1.5 text-white hover:bg-slate-800 rounded transition-all cursor-pointer"
                  title="Yakınlaştır (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setZoomScale(prev => Math.max(prev - 0.2, 0.5))}
                  className="p-1.5 text-white hover:bg-slate-800 rounded transition-all cursor-pointer"
                  title="Uzaklaştır (-)"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => { setZoomScale(1.0); setPanOffset({ x: 0, y: 0 }); }}
                  className="p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white rounded transition-all text-[10px] font-bold text-center cursor-pointer"
                  title="Sıfırla"
                >
                  Reset
                </button>
              </div>

              {/* Confirmation and upload modals */}
              {showClearConfirm && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-25 animate-fade-in">
                  <div className="p-4 bg-rose-500/10 text-rose-500 rounded-full mb-3 shadow-xs">
                    <Trash2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-black text-white">Senaryoyu Temizlemek İstediğinize Emin misiniz?</h4>
                  <p className="text-xs text-slate-300 max-w-sm mt-1">
                    Bu işlem aktif kat planındaki tüm istasyonları ve çizilen akış çizgilerini kalıcı olarak silecektir.
                  </p>
                  <div className="mt-4 flex gap-2 items-center">
                    <button 
                      onClick={executeClearActiveScenario}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      Evet, Hepsini Temizle
                    </button>
                    <button 
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-700"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}

              {showAddLayoutModal && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-25 animate-fade-in">
                  <div className="bg-slate-950 border border-slate-850 p-6 rounded-2xl max-w-sm w-full text-left space-y-4 shadow-xl">
                    <h4 className="text-sm font-black text-white">Yeni Yerleşim Alanı Ekle</h4>
                    <p className="text-xs text-slate-400">Yeni bir fabrika holü, depo, ikinci kat veya dış saha yerleşimi tanımlayabilirsiniz.</p>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block">Yerleşim İsmi</label>
                      <input
                        type="text"
                        className="w-full bg-slate-850 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                        placeholder="Örn: 2. Kat (Sevkiyat Alanı)"
                        value={newLayoutName}
                        onChange={(e) => setNewLayoutName(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <button 
                        onClick={() => setShowAddLayoutModal(false)}
                        className="px-3 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                      >
                        Vazgeç
                      </button>
                      <button 
                        onClick={() => {
                          if (newLayoutName) {
                            handleAddNewLayout(newLayoutName);
                            setNewLayoutName("");
                            setShowAddLayoutModal(false);
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl"
                      >
                        Kat Oluştur
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Layout hint overlays */}
              {!activeLayout?.backgroundUrl && (
                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center z-10 transition-all">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-3 shadow-xs">
                    <Layers className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Fabrika Kat Layout Görseli Yükleyin</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Yerleşim planı görselinizi (PNG, JPG) yükleyin. Sistem, girdiğiniz fiziksel boyutlara göre otomatik ölçeklendirme yapacaktır.
                  </p>
                  <div className="mt-4 flex gap-2 items-center">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      🖼️ Şimdi Görsel Yükle
                    </button>
                  </div>
                </div>
              )}

              {/* Main Canvas Node */}
              <canvas
                ref={canvasRef}
                width={isFullscreen ? 1150 : 760}
                height={isFullscreen ? 600 : 420}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="cursor-crosshair block rounded-lg max-w-full"
              />
            </div>

            {/* Canvas status footer */}
            <div className="w-full flex justify-between items-center text-[10px] text-slate-400 font-mono px-1">
              <div>
                <span>Mod: <strong className="text-slate-200">{drawingMode.toUpperCase()}</strong></span>
                <span className="mx-2">|</span>
                <span>Ölçek: 1 piksel = <strong>{activeLayout?.scaleFactor}m</strong> (Y: {activeLayout?.lengthMeters}m x G: {activeLayout?.widthMeters}m)</span>
              </div>
              <div>
                <span className="text-indigo-400">• İstasyonları sürükleyip taşıyabilir, yeni yollar ekleyebilirsiniz.</span>
              </div>
            </div>

            {/* Live KPI metrics list under canvas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-3xs text-center">
                <span className="text-[11px] text-slate-400 font-extrabold uppercase block">Lojistik Akış Mesafesi</span>
                <span className="text-base font-black text-slate-900 mt-1 block">{activeMetrics.totalDistance} Metre</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-3xs text-center">
                <span className="text-[11px] text-slate-400 font-extrabold uppercase block">Simüle Taşıma Maliyeti</span>
                <span className="text-base font-black text-indigo-700 mt-1 block">₺{activeMetrics.materialHandlingCost.toLocaleString()}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-3xs text-center">
                <span className="text-[11px] text-slate-400 font-extrabold uppercase block">İSG Kritik Kesişmeler</span>
                <span className="text-base font-black text-rose-600 mt-1 block">{activeMetrics.crossingCount} Kesişme</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-3xs text-center">
                <span className="text-[11px] text-slate-400 font-extrabold uppercase block">Operatör Taşıma Zamanı</span>
                <span className="text-base font-black text-indigo-900 mt-1 block">{activeMetrics.walkingTime} Saat / Yıl</span>
              </div>
            </div>

          </div>

          {/* Right Parameters Column (Col-Span-4) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Tabbed Side Controller Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
              
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-900 uppercase">1. Ölçeklendirme ve Katmanlar</h3>
              </div>

              {/* Dynamic scale inputs */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Fiziksel Alan Ölçüleri (Metre)</span>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold">Genişlik (X)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold focus:outline-none"
                      value={activeLayout?.widthMeters || 100}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 10;
                        const scale = val / (activeLayout?.imageWidthPx || 800);
                        const updatedLayouts = activeScenario.layouts.map(ly => {
                          if (ly.id === activeLayout.id) {
                            return { ...ly, widthMeters: val, scaleFactor: parseFloat(scale.toFixed(5)) };
                          }
                          return ly;
                        });
                        updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc));
                        addLog("Genişlik Değişti", `Fiziksel genişlik ${val}m olarak güncellendi.`);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold">Uzunluk (Y)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold focus:outline-none"
                      value={activeLayout?.lengthMeters || 50}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 10;
                        const updatedLayouts = activeScenario.layouts.map(ly => {
                          if (ly.id === activeLayout.id) {
                            return { ...ly, lengthMeters: val };
                          }
                          return ly;
                        });
                        updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc));
                      }}
                    />
                  </div>
                </div>

                {/* Derived Area statistics */}
                <div className="p-3 bg-indigo-50/50 rounded-xl space-y-1 text-[11px] text-indigo-950 font-mono">
                  <div className="flex justify-between">
                    <span>Toplam Kat Alanı:</span>
                    <strong className="font-bold">{((activeLayout?.widthMeters || 0) * (activeLayout?.lengthMeters || 0))} m²</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Resim Çözünürlüğü:</span>
                    <span>{activeLayout?.imageWidthPx || 760} x {activeLayout?.imageHeightPx || 420} px</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Otomatik Ölçek Katsayısı:</span>
                    <strong className="font-bold text-indigo-600">1 px = {activeLayout?.scaleFactor.toFixed(4)} m</strong>
                  </div>
                </div>
              </div>

              {/* Snapping controls */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Çizim Yapışma Modları</span>
                <div className="flex gap-4 text-xs font-bold text-slate-600">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Grid Kilidi (15px)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={snapToObjects}
                      onChange={(e) => setSnapToObjects(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>İstasyon Kilidi (25px)</span>
                  </label>
                </div>
              </div>

              {/* Visibility and Layer Managers */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Görünürlük ve Filtreler</span>
                
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button
                    onClick={() => setShowLayers(prev => ({ ...prev, backdrop: !prev.backdrop }))}
                    className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                      showLayers.backdrop ? "bg-indigo-50/50 border-indigo-200 text-indigo-950" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <span>Arka Plan Planı</span>
                    {showLayers.backdrop ? <Eye className="w-4 h-4 text-indigo-600" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                  </button>

                  <button
                    onClick={() => setShowLayers(prev => ({ ...prev, stations: !prev.stations }))}
                    className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                      showLayers.stations ? "bg-indigo-50/50 border-indigo-200 text-indigo-950" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <span>Makine / İstasyonlar</span>
                    {showLayers.stations ? <Eye className="w-4 h-4 text-indigo-600" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                  </button>

                  <button
                    onClick={() => setShowLayers(prev => ({ ...prev, materialFlow: !prev.materialFlow }))}
                    className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                      showLayers.materialFlow ? "bg-indigo-50/50 border-indigo-200 text-indigo-950" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <span>Malzeme Akışları</span>
                    {showLayers.materialFlow ? <Eye className="w-4 h-4 text-indigo-600" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                  </button>

                  <button
                    onClick={() => setShowLayers(prev => ({ ...prev, operatorFlow: !prev.operatorFlow }))}
                    className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                      showLayers.operatorFlow ? "bg-indigo-50/50 border-indigo-200 text-indigo-950" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <span>Yürüyüş Akışları</span>
                    {showLayers.operatorFlow ? <Eye className="w-4 h-4 text-indigo-600" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                  </button>

                  <button
                    onClick={() => setShowLayers(prev => ({ ...prev, vehicleFlow: !prev.vehicleFlow }))}
                    className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                      showLayers.vehicleFlow ? "bg-indigo-50/50 border-indigo-200 text-indigo-950" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <span>Forklift &amp; AGV</span>
                    {showLayers.vehicleFlow ? <Eye className="w-4 h-4 text-indigo-600" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                  </button>

                  <button
                    onClick={() => setShowLayers(prev => ({ ...prev, heatmap: !prev.heatmap }))}
                    className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                      showLayers.heatmap ? "bg-orange-50 border-orange-200 text-orange-950" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <span>🔥 Isı Yoğunluğu</span>
                    {showLayers.heatmap ? <Eye className="w-4 h-4 text-orange-600" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                  </button>
                </div>
              </div>

            </div>

            {/* Element Detail custom form editor */}
            {selectedNodeId && (
              <div className="bg-white border-2 border-indigo-600 rounded-2xl p-4 shadow-md space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-indigo-600 animate-bounce" /> İstasyon Detay Kartı
                  </h4>
                  <button 
                    onClick={() => {
                      const updatedLayouts = activeScenario.layouts.map(ly => {
                        if (ly.id === activeLayout.id) {
                          return { ...ly, nodes: ly.nodes.filter(n => n.id !== selectedNodeId) };
                        }
                        return ly;
                      });
                      updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc));
                      setSelectedNodeId(null);
                    }}
                    className="text-xs text-rose-600 hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <Trash className="w-3.5 h-3.5" /> İstasyonu Sil
                  </button>
                </div>
                
                {(() => {
                  const node = activeLayout?.nodes?.find(n => n.id === selectedNodeId);
                  if (!node) return null;
                  return (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-slate-400 font-bold">İstasyon İsmi</label>
                          <input
                            type="text"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold"
                            value={node.name}
                            onChange={(e) => {
                              const updatedLayouts = activeScenario.layouts.map(ly => {
                                if (ly.id === activeLayout.id) {
                                  return { ...ly, nodes: ly.nodes.map(n => n.id === node.id ? { ...n, name: e.target.value } : n) };
                                }
                                return ly;
                              });
                              updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc), true);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-400 font-bold">İkon / Türü</label>
                          <select
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold"
                            value={node.icon}
                            onChange={(e) => {
                              const updatedLayouts = activeScenario.layouts.map(ly => {
                                if (ly.id === activeLayout.id) {
                                  return { ...ly, nodes: ly.nodes.map(n => n.id === node.id ? { ...n, icon: e.target.value } : n) };
                                }
                                return ly;
                              });
                              updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc), true);
                            }}
                          >
                            {Object.keys(STATION_ICONS).map(k => (
                              <option key={k} value={k}>
                                {STATION_ICONS[k as keyof typeof STATION_ICONS].icon} {STATION_ICONS[k as keyof typeof STATION_ICONS].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-slate-400 font-bold">Op. Sayısı</label>
                          <input
                            type="number"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-xs"
                            value={node.operatorCount}
                            onChange={(e) => {
                              const updatedLayouts = activeScenario.layouts.map(ly => {
                                if (ly.id === activeLayout.id) {
                                  return { ...ly, nodes: ly.nodes.map(n => n.id === node.id ? { ...n, operatorCount: parseInt(e.target.value) || 1 } : n) };
                                }
                                return ly;
                              });
                              updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc), true);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-400 font-bold">Süre (sn)</label>
                          <input
                            type="number"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-xs"
                            value={node.cycleTime}
                            onChange={(e) => {
                              const updatedLayouts = activeScenario.layouts.map(ly => {
                                if (ly.id === activeLayout.id) {
                                  return { ...ly, nodes: ly.nodes.map(n => n.id === node.id ? { ...n, cycleTime: parseInt(e.target.value) || 1 } : n) };
                                }
                                return ly;
                              });
                              updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc), true);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-400 font-bold">Alan (m²)</label>
                          <input
                            type="number"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-xs"
                            value={node.area || 0}
                            onChange={(e) => {
                              const updatedLayouts = activeScenario.layouts.map(ly => {
                                if (ly.id === activeLayout.id) {
                                  return { ...ly, nodes: ly.nodes.map(n => n.id === node.id ? { ...n, area: parseInt(e.target.value) || 0 } : n) };
                                }
                                return ly;
                              });
                              updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc), true);
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold">Kritik Notlar &amp; Darboğazlar</label>
                        <textarea
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 h-16 font-medium focus:outline-none"
                          value={node.remarks}
                          onChange={(e) => {
                            const updatedLayouts = activeScenario.layouts.map(ly => {
                              if (ly.id === activeLayout.id) {
                                  return { ...ly, nodes: ly.nodes.map(n => n.id === node.id ? { ...n, remarks: e.target.value } : n) };
                              }
                              return ly;
                            });
                            updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc), true);
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {selectedFlowId && (
              <div className="bg-white border-2 border-indigo-600 rounded-2xl p-4 shadow-md space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1">
                    <Sliders className="w-4 h-4 text-indigo-600" /> Akış Özellik Editörü
                  </h4>
                  <button 
                    onClick={() => {
                      const updatedLayouts = activeScenario.layouts.map(ly => {
                        if (ly.id === activeLayout.id) {
                          return { ...ly, flows: ly.flows.filter(f => f.id !== selectedFlowId) };
                        }
                        return ly;
                      });
                      updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc));
                      setSelectedFlowId(null);
                    }}
                    className="text-xs text-rose-600 hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <Trash className="w-3.5 h-3.5" /> Akışı Sil
                  </button>
                </div>
                
                {(() => {
                  const flow = activeLayout?.flows?.find(f => f.id === selectedFlowId);
                  if (!flow) return null;
                  
                  // Calculate dynamic flow segment distance
                  let flowDist = 0;
                  for (let i = 0; i < flow.waypoints.length - 1; i++) {
                    const from = flow.waypoints[i];
                    const to = flow.waypoints[i+1];
                    flowDist += Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)) * (activeLayout?.scaleFactor || 0.15);
                  }

                  const config = flowTypesConfig[flow.flowType];
                  const annualCost = flow.frequency * flowDist * config.costCoeff * simWorkingDays;
                  const travelTimeSec = flowDist / config.speed;

                  return (
                    <div className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold">Akış Tanımı</label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold"
                          value={flow.name}
                          onChange={(e) => {
                            const updatedLayouts = activeScenario.layouts.map(ly => {
                              if (ly.id === activeLayout.id) {
                                return { ...ly, flows: ly.flows.map(f => f.id === flow.id ? { ...f, name: e.target.value } : f) };
                              }
                              return ly;
                            });
                            updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc), true);
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-slate-400 font-bold">Günlük Frekans (Tur)</label>
                          <input
                            type="number"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold"
                            value={flow.frequency}
                            onChange={(e) => {
                              const updatedLayouts = activeScenario.layouts.map(ly => {
                                if (ly.id === activeLayout.id) {
                                  return { ...ly, flows: ly.flows.map(f => f.id === flow.id ? { ...f, frequency: parseInt(e.target.value) || 1 } : f) };
                                }
                                return ly;
                              });
                              updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc), true);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-400 font-bold">Akış Tipi</label>
                          <select
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold"
                            value={flow.flowType}
                            onChange={(e) => {
                              const updatedLayouts = activeScenario.layouts.map(ly => {
                                if (ly.id === activeLayout.id) {
                                  return { ...ly, flows: ly.flows.map(f => f.id === flow.id ? { ...f, flowType: e.target.value as any } : f) };
                                }
                                return ly;
                              });
                              updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc));
                            }}
                          >
                            {Object.keys(flowTypesConfig).map(k => (
                              <option key={k} value={k}>
                                {flowTypesConfig[k as keyof typeof FLOW_TYPES_CONFIG].name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Real engineering calculations panel */}
                      <div className="p-3 bg-indigo-50 rounded-xl space-y-1.5 font-mono text-[11px] text-indigo-950">
                        <div className="flex justify-between">
                          <span>Hat Uzunluğu:</span>
                          <strong className="font-bold text-slate-800">{flowDist.toFixed(1)} Metre</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Yıllık Toplam Mesafe:</span>
                          <span>{(flowDist * flow.frequency * simWorkingDays).toLocaleString()} m</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Yıllık Maliyet Katkısı:</span>
                          <strong className="font-bold text-indigo-700">₺{annualCost.toFixed(0)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Seyahat Süresi (Tek Sefer):</span>
                          <span>{travelTimeSec < 1 ? "Anlık" : `${travelTimeSec.toFixed(1)} sn`}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const updatedLayouts = activeScenario.layouts.map(ly => {
                            if (ly.id === activeLayout.id) {
                              return {
                                ...ly,
                                flows: ly.flows.map(f => {
                                  if (f.id === flow.id) {
                                    return {
                                      ...f,
                                      waypoints: f.waypoints.slice(0, f.waypoints.length - 1)
                                    };
                                  }
                                  return f;
                                })
                              };
                            }
                            return ly;
                          });
                          updateScenarios(scenarios.map(sc => sc.id === activeScenario.id ? { ...sc, layouts: updatedLayouts } : sc));
                        }}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl font-bold transition-all text-center"
                        disabled={flow.waypoints.length <= 1}
                      >
                        Son Çizim Adımını (Waypoint) Sil
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Vertical layouts transfer logistics management list */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-900 uppercase">2. Katlar Arası Dikey Transferler</h3>
              </div>

              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {activeScenario?.verticalTransfers?.map(vt => (
                  <div key={vt.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl text-xs">
                    <div>
                      <span className="font-extrabold text-slate-700 block">{vt.name} ({vt.type === "elevator" ? "Asansör" : vt.type === "conveyor" ? "Konveyör" : "Yürüyüş"})</span>
                      <span className="text-[10px] text-slate-400">Yükseklik: {vt.distanceMeters}m | Frekans: {vt.frequency} tur/gün</span>
                    </div>
                    <button
                      onClick={() => {
                        const updated = scenarios.map(sc => {
                          if (sc.id === activeScenario.id) {
                            return { ...sc, verticalTransfers: sc.verticalTransfers.filter(v => v.id !== vt.id) };
                          }
                          return sc;
                        });
                        updateScenarios(updated);
                        addLog("Dikey Taşıma Silindi", `"${vt.name}" listeden kaldırıldı.`);
                      }}
                      className="text-rose-600 p-1 hover:bg-rose-50 rounded"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {(!activeScenario?.verticalTransfers || activeScenario.verticalTransfers.length === 0) && (
                  <div className="text-[11px] text-slate-400 italic text-center py-2">Dikey transfer tanımlanmamış.</div>
                )}
              </div>

              {/* Form to add custom vertical transfers */}
              {activeScenario?.layouts.length > 1 ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      className="bg-white border border-slate-200 rounded-lg p-1.5 font-bold"
                      placeholder="Transfer Tanımı"
                      value={newVtName}
                      onChange={(e) => setNewVtName(e.target.value)}
                    />
                    <select
                      className="bg-white border border-slate-200 rounded-lg p-1.5 font-bold"
                      value={newVtType}
                      onChange={(e) => setNewVtType(e.target.value as any)}
                    >
                      <option value="elevator">Asansör</option>
                      <option value="conveyor">Konveyör</option>
                      <option value="stairs">Merdiven</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400">Günlük Sefer</span>
                      <input
                        type="number"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1"
                        value={newVtFreq}
                        onChange={(e) => setNewVtFreq(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400">Yükseklik (m)</span>
                      <input
                        type="number"
                        step="0.5"
                        className="w-full bg-white border border-slate-200 rounded-lg p-1"
                        value={newVtDist}
                        onChange={(e) => setNewVtDist(parseFloat(e.target.value) || 1)}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (newVtName && newVtFrom && newVtTo) {
                        handleAddVerticalTransfer({
                          name: newVtName,
                          type: newVtType,
                          fromLayoutId: newVtFrom,
                          toLayoutId: newVtTo,
                          frequency: newVtFreq,
                          distanceMeters: newVtDist
                        });
                      }
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-lg font-black text-center"
                  >
                    Dikey Lojistik Hattı Ekle
                  </button>
                </div>
              ) : (
                <div className="text-[10px] text-indigo-600 bg-indigo-50 p-2.5 rounded-xl font-bold">
                  * Katlar arası dikey transfer lojistiğini hesaplamak için en az iki kat/bina yerleşimi tanımlamalısınız.
                </div>
              )}
            </div>

            {/* Audit Logs Trail module */}
            <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
              <div className="flex items-center space-x-1.5 border-b border-slate-800 pb-2">
                <History className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black uppercase text-white tracking-tight">Yerleşim Tarihçe Değişiklik Günlüğü</h3>
              </div>
              <div className="space-y-1.5 text-[10px] max-h-32 overflow-y-auto pr-1 font-mono">
                {auditLogs.map(log => (
                  <div key={log.id} className="flex items-start space-x-1.5 text-slate-300">
                    <span className="text-slate-500">[{log.timestamp}]</span>
                    <strong>{log.action}:</strong>
                    <span className="text-slate-400">{log.details}</span>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <div className="text-slate-500 italic text-center py-2">Henüz işlem yapılmadı.</div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Hidden PDF/Print Layout Container and Print Media Query Styles */}
      <style>{`
        @media print {
          /* Hide everything on screen except our print area */
          body > :not(#spaghetti-print-area), 
          #root > :not(#spaghetti-print-area), 
          main > :not(#spaghetti-print-area) {
            display: none !important;
          }
          
          /* Force display of the print area */
          #spaghetti-print-area {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          
          /* Prevent page breaks inside key tables/sections */
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div id="spaghetti-print-area" className="hidden print:block bg-white p-8 text-slate-900 font-sans">
        <div className="border-b-2 border-indigo-600 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-extrabold text-indigo-950 uppercase tracking-tight">GEMBA OPEX PLATFORM</h1>
            <h2 className="text-base font-bold text-slate-700 uppercase">Lojistik Akış ve Spagetti Analiz Raporu</h2>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            <div><strong>Tarih:</strong> {new Date().toLocaleDateString("tr-TR")}</div>
            <div><strong>Rapor No:</strong> SPM-{Math.floor(100000 + Math.random() * 900000)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
          <div>
            <h3 className="font-extrabold text-slate-800 border-b border-slate-200 pb-1 mb-2 uppercase text-[10px] tracking-wider text-indigo-600">Müşteri ve Tesis Bilgileri</h3>
            <div className="space-y-1">
              <div><span className="text-slate-500">Müşteri Adı:</span> <strong className="text-slate-800">{selectedCustomer.companyName}</strong></div>
              <div><span className="text-slate-500">Tesis/Fabrika ID:</span> <strong className="text-slate-800 font-mono">{selectedCustomer.id}</strong></div>
              <div><span className="text-slate-500">Aktif Kat/Bina:</span> <strong className="text-slate-800">{activeLayout?.name}</strong></div>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 border-b border-slate-200 pb-1 mb-2 uppercase text-[10px] tracking-wider text-indigo-600">Simülasyon Varsayımları</h3>
            <div className="space-y-1">
              <div><span className="text-slate-500">Yıllık Çalışma Günü:</span> <strong className="text-slate-800">{simWorkingDays} Gün/Yıl</strong></div>
              <div><span className="text-slate-500">Operatör İş Gücü Maliyeti:</span> <strong className="text-slate-800">₺{simLaborCost}/Saat</strong></div>
              <div><span className="text-slate-500">Forklift Çarpanı:</span> <strong className="text-slate-800">{simFuelCostCoeff}x</strong></div>
            </div>
          </div>
        </div>

        {/* The captured Canvas Image */}
        {printCanvasUrl && (
          <div className="mb-6 border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center">
            <h3 className="text-xs font-black uppercase text-indigo-950 tracking-wider mb-2">Çizilen Akış Yerleşim Şeması</h3>
            <img 
              src={printCanvasUrl} 
              alt="Spaghetti Flow Layout Diagram" 
              className="max-h-[340px] object-contain border border-slate-200 rounded-xl bg-white shadow-xs" 
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* Comparison Metrics */}
        <div className="mb-6 print-avoid-break">
          <h3 className="text-xs font-black uppercase text-indigo-950 border-b border-slate-200 pb-1 mb-3 tracking-wider text-indigo-600">Mevcut Durum ve Gelecek Yalın Durum Karşılaştırma Analizi</h3>
          <table className="w-full text-xs text-left border-collapse border border-slate-200 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                <th className="p-2 border border-slate-200">Lojistik Performans Göstergesi (KPI)</th>
                <th className="p-2 text-right border border-slate-200">Mevcut Durum (A)</th>
                <th className="p-2 text-right border border-slate-200">Yalın Durum (B)</th>
                <th className="p-2 text-right border border-slate-200">İyileşme (%)</th>
                <th className="p-2 text-right border border-slate-200">Yıllık Kazanç (₺)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-medium border border-slate-200">Toplam Akış Mesafesi</td>
                <td className="p-2 text-right font-mono border border-slate-200">{getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).totalDistance.toLocaleString()} m</td>
                <td className="p-2 text-right font-mono border border-slate-200">{getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).totalDistance.toLocaleString()} m</td>
                <td className="p-2 text-right font-mono text-emerald-600 font-bold border border-slate-200">
                  -{(((getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).totalDistance - getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).totalDistance) / (getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).totalDistance || 1)) * 100).toFixed(1)}%
                </td>
                <td className="p-2 text-right font-mono text-slate-400 border border-slate-200">-</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-medium border border-slate-200">Yıllık Malzeme Taşıma Maliyeti</td>
                <td className="p-2 text-right font-mono border border-slate-200">₺{getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).materialHandlingCost.toLocaleString()}</td>
                <td className="p-2 text-right font-mono border border-slate-200">₺{getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).materialHandlingCost.toLocaleString()}</td>
                <td className="p-2 text-right font-mono text-emerald-600 font-bold border border-slate-200">
                  -{(((getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).materialHandlingCost - getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).materialHandlingCost) / (getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).materialHandlingCost || 1)) * 100).toFixed(1)}%
                </td>
                <td className="p-2 text-right font-mono text-emerald-600 font-bold border border-slate-200">
                  ₺{(getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).materialHandlingCost - getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).materialHandlingCost).toLocaleString()}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-medium border border-slate-200">Operatör Gereksiz Yürüyüş Süresi</td>
                <td className="p-2 text-right font-mono border border-slate-200">{getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime.toLocaleString()} Saat</td>
                <td className="p-2 text-right font-mono border border-slate-200">{getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).walkingTime.toLocaleString()} Saat</td>
                <td className="p-2 text-right font-mono text-emerald-600 font-bold border border-slate-200">
                  -{(((getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime - getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).walkingTime) / (getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime || 1)) * 100).toFixed(1)}%
                </td>
                <td className="p-2 text-right font-mono text-slate-400 border border-slate-200">-</td>
              </tr>
              <tr className="border-b border-slate-200 bg-emerald-50/10">
                <td className="p-2 font-bold border border-slate-200">Yıllık Operatör Yürüyüş İş Gücü Maliyeti</td>
                <td className="p-2 text-right font-mono border border-slate-200">₺{(getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime * simLaborCost).toLocaleString()}</td>
                <td className="p-2 text-right font-mono border border-slate-200">₺{(getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).walkingTime * simLaborCost).toLocaleString()}</td>
                <td className="p-2 text-right font-mono text-emerald-600 font-bold border border-slate-200">
                  -{((((getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime * simLaborCost) - (getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).walkingTime * simLaborCost)) / ((getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime * simLaborCost) || 1)) * 100).toFixed(1)}%
                </td>
                <td className="p-2 text-right font-mono text-emerald-600 font-extrabold border border-slate-200">
                  ₺{((getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime * simLaborCost) - (getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).walkingTime * simLaborCost)).toLocaleString()}
                </td>
              </tr>
              <tr className="bg-indigo-50 font-black text-indigo-950">
                <td className="p-2 border border-slate-200 uppercase">Toplam Simüle Edilen Lojistik Maliyeti</td>
                <td className="p-2 text-right font-mono border border-slate-200">
                  ₺{(getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).materialHandlingCost + (getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime * simLaborCost)).toLocaleString()}
                </td>
                <td className="p-2 text-right font-mono border border-slate-200">
                  ₺{(getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).materialHandlingCost + (getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).walkingTime * simLaborCost)).toLocaleString()}
                </td>
                <td className="p-2 text-right font-mono text-emerald-700 border border-slate-200">
                  -{((((getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).materialHandlingCost + (getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime * simLaborCost)) - (getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).materialHandlingCost + (getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).walkingTime * simLaborCost))) / ((getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).materialHandlingCost + (getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime * simLaborCost)) || 1)) * 100).toFixed(1)}%
                </td>
                <td className="p-2 text-right font-mono text-emerald-700 text-sm bg-emerald-500/10 border border-slate-200">
                  ₺{(
                    (getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).materialHandlingCost + (getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).walkingTime * simLaborCost)) -
                    (getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).materialHandlingCost + (getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).walkingTime * simLaborCost))
                  ).toLocaleString()}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-medium border border-slate-200">Kritik Akış Kesişme Noktaları (İSG Riski)</td>
                <td className="p-2 text-right font-mono border border-slate-200">{getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).crossingCount} Nokta</td>
                <td className="p-2 text-right font-mono border border-slate-200">{getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).crossingCount} Nokta</td>
                <td className="p-2 text-right font-mono text-rose-600 font-bold border border-slate-200">
                  {getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).crossingCount > 0 
                    ? `-${(((getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).crossingCount - getScenarioMetrics(scenarios.find(s => s.id === "sc_future") || scenarios[1] || scenarios[0]).crossingCount) / getScenarioMetrics(scenarios.find(s => s.id === "sc_current") || scenarios[0]).crossingCount) * 100).toFixed(0)}%` 
                    : "0%"}
                </td>
                <td className="p-2 text-right font-mono text-slate-400 border border-slate-200">-</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-medium border border-slate-200">Fabrika İstasyon Alanı</td>
                <td className="p-2 text-right font-mono border border-slate-200">{currentArea.toLocaleString()} m²</td>
                <td className="p-2 text-right font-mono border border-slate-200">{futureArea.toLocaleString()} m²</td>
                <td className="p-2 text-right font-mono text-emerald-600 font-bold border border-slate-200">
                  {savedAreaPercent > 0 ? `-${savedAreaPercent.toFixed(1)}%` : `${savedAreaPercent.toFixed(1)}%`}
                </td>
                <td className="p-2 text-right font-mono text-slate-400 border border-slate-200">-</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-medium border border-slate-200">Yıllık Alan Kazanım Tasarrufu</td>
                <td className="p-2 text-right font-mono border border-slate-200">₺{(currentArea * factoryAreaUnitPrice * 12).toLocaleString()}</td>
                <td className="p-2 text-right font-mono border border-slate-200">₺{(futureArea * factoryAreaUnitPrice * 12).toLocaleString()}</td>
                <td className="p-2 text-right font-mono text-emerald-600 font-bold border border-slate-200">
                  -{savedAreaPercent.toFixed(1)}%
                </td>
                <td className="p-2 text-right font-mono text-emerald-600 font-bold border border-slate-200">
                  ₺{annualAreaSavings.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Investment & ROI metrics */}
        <div className="grid grid-cols-2 gap-6 mb-6 print-avoid-break">
          <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50">
            <h4 className="text-[11px] font-black uppercase text-indigo-950 mb-2 tracking-wider">Yatırım ve Geri Ödeme (ROI) Özeti</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Öngörülen Uygulama Maliyeti:</span> <strong className="text-slate-800">₺{simImplementationCost.toLocaleString()}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Yıllık Simüle Edilen Tasarruf:</span> <strong className="text-emerald-700">₺{annualSavings.toLocaleString()}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Lojistik Yatırım ROI Değeri:</span> <strong className="text-indigo-600">%{roiPercent.toFixed(1)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Yatırım Geri Ödeme Süresi:</span> <strong className="text-indigo-600">{paybackMonths.toFixed(1)} Ay</strong></div>
            </div>
          </div>
          <div className="p-4 border border-slate-200 rounded-2xl bg-indigo-950 text-white flex flex-col justify-center">
            <div className="text-center">
              <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">Yıllık Lojistik Kazanç Hedefi</div>
              <div className="text-2xl font-black text-emerald-400">₺{annualSavings.toLocaleString()}</div>
              <div className="text-[10px] text-indigo-200 mt-1">U-Tipi hücresel yerleşim ve hat dengeleme tasarrufları dahil edilmiştir.</div>
            </div>
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="mb-6 print-avoid-break">
          <h3 className="text-xs font-black uppercase text-indigo-950 border-b border-slate-200 pb-1 mb-3 tracking-wider text-indigo-600">Mühendislik Önerileri ve Yalın Aksiyon Planı</h3>
          <div className="space-y-2 text-xs">
            {getAIRecommendations().map((rec, i) => (
              <div key={i} className="p-3 bg-slate-50 border-l-4 border-amber-500 rounded text-slate-700">
                <span className="font-bold text-slate-800 block uppercase text-[10px] mb-0.5">{rec.title}</span>
                {rec.text}
              </div>
            ))}
            {getAIRecommendations().length === 0 && (
              <div className="p-3 bg-slate-50 border-l-4 border-emerald-500 rounded text-slate-700">
                <span className="font-bold text-emerald-600 block uppercase text-[10px] mb-0.5">Süreçler Optimize Edildi</span>
                Lojistik akış kesişmesi ve dikey taşıma darboğazı tespit edilmedi. Sistem tam verimlilikle çalışmaktadır.
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[10px] text-slate-400 mt-12 border-t border-slate-100 pt-3">
          GEMBA OPEX - Dijital Dönüşüm ve Yalın Üretim Platformu • Bu doküman bilgisayar ortamında otomatik olarak üretilmiştir.
        </div>
      </div>

    </div>
  );
}
