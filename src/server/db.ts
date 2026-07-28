import fs from "fs";
import path from "path";
import crypto from "crypto";

// Schema Definitions
export interface Organization {
  id: string;
  organization_name: string;
  domain: string;
  created_at: string;
}

export interface User {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: "Admin" | "User";
  status: "Active" | "Disabled";
  last_login: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: "Admin" | "User";
  invitation_token: string;
  expires_at: string;
  accepted: boolean;
}

export interface YamazumiStudy {
  id: string;
  organization_id: string;
  customerId: string;
  customerName?: string;
  studyTitle: string;
  elements: any[];
  stats: any;
  aiReport?: string;
  taktTime: number;
  created_at: string;
  updated_at: string;
}

export interface TenantData {
  organizations: Organization[];
  users: User[];
  invitations: Invitation[];
  customers: any[];
  processes: any[];
  activities: any[];
  segments: any[];
  kaizens: any[];
  audits: any[];
  vsm_projects: any[];
  opex_assessments: any[];
  yamazumi_studies?: YamazumiStudy[];
}

const DB_FILE = path.join(process.cwd(), "database.json");

// Simple SHA-256 local hash algorithm (secure, pure JS, natively available in Node.js)
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export class GeminiDb {
  private data: TenantData;

  constructor() {
    this.data = this.loadDatabase();
  }

  private loadDatabase(): TenantData {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed.vsm_projects) {
          parsed.vsm_projects = [];
        }
        if (!parsed.opex_assessments) {
          parsed.opex_assessments = [];
        }
        return parsed;
      } catch (e) {
        console.error("Failed to parse database.json, re-initializing", e);
      }
    }

    // Default Seed Data
    const defaultData: TenantData = {
      organizations: [
        {
          id: "org_arcelik",
          organization_name: "Arçelik A.Ş. Pişirici Cihazlar",
          domain: "arcelik.com",
          created_at: new Date().toISOString()
        },
        {
          id: "org_ford",
          organization_name: "Ford Otosan A.Ş. Gölcük",
          domain: "ford.com.tr",
          created_at: new Date().toISOString()
        }
      ],
      users: [
        {
          id: "usr_arcelik_admin",
          organization_id: "org_arcelik",
          full_name: "Hakan Bulgurlu",
          email: "admin@arcelik.com",
          password_hash: hashPassword("arcelik123"),
          role: "Admin",
          status: "Active",
          last_login: null,
          created_at: new Date().toISOString()
        },
        {
          id: "usr_arcelik_standard",
          organization_id: "org_arcelik",
          full_name: "Barış Gökdemir",
          email: "baris.gokdemir@arcelik.com",
          password_hash: hashPassword("arcelik123"),
          role: "User",
          status: "Active",
          last_login: null,
          created_at: new Date().toISOString()
        },
        {
          id: "usr_ford_admin",
          organization_id: "org_ford",
          full_name: "Güven Özyurt",
          email: "admin@ford.com.tr",
          password_hash: hashPassword("ford123"),
          role: "Admin",
          status: "Active",
          last_login: null,
          created_at: new Date().toISOString()
        }
      ],
      invitations: [],
      customers: [
        {
          id: "arcelik_bolu",
          organization_id: "org_arcelik",
          companyName: "Arçelik A.Ş. Pişirici Cihazlar İşletmesi",
          address: "Bolu Fabrikası, Türkiye",
          industry: "Beyaz Eşya",
          productionType: "Hücresel Seri Montaj (Flow)",
          annualRevenue: 45000000,
          currency: "$",
          employeeCount: 840,
          mainContactPerson: "Barış Gökdemir (OpEx Lead)",
          mainContactEmail: "baris.gokdemir@arcelik.com",
          factoryManager: "Mehmet Soyer",
          factoryManagerEmail: "mehmet.soyer@arcelik.com",
          generalManager: "Hakan Bulgurlu",
          generalManagerEmail: "hakan.bulgurlu@arcelik.com",
          copexScore: 78,
          assessmentDate: "2026-05-12",
          preliminaryAssessmentReport: "Hücressel montaj hatlarında bekleme israfı yüksek, SMED hazırlık süreleri iyileştirilebilir.",
          notes: "Gemba turları sırasında pres kalıphanede yoğun düzensizlik tespit edildi.",
          created_by: "usr_arcelik_admin",
          updated_by: "usr_arcelik_admin",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          audits: [
            { id: "aud_1", name: "Bolu Pres Sahanlığı 5S Audit", date: "2026-05-10", score: 65, comments: "Standartlaştırma adımı zayıf, her yerde el aletleri var.", evidenceFiles: [] },
            { id: "aud_2", name: "Montaj Hücre Zaman Etüdü Tescili", date: "2026-05-11", score: 82, comments: "Zaman etütleri güncellendi, Takt süresine uyum oranı iyi.", evidenceFiles: [] }
          ]
        },
        {
          id: "ford_otosan",
          organization_id: "org_ford",
          companyName: "Ford Otosan A.Ş. Gölcük Fabrikası",
          address: "Kocaeli Yeniköy Fabrikası, Türkiye",
          industry: "Otomotiv",
          productionType: "Pulsing Assembly Line",
          annualRevenue: 125000000,
          currency: "€",
          employeeCount: 2450,
          mainContactPerson: "Zeynep Karahan (Sürekli İyileştirme)",
          mainContactEmail: "zkarahan@ford.com.tr",
          factoryManager: "Cem Temel",
          factoryManagerEmail: "ctemel@ford.com.tr",
          generalManager: "Güven Özyurt",
          generalManagerEmail: "gozyurt@ford.com.tr",
          copexScore: 84,
          assessmentDate: "2026-06-01",
          preliminaryAssessmentReport: "Robot hücresinde lojistik taşıma frekansı yüksek. Forklift yerine AGV dönüşümü önerilir.",
          notes: "Ford Q1 standartlarına tam uyumluluk aranmaktadır.",
          created_by: "usr_ford_admin",
          updated_by: "usr_ford_admin",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          audits: [
            { id: "aud_3", name: "Ford Q1 Yalın Olgunluk Sezon Değerlendirmesi", date: "2026-06-02", score: 88, comments: "OEE seviyeleri dünya standartlarında.", evidenceFiles: [] }
          ]
        }
      ],
      processes: [
        {
          id: "proc_1",
          organization_id: "org_arcelik",
          name: "Pres Sac Şekillendirme İstasyonu",
          operatorCount: 3,
          machineCount: 1,
          cycleTime: 48,
          shiftCount: 2,
          workingHours: 8,
          capacity: 960,
          oee: 72,
          utilizationRate: 85,
          overtimeRatio: 18,
          excessLabor: 1,
          scrapCost: 55000,
          reworkCost: 20000,
          downtimeCost: 75000,
          laborCost: 120000,
          indirectLaborCost: 40000,
          waitingLoss: 30000,
          transportationLoss: 25000,
          motionLoss: 15000,
          overproductionLoss: 20000,
          created_by: "usr_arcelik_admin",
          updated_by: "usr_arcelik_admin",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: "proc_2",
          organization_id: "org_arcelik",
          name: "Gövde Sızdırmazlık & Robot Kaynak",
          operatorCount: 2,
          machineCount: 2,
          cycleTime: 72,
          shiftCount: 3,
          workingHours: 8,
          capacity: 1100,
          oee: 84,
          utilizationRate: 90,
          overtimeRatio: 12,
          excessLabor: 0,
          scrapCost: 35000,
          reworkCost: 45000,
          downtimeCost: 120000,
          laborCost: 180000,
          indirectLaborCost: 50000,
          waitingLoss: 45000,
          transportationLoss: 15000,
          motionLoss: 10000,
          overproductionLoss: 10000,
          created_by: "usr_arcelik_admin",
          updated_by: "usr_arcelik_admin",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: "proc_3",
          organization_id: "org_arcelik",
          name: "Konveyörlü Hücre Gövde Montajı",
          operatorCount: 8,
          machineCount: 1,
          cycleTime: 60,
          shiftCount: 2,
          workingHours: 8,
          capacity: 1400,
          oee: 78,
          utilizationRate: 87,
          overtimeRatio: 25,
          excessLabor: 2,
          scrapCost: 80000,
          reworkCost: 30000,
          downtimeCost: 50000,
          laborCost: 240000,
          indirectLaborCost: 60000,
          waitingLoss: 60000,
          transportationLoss: 40000,
          motionLoss: 25000,
          overproductionLoss: 30000,
          created_by: "usr_arcelik_admin",
          updated_by: "usr_arcelik_admin",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      activities: [
        { id: "act_1", organization_id: "org_arcelik", name: "5S Pres Sahanlığı Temizlik Standartları", owner: "Bolu Yalın Ofis", startDate: "2026-06", endDate: "2026-08", progressPercent: 65, priority: "High", status: "In Progress", notes: "Red tag panoları hazırlanıyor.", created_by: "usr_arcelik_admin", updated_by: "usr_arcelik_admin", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "act_2", organization_id: "org_arcelik", name: "Montaj Hattı ECRS Zaman Etüdü Projesi", owner: "Metot Müh. Grubu", startDate: "2026-07", endDate: "2026-09", progressPercent: 10, priority: "High", status: "Planned", notes: "Stopwatch gözlemleri ve video kaydı alınacak.", created_by: "usr_arcelik_admin", updated_by: "usr_arcelik_admin", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "act_3", organization_id: "org_arcelik", name: "Pres Kalıplama Hızlı Ayar SMED Çalıştayı", owner: "SMED Uzmanı", startDate: "2026-08", endDate: "2026-10", progressPercent: 0, priority: "Medium", status: "Planned", notes: "Hedef kalıp değişim süresini 45 dakikadan 12 dakikaya düşürmek.", created_by: "usr_arcelik_admin", updated_by: "usr_arcelik_admin", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ],
      segments: [
        { id: "seg_1", organization_id: "org_arcelik", flowType: "Raw Material", fromX: 100, fromY: 100, toX: 100, toY: 260, distanceMeters: 40.5, description: "Hammadde -> Pres" },
        { id: "seg_2", organization_id: "org_arcelik", flowType: "WIP", fromX: 100, fromY: 260, toX: 380, toY: 260, distanceMeters: 70.2, description: "Pres -> Kaynak" },
        { id: "seg_3", organization_id: "org_arcelik", flowType: "Finished Goods", fromX: 380, fromY: 260, toX: 380, toY: 100, distanceMeters: 40.5, description: "Kaynak -> Çıkış Depo" }
      ],
      kaizens: [
        { id: "kai_1", organization_id: "org_arcelik", title: "Pres Atölyesi Sıkıştırma Aparatı Standardizasyonu", originator: "Mustafa Çelik (Usta)", department: "Pres Atölyesi", dateProposed: "2026-06-01", impactLevel: "High", estimatedCost: 12000, actualSavings: 48000, status: "Completed", descriptionBefore: "Meyve kasaları ile dağınık depolama.", descriptionAfter: "Saha kasetleri ve gölge panosu.", created_by: "usr_arcelik_admin", updated_by: "usr_arcelik_admin", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "kai_2", organization_id: "org_arcelik", title: "Montaj İstasyonu Ergonomik Masa & Konumlandırma", originator: "Yalın Danışman", department: "Montaj Hattı", dateProposed: "2026-06-05", impactLevel: "Medium", estimatedCost: 8000, actualSavings: 28000, status: "In Progress", descriptionBefore: "Eğilme hareketleri yüksek.", descriptionAfter: "Yüksekliği ayarlanabilir hidrolik konveyör.", created_by: "usr_arcelik_admin", updated_by: "usr_arcelik_admin", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ],
      audits: [
        { id: "fiv_1", organization_id: "org_arcelik", area: "Montaj Hattı A", date: "2026-06-01", sortScore: 4, setInOrderScore: 3, shineScore: 4, standardizeScore: 3, sustainScore: 2, overallScore: 64, notes: "Tertip mükemmel fakat standart kural eksikliği var.", created_by: "usr_arcelik_admin", updated_by: "usr_arcelik_admin", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: "fiv_2", organization_id: "org_arcelik", area: "Pres Kalıphane", date: "2026-06-10", sortScore: 2, setInOrderScore: 2, shineScore: 3, standardizeScore: 1, sustainScore: 2, overallScore: 40, notes: "Yağ sızıntısı ve düzensizlik var.", created_by: "usr_arcelik_admin", updated_by: "usr_arcelik_admin", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ],
      vsm_projects: [],
      opex_assessments: []
    };

    this.saveData(defaultData);
    return defaultData;
  }

  private saveData(newData?: TenantData): void {
    const activeData = newData || this.data;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(activeData, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write database.json", e);
    }
  }

  // --- GETTERS & MUTATORS ---
  public getOrganizations(): Organization[] {
    return this.data.organizations;
  }

  public getUsers(): User[] {
    return this.data.users;
  }

  public getInvitations(): Invitation[] {
    return this.data.invitations;
  }

  public getCustomers(orgId: string): any[] {
    return this.data.customers.filter(c => c.organization_id === orgId);
  }

  public getProcesses(orgId: string, factoryId?: string): any[] {
    return this.data.processes.filter(p => {
      if (p.organization_id !== orgId) return false;
      if (!factoryId) return true;
      const recordFactoryId = p.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  public getActivities(orgId: string, factoryId?: string): any[] {
    return this.data.activities.filter(a => {
      if (a.organization_id !== orgId) return false;
      if (!factoryId) return true;
      const recordFactoryId = a.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  public getSegments(orgId: string, factoryId?: string): any[] {
    return this.data.segments.filter(s => {
      if (s.organization_id !== orgId) return false;
      if (!factoryId) return true;
      const recordFactoryId = s.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  public getKaizens(orgId: string, factoryId?: string): any[] {
    return this.data.kaizens.filter(k => {
      if (k.organization_id !== orgId) return false;
      if (!factoryId) return true;
      const recordFactoryId = k.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  public getAudits(orgId: string, factoryId?: string): any[] {
    return this.data.audits.filter(a => {
      if (a.organization_id !== orgId) return false;
      if (!factoryId) return true;
      const recordFactoryId = a.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  // Create organization
  public createOrganization(name: string, domain: string): Organization {
    const newOrg: Organization = {
      id: `org_${Math.random().toString(36).substr(2, 9)}`,
      organization_name: name,
      domain: domain,
      created_at: new Date().toISOString()
    };
    this.data.organizations.push(newOrg);
    this.saveData();
    return newOrg;
  }

  // Find or create organization based on domain
  public getOrCreateOrgByDomain(email: string): Organization {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) {
      throw new Error("Invalid email domain");
    }

    let org = this.data.organizations.find(o => o.domain === domain);
    if (!org) {
      let prettyName = domain.split(".")[0];
      prettyName = prettyName.charAt(0).toUpperCase() + prettyName.slice(1) + " Workspace";
      org = this.createOrganization(prettyName, domain);
    }
    return org;
  }

  // Create User
  public createUser(user: Omit<User, "id" | "created_at" | "last_login">): User {
    const newUser: User = {
      ...user,
      id: `usr_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      last_login: null
    };
    this.data.users.push(newUser);
    this.saveData();
    return newUser;
  }

  // Update User Profiles
  public updateUser(userId: string, updates: Partial<Omit<User, "id" | "created_at">>): User {
    const idx = this.data.users.findIndex(u => u.id === userId);
    if (idx === -1) {
      throw new Error("User not found");
    }
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates
    };
    this.saveData();
    return this.data.users[idx];
  }

  // Delete User
  public deleteUser(userId: string): void {
    this.data.users = this.data.users.filter(u => u.id !== userId);
    this.saveData();
  }

  // Invitations
  public createInvitation(orgId: string, email: string, role: "Admin" | "User"): Invitation {
    const invitationToken = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // Expires in 48 hours

    // Deactivate previous invitations to same email
    this.data.invitations = this.data.invitations.filter(i => i.email !== email);

    const newInvite: Invitation = {
      id: `inv_${Math.random().toString(36).substr(2, 9)}`,
      organization_id: orgId,
      email: email.toLowerCase().trim(),
      role,
      invitation_token: invitationToken,
      expires_at: expiresAt.toISOString(),
      accepted: false
    };

    this.data.invitations.push(newInvite);
    this.saveData();
    return newInvite;
  }

  // Accept Invitation
  public acceptInvitation(token: string, passwordPlain: string, fullName: string): User {
    const invite = this.data.invitations.find(i => i.invitation_token === token && !i.accepted);
    if (!invite) {
      throw new Error("Invalid or already accepted invitation token.");
    }

    if (new Date() > new Date(invite.expires_at)) {
      throw new Error("Invitation token is expired.");
    }

    // Check if user already exists
    let existingUser = this.data.users.find(u => u.email === invite.email);
    if (existingUser) {
      throw new Error("User already registered with this email.");
    }

    const newUser = this.createUser({
      organization_id: invite.organization_id,
      full_name: fullName,
      email: invite.email,
      password_hash: hashPassword(passwordPlain),
      role: invite.role,
      status: "Active"
    });

    invite.accepted = true;
    this.saveData();
    return newUser;
  }

  // --- BUSINESS RECORD MUTATORS (Isolated per organization) ---

  // Customers
  public saveCustomer(orgId: string, cust: any, userId: string): any {
    if (!cust.id) {
      cust.id = `cust_${Math.random().toString(36).substr(2, 9)}`;
      cust.organization_id = orgId;
      cust.created_by = userId;
      cust.created_at = new Date().toISOString();
    }
    cust.updated_by = userId;
    cust.updated_at = new Date().toISOString();
    cust.organization_id = orgId; // force matching

    const idx = this.data.customers.findIndex(c => c.id === cust.id);
    if (idx !== -1) {
      this.data.customers[idx] = { ...this.data.customers[idx], ...cust };
    } else {
      this.data.customers.push(cust);
    }
    this.saveData();
    return cust;
  }

  public deleteCustomer(orgId: string, id: string): void {
    this.data.customers = this.data.customers.filter(c => !(c.id === id && c.organization_id === orgId));
    this.saveData();
  }

  // Processes
  public saveProcess(orgId: string, proc: any, userId: string): any {
    if (!proc.id) {
      proc.id = `proc_${Math.random().toString(36).substr(2, 9)}`;
      proc.organization_id = orgId;
      proc.created_by = userId;
      proc.created_at = new Date().toISOString();
    }
    proc.updated_by = userId;
    proc.updated_at = new Date().toISOString();
    proc.organization_id = orgId; // force matching

    const idx = this.data.processes.findIndex(p => p.id === proc.id);
    if (idx !== -1) {
      this.data.processes[idx] = { ...this.data.processes[idx], ...proc };
    } else {
      this.data.processes.push(proc);
    }
    this.saveData();
    return proc;
  }

  public deleteProcess(orgId: string, id: string): void {
    this.data.processes = this.data.processes.filter(p => !(p.id === id && p.organization_id === orgId));
    this.saveData();
  }

  // Gantt Activities
  public saveActivity(orgId: string, act: any, userId: string): any {
    if (!act.id) {
      act.id = `act_${Math.random().toString(36).substr(2, 9)}`;
      act.organization_id = orgId;
      act.created_by = userId;
      act.created_at = new Date().toISOString();
    }
    act.updated_by = userId;
    act.updated_at = new Date().toISOString();
    act.organization_id = orgId; // force matching

    const idx = this.data.activities.findIndex(a => a.id === act.id);
    if (idx !== -1) {
      this.data.activities[idx] = { ...this.data.activities[idx], ...act };
    } else {
      this.data.activities.push(act);
    }
    this.saveData();
    return act;
  }

  public deleteActivity(orgId: string, id: string): void {
    this.data.activities = this.data.activities.filter(a => !(a.id === id && a.organization_id === orgId));
    this.saveData();
  }

  // Flow Segments (Spaghetti)
  public saveSegment(orgId: string, seg: any, userId: string): any {
    if (!seg.id) {
      seg.id = `seg_${Math.random().toString(36).substr(2, 9)}`;
      seg.organization_id = orgId;
    }
    seg.organization_id = orgId;

    const idx = this.data.segments.findIndex(s => s.id === seg.id);
    if (idx !== -1) {
      this.data.segments[idx] = { ...this.data.segments[idx], ...seg };
    } else {
      this.data.segments.push(seg);
    }
    this.saveData();
    return seg;
  }

  public deleteSegment(orgId: string, id: string): void {
    this.data.segments = this.data.segments.filter(s => !(s.id === id && s.organization_id === orgId));
    this.saveData();
  }

  public clearSegments(orgId: string, factoryId?: string): void {
    this.data.segments = this.data.segments.filter(s => {
      if (s.organization_id !== orgId) return true; // keep other organizations
      if (!factoryId) return false; // delete all for this org if no factoryId
      const recordFactoryId = s.factory_id || "arcelik_bolu";
      return recordFactoryId !== factoryId; // delete if matches factoryId
    });
    this.saveData();
  }

  // Kaizens
  public saveKaizen(orgId: string, kaizen: any, userId: string): any {
    if (!kaizen.id) {
      kaizen.id = `kai_${Math.random().toString(36).substr(2, 9)}`;
      kaizen.organization_id = orgId;
      kaizen.created_by = userId;
      kaizen.created_at = new Date().toISOString();
    }
    kaizen.updated_by = userId;
    kaizen.updated_at = new Date().toISOString();
    kaizen.organization_id = orgId; // force matching

    const idx = this.data.kaizens.findIndex(k => k.id === kaizen.id);
    if (idx !== -1) {
      this.data.kaizens[idx] = { ...this.data.kaizens[idx], ...kaizen };
    } else {
      this.data.kaizens.push(kaizen);
    }
    this.saveData();
    return kaizen;
  }

  public deleteKaizen(orgId: string, id: string): void {
    this.data.kaizens = this.data.kaizens.filter(k => !(k.id === id && k.organization_id === orgId));
    this.saveData();
  }

  // Audits (5S)
  public saveAudit(orgId: string, audit: any, userId: string): any {
    if (!audit.id) {
      audit.id = `aud_${Math.random().toString(36).substr(2, 9)}`;
      audit.organization_id = orgId;
      audit.created_by = userId;
      audit.created_at = new Date().toISOString();
    }
    audit.updated_by = userId;
    audit.updated_at = new Date().toISOString();
    audit.organization_id = orgId; // force matching

    const idx = this.data.audits.findIndex(a => a.id === audit.id);
    if (idx !== -1) {
      this.data.audits[idx] = { ...this.data.audits[idx], ...audit };
    } else {
      this.data.audits.push(audit);
    }
    this.saveData();
    return audit;
  }

  public deleteAudit(orgId: string, id: string): void {
    this.data.audits = this.data.audits.filter(a => !(a.id === id && a.organization_id === orgId));
    this.saveData();
  }

  public getVsmProjects(orgId: string, factoryId?: string): any[] {
    if (!this.data.vsm_projects || this.data.vsm_projects.length === 0) {
      this.ensureSeedVsmProjects();
    }
    return this.data.vsm_projects.filter(p => {
      if (p.organization_id !== orgId) return false;
      if (!factoryId) return true;
      const recordFactoryId = p.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  private ensureSeedVsmProjects(): void {
    if (!this.data.vsm_projects || this.data.vsm_projects.length === 0) {
      this.data.vsm_projects = [
        {
          id: "vsm_proj_arcelik_completed",
          organization_id: "org_arcelik",
          factory_id: "arcelik_bolu",
          name: "Arçelik Bolu Pişirici Cihazlar VSM Hat Analizi",
          productGroup: "Pişirici Cihazlar / Fırın",
          productCode: "FRN-900-B",
          productionLine: "Pres & Montaj Ana Hattı",
          department: "OpEx & Yalın Üretim",
          leader: "Barış Gökdemir (OpEx Lead)",
          startDate: "2026-03-01",
          targetDate: "2026-05-15",
          status: "Tamamlandı",
          description: "Fırın montaj hattı değer akış haritalandırması ve darboğaz OEE kapasite analizi tescil çalışması.",
          created_by: "usr_arcelik_admin",
          created_at: "2026-03-01T09:00:00.000Z",
          updated_at: "2026-05-15T17:00:00.000Z",
          factorySetup: {
            workingDays: 5,
            shiftStructure: "2 Vardiya",
            shiftDuration: 8,
            breakTimes: 75,
            plannedMaintenance: 15,
            weeklyDemand: 3600,
            productFamily: "Pişirici Cihazlar / Fırın",
            customerName: "Arçelik A.Ş. Pişirici Cihazlar İşletmesi",
            shippingFrequency: "Günlük (Daily)"
          },
          vsmProcesses: [
            {
              id: "vsm_p1",
              name: "Pres Sac Şekillendirme",
              type: "Automatic",
              productionModel: "Batch",
              machineCount: 1,
              operatorCount: 3,
              shifts: 2,
              workingHours: 8,
              cycleTime: 45,
              oee: 75,
              availability: 85,
              performance: 90,
              quality: 98,
              capacity: 980,
              downtimeMinutes: 45,
              inventoryBefore: 1200,
              isKanbanEnabled: true,
              isSupermarket: true,
              notes: "Sac besleme hızı optimize edildi.",
              kaizenOpp: "Hızlı kalıp değişimi (SMED) çalıştayları."
            },
            {
              id: "vsm_p2",
              name: "Robotik Gövde Kaynak",
              type: "Automatic",
              productionModel: "Cell",
              machineCount: 2,
              operatorCount: 2,
              shifts: 2,
              workingHours: 8,
              cycleTime: 62,
              oee: 82,
              availability: 90,
              performance: 93,
              quality: 98,
              capacity: 720,
              downtimeMinutes: 30,
              inventoryBefore: 800,
              isKanbanEnabled: true,
              isSupermarket: false,
              notes: "Punta kaynak noktaları standardize edildi.",
              kaizenOpp: "Fikstür değişimi otomasyonu."
            },
            {
              id: "vsm_p3",
              name: "Emaye Kaplama & Fırınlama",
              type: "Semi Automatic",
              productionModel: "Assembly Line",
              machineCount: 1,
              operatorCount: 4,
              shifts: 2,
              workingHours: 8,
              cycleTime: 50,
              oee: 88,
              availability: 92,
              performance: 96,
              quality: 99,
              capacity: 900,
              downtimeMinutes: 20,
              inventoryBefore: 450,
              isKanbanEnabled: true,
              isSupermarket: true,
              notes: "Sıcaklık rejimi kilitlendi.",
              kaizenOpp: "Sıcaklık dengesi sensör takibi."
            },
            {
              id: "vsm_p4",
              name: "Son Montaj & Kalite Testi",
              type: "Manual",
              productionModel: "Cell",
              machineCount: 1,
              operatorCount: 8,
              shifts: 2,
              workingHours: 8,
              cycleTime: 58,
              oee: 80,
              availability: 88,
              performance: 92,
              quality: 98,
              capacity: 780,
              downtimeMinutes: 35,
              inventoryBefore: 300,
              isKanbanEnabled: false,
              isSupermarket: false,
              notes: "Poka-Yoke sensör tespiti aktif.",
              kaizenOpp: "Ergonomik malzeme raf düzeni."
            }
          ]
        },
        {
          id: "vsm_proj_arcelik_active",
          organization_id: "org_arcelik",
          factory_id: "arcelik_bolu",
          name: "Bolu Ankastre Ocak Değer Akış İyileştirme",
          productGroup: "Ankastre Ocak",
          productCode: "OCK-750-X",
          productionLine: "Ankastre Montaj Bandı 2",
          department: "Sürekli İyileştirme",
          leader: "Ahmet Soylu",
          startDate: "2026-06-01",
          targetDate: "2026-08-30",
          status: "Aktif",
          description: "Ankastre ocak montaj hattında bekleme israfı azaltımı ve dengelenmiş akış çalışması.",
          created_by: "usr_arcelik_admin",
          created_at: "2026-06-01T08:30:00.000Z",
          updated_at: "2026-06-15T10:00:00.000Z",
          factorySetup: {
            workingDays: 5,
            shiftStructure: "2 Vardiya",
            shiftDuration: 8,
            breakTimes: 75,
            plannedMaintenance: 15,
            weeklyDemand: 2800,
            productFamily: "Ankastre Ocak Grubu",
            customerName: "Arçelik A.Ş. Pişirici Cihazlar İşletmesi",
            shippingFrequency: "Günlük (Daily)"
          },
          vsmProcesses: [
            {
              id: "vsm_p5",
              name: "Sac Kesim & Büküm",
              type: "Automatic",
              productionModel: "Batch",
              machineCount: 2,
              operatorCount: 2,
              shifts: 2,
              workingHours: 8,
              cycleTime: 40,
              oee: 80,
              availability: 88,
              performance: 92,
              quality: 99,
              capacity: 1100,
              downtimeMinutes: 20,
              inventoryBefore: 900,
              isKanbanEnabled: true,
              isSupermarket: true,
              notes: "CNC büküm hızı artırıldı.",
              kaizenOpp: "Otomatik sac yükleme kolları."
            },
            {
              id: "vsm_p6",
              name: "Gaz & Elektrik Test İstasyonu",
              type: "Manual",
              productionModel: "Cell",
              machineCount: 1,
              operatorCount: 5,
              shifts: 2,
              workingHours: 8,
              cycleTime: 65,
              oee: 76,
              availability: 85,
              performance: 90,
              quality: 98,
              capacity: 680,
              downtimeMinutes: 40,
              inventoryBefore: 500,
              isKanbanEnabled: false,
              isSupermarket: false,
              notes: "Kaçak testi dijital manometreye bağlandı.",
              kaizenOpp: "Bölgesel kaset besleme tepsileri."
            }
          ]
        },
        {
          id: "vsm_proj_ford_completed",
          organization_id: "org_ford",
          factory_id: "ford_otosan",
          name: "Ford Otosan Şasi Hat Kapasite Analizi",
          productGroup: "Hafif Ticari Araç",
          productCode: "TRANSIT-V363",
          productionLine: "Gölcük Şasi & Gövde Hattı",
          department: "Ford Q1 Lean Team",
          leader: "Zeynep Karahan",
          startDate: "2026-02-10",
          targetDate: "2026-05-01",
          status: "Tamamlandı",
          description: "Pulsing assembly line takt süresi uyumluluğu ve robot kaynak hücresi OEE analizi.",
          created_by: "usr_ford_admin",
          created_at: "2026-02-10T09:00:00.000Z",
          updated_at: "2026-05-01T16:00:00.000Z",
          factorySetup: {
            workingDays: 5,
            shiftStructure: "3 Vardiya",
            shiftDuration: 8,
            breakTimes: 60,
            plannedMaintenance: 20,
            weeklyDemand: 5000,
            productFamily: "Transit Şasi Hattı",
            customerName: "Ford Otosan A.Ş. Gölcük Fabrikası",
            shippingFrequency: "Günde 3 Vardiya"
          },
          vsmProcesses: [
            {
              id: "vsm_p7",
              name: "Puntalama Robot Hücresi",
              type: "Automatic",
              productionModel: "Cell",
              machineCount: 4,
              operatorCount: 2,
              shifts: 3,
              workingHours: 8,
              cycleTime: 35,
              oee: 88,
              availability: 92,
              performance: 96,
              quality: 99,
              capacity: 1800,
              downtimeMinutes: 15,
              inventoryBefore: 600,
              isKanbanEnabled: true,
              isSupermarket: true,
              notes: "Kuka robot yürüyüş yolları optimize edildi.",
              kaizenOpp: "Sensörlü elektrot temizlik aparatı."
            },
            {
              id: "vsm_p8",
              name: "Karakteristik Hat Şasi Birleştirme",
              type: "Semi Automatic",
              productionModel: "Assembly Line",
              machineCount: 2,
              operatorCount: 12,
              shifts: 3,
              workingHours: 8,
              cycleTime: 48,
              oee: 84,
              availability: 90,
              performance: 94,
              quality: 98,
              capacity: 1450,
              downtimeMinutes: 25,
              inventoryBefore: 400,
              isKanbanEnabled: true,
              isSupermarket: false,
              notes: "AGV malzeme dağıtımı devreye alındı.",
              kaizenOpp: "Somun sıkma tork takibi dijitalleşmesi."
            }
          ]
        }
      ];
      this.saveData();
    }
  }

  public saveVsmProject(orgId: string, project: any, userId: string): any {
    if (!this.data.vsm_projects) {
      this.data.vsm_projects = [];
    }
    if (!project.id) {
      project.id = `vsm_proj_${Math.random().toString(36).substr(2, 9)}`;
      project.organization_id = orgId;
      project.created_by = userId;
      project.created_at = new Date().toISOString();
    }
    project.updated_by = userId;
    project.updated_at = new Date().toISOString();
    project.organization_id = orgId; // force matching

    const idx = this.data.vsm_projects.findIndex(p => p.id === project.id);
    if (idx !== -1) {
      this.data.vsm_projects[idx] = { ...this.data.vsm_projects[idx], ...project };
    } else {
      this.data.vsm_projects.push(project);
    }
    this.saveData();
    return project;
  }

  public deleteVsmProject(orgId: string, id: string): void {
    if (!this.data.vsm_projects) {
      this.data.vsm_projects = [];
    }
    this.data.vsm_projects = this.data.vsm_projects.filter(p => !(p.id === id && p.organization_id === orgId));
    this.saveData();
  }

  public getOpexAssessments(orgId: string, customerId?: string): any[] {
    if (!this.data.opex_assessments) {
      this.data.opex_assessments = [];
    }
    return this.data.opex_assessments.filter(a => {
      if (a.organization_id !== orgId) return false;
      if (customerId && a.customerId !== customerId) return false;
      return true;
    });
  }

  public saveOpexAssessment(orgId: string, assessment: any, userId: string): any {
    if (!this.data.opex_assessments) {
      this.data.opex_assessments = [];
    }
    if (!assessment.id) {
      assessment.id = `opex_ass_${Math.random().toString(36).substr(2, 9)}`;
      assessment.organization_id = orgId;
      assessment.created_by = userId;
      assessment.created_at = new Date().toISOString();
    }
    assessment.updated_at = new Date().toISOString();
    assessment.organization_id = orgId; // force matching

    const idx = this.data.opex_assessments.findIndex(a => a.id === assessment.id);
    if (idx !== -1) {
      this.data.opex_assessments[idx] = { ...this.data.opex_assessments[idx], ...assessment };
    } else {
      this.data.opex_assessments.push(assessment);
    }
    this.saveData();
    return assessment;
  }

  public deleteOpexAssessment(orgId: string, id: string): void {
    if (!this.data.opex_assessments) {
      this.data.opex_assessments = [];
    }
    this.data.opex_assessments = this.data.opex_assessments.filter(a => !(a.id === id && a.organization_id === orgId));
    this.saveData();
  }

  // Yamazumi Studies
  public getYamazumiStudies(orgId: string, customerId?: string): YamazumiStudy[] {
    if (!this.data.yamazumi_studies) {
      this.data.yamazumi_studies = [];
    }
    return this.data.yamazumi_studies.filter(s => {
      if (s.organization_id !== orgId) return false;
      if (customerId && s.customerId !== customerId) return false;
      return true;
    });
  }

  public saveYamazumiStudy(orgId: string, study: any, userId: string): YamazumiStudy {
    if (!this.data.yamazumi_studies) {
      this.data.yamazumi_studies = [];
    }
    if (!study.id) {
      study.id = `yam_study_${Math.random().toString(36).substr(2, 9)}`;
      study.organization_id = orgId;
      study.created_at = new Date().toISOString();
    }
    study.updated_at = new Date().toISOString();
    study.organization_id = orgId;

    const idx = this.data.yamazumi_studies.findIndex(s => s.id === study.id);
    if (idx !== -1) {
      this.data.yamazumi_studies[idx] = { ...this.data.yamazumi_studies[idx], ...study };
    } else {
      this.data.yamazumi_studies.push(study);
    }
    this.saveData();
    return study;
  }

  public deleteYamazumiStudy(orgId: string, id: string): void {
    if (!this.data.yamazumi_studies) {
      this.data.yamazumi_studies = [];
    }
    this.data.yamazumi_studies = this.data.yamazumi_studies.filter(s => !(s.id === id && s.organization_id === orgId));
    this.saveData();
  }
}

// Global database instance
export const db = new GeminiDb();
