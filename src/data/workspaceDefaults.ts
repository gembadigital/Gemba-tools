import { CompanyWorkspaceExtended } from "../types/workspace";

export const getWorkspaceData = (customerId: string): CompanyWorkspaceExtended => {
  return {
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
      leanMaturity: 0,
      oee: 0,
      currentImprovementProgram: "",
      kaizenSystem: "",
      tpmLevel: "",
      fivesLevel: 0,
      visualManagement: "Medium",
      dailyManagement: "Medium",
      opexScore: 0,
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
