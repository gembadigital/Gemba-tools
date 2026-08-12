import React, { useState, useEffect } from "react";
import { User, ShieldAlert, BadgePlus, UserCheck, Trash2, Send, RotateCcw, Lock, ClipboardCheck, Clipboard, Clock } from "lucide-react";

interface AdminUsersProps {
  token: string;
  currentUser: any;
  currentOrg: any;
}

export default function AdminUsers({ token, currentUser, currentOrg }: AdminUsersProps) {
  const [users, setUsers] = useState<any[]>([]);
  // Invited consultants/guests who haven't accepted yet — they have no row in `users` until they
  // do, so without this they simply vanished from the team list with no trace of the invite.
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Consultant" | "Customer User">("Customer User");
  
  // Feedback states
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const [successUsers, setSuccessUsers] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  
  // Dialog controls
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch users from current organization
  const fetchUsers = async () => {
    try {
      const resp = await fetch("/api/admin/users", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await resp.json();
      if (data.success) {
        setUsers(data.users);
        setPendingInvitations(data.pendingInvitations || []);
      } else {
        setErrorUsers(data.error || "Kullanıcı listesi alınamadı.");
      }
    } catch {
      setErrorUsers("Bağlantı hatası oluştu.");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorUsers(null);
    setSuccessUsers(null);
    setInviteLink(null);
    setCopied(false);

    if (!inviteEmail) return;

    // Domain validation
    const adminDomain = currentUser.email.split("@")[1];
    const inviteDomain = inviteEmail.split("@")[1];
    if (adminDomain !== inviteDomain) {
      setErrorUsers(`Yalnızca '${adminDomain}' uzantılı e-posta adreslerini davet edebilirsiniz.`);
      return;
    }

    try {
      const resp = await fetch("/api/auth/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const data = await resp.json();
      if (data.success) {
        setSuccessUsers(`Davetiye başarıyla oluşturuldu! E-posta: ${inviteEmail}`);
        setInviteLink(`${window.location.origin}${data.link}`);
        setInviteEmail("");
        fetchUsers();
      } else {
        setErrorUsers(data.error || "Davetiye gönderilemedi.");
      }
    } catch {
      setErrorUsers("Ağ hatası oluştu.");
    }
  };

  const handleChangeRole = async (targetId: string, newRole: string) => {
    setErrorUsers(null);
    setSuccessUsers(null);

    try {
      const resp = await fetch(`/api/admin/users/${targetId}/role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await resp.json();
      if (data.success) {
        setSuccessUsers("Kullanıcı görev yetkilendirmesi güncellendi.");
        fetchUsers();
      } else {
        setErrorUsers(data.error || "İşlem yetersiz.");
      }
    } catch {
      setErrorUsers("Bağlantı hatası.");
    }
  };

  const handleToggleStatus = async (targetId: string, currentStatus: string) => {
    setErrorUsers(null);
    setSuccessUsers(null);
    const newStatus = currentStatus === "Active" ? "Disabled" : "Active";

    try {
      const resp = await fetch(`/api/admin/users/${targetId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await resp.json();
      if (data.success) {
        setSuccessUsers(newStatus === "Disabled" ? "Kullanıcı hesabı askıya alındı. Sisteme giremez." : "Kullanıcı aktif edildi.");
        fetchUsers();
      } else {
        setErrorUsers(data.error || "İşlem yetersiz.");
      }
    } catch {
      setErrorUsers("Bağlantı hatası.");
    }
  };

  const handleDeleteUser = async (targetId: string, name: string) => {
    if (!window.confirm(`"${name}" adlı kullanıcının ortak çalışma alanı kaydı TAMAMEN silinecektir. Emin misiniz?`)) {
      return;
    }
    setErrorUsers(null);
    setSuccessUsers(null);

    try {
      const resp = await fetch(`/api/admin/users/${targetId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await resp.json();
      if (data.success) {
        setSuccessUsers("Kullanıcı kaydı başarıyla silindi.");
        fetchUsers();
      } else {
        setErrorUsers(data.error || "Silebilmek için yetkiniz yok.");
      }
    } catch {
      setErrorUsers("Bağlantı hatası.");
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUserId || !newPassword) return;

    try {
      const resp = await fetch(`/api/admin/users/${resettingUserId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await resp.json();
      if (data.success) {
        setSuccessUsers("Kullanıcının şifresi başarıyla yenilendi.");
        setResettingUserId(null);
        setNewPassword("");
      } else {
        setErrorUsers(data.error || "Şifre değiştirilemedi.");
      }
    } catch {
      setErrorUsers("Bağlantı sorunu.");
    }
  };

  const handleResendInvite = async (targetId: string) => {
    setErrorUsers(null);
    setSuccessUsers(null);
    setInviteLink(null);

    try {
      const resp = await fetch(`/api/admin/users/${targetId}/resend-invite`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await resp.json();
      if (data.success) {
        setSuccessUsers("Yenileme davetiyesi oluşturuldu.");
        setInviteLink(`${window.location.origin}${data.link}`);
      } else {
        setErrorUsers(data.error || "Hata oluştu.");
      }
    } catch {
      setErrorUsers("Hata oluştu.");
    }
  };

  const copyToClipboard = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 text-xs max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-sans antialiased">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-slate-800" />
            <span>Kullanıcı Yönetimi (Administration)</span>
          </h2>
          <p className="text-slate-500 font-semibold mt-0.5">
            '{currentOrg?.organization_name}' bünyesinde çalışan ortak ekip arkadaşlarınızın yönetim sahası.
          </p>
        </div>
        <div className="text-[10px] font-bold bg-slate-100 border border-slate-250 text-slate-700 rounded-lg px-2.5 py-1">
          ŞİRKET DOMAINI: <span className="font-mono text-blue-900 select-all">@{currentUser.email.split("@")[1]}</span>
        </div>
      </div>

      {/* FEEDBACK SYSTEM */}
      {errorUsers && (
        <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl font-semibold leading-relaxed">
          ⚠️ {errorUsers}
        </div>
      )}

      {successUsers && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-semibold leading-relaxed">
          {successUsers}
        </div>
      )}

      {/* DYNAMIC JOIN LINK GENERATOR FOR SCREEN TESTING */}
      {inviteLink && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl space-y-2 relative overflow-hidden">
          <div className="font-extrabold text-xs uppercase tracking-wide flex items-center text-indigo-800">
            <span>ÖNİZLEME KAYIT LINKI (TEST JOIN LINK)</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            E-posta servisleri kapalı sandboxta olduğundan, oluşturduğunuz davetiyenin kayıt olma formunu aşağıdaki bağlantıyı yeni bir sekmede açarak test edebilirsiniz:
          </p>
          <div className="flex items-center space-x-2 mt-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="w-full bg-white border border-indigo-300 rounded px-3 py-2 text-[11px] font-mono select-all focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={copyToClipboard}
              className="flex items-center space-x-1 justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold px-3 py-2 text-[11px] shrink-0 transition-colors uppercase cursor-pointer"
            >
              {copied ? <ClipboardCheck className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
              <span>{copied ? "Kopyalandı!" : "Kopyala"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ADMIN PANELS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: USER LIST TABLE (Col span 2) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="font-extrabold text-gray-900 uppercase tracking-wider text-xs flex items-center space-x-1.5">
              <User className="w-4 h-4 text-slate-500" />
              <span>Ekip Üyesi Listesi ({users.length})</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-150 text-left">
              <thead className="bg-slate-50/65 text-[10px] text-slate-450 uppercase font-extrabold select-none">
                <tr>
                  <th className="px-5 py-3">Adı Soyadı</th>
                  <th className="px-5 py-3">E-Posta</th>
                  <th className="px-5 py-3 text-center">Yetki (Role)</th>
                  <th className="px-5 py-3 text-center">Durum</th>
                  <th className="px-5 py-3">Son Giriş</th>
                  <th className="px-5 py-3 text-right">Düzenle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                {users.map((u) => {
                  const isSelf = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 white-space-nowrap">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                            {u.full_name?.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-black text-gray-950 text-[11px]">
                            {u.full_name} {isSelf && <span className="text-[11px] text-indigo-600">(Siz)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[10px] text-slate-500">
                        {u.email}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <select
                          disabled={isSelf}
                          value={u.role}
                          onChange={(e) => handleChangeRole(u.id, e.target.value)}
                          className={`px-2 py-1 text-[11px] rounded font-extrabold cursor-pointer border select-none transition-colors ${
                            u.role === "Admin"
                              ? "bg-slate-900 border-slate-800 text-white"
                              : u.role === "Consultant"
                              ? "bg-indigo-50 border-indigo-200 text-indigo-800"
                              : "bg-white border-slate-200 text-slate-650"
                          }`}
                        >
                          <option value="Admin">Yönetici</option>
                          <option value="Consultant">Danışman</option>
                          <option value="Customer User">Müşteri Kullanıcısı</option>
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`px-2 py-0.5 text-[11px] rounded font-extrabold select-none border transition-colors cursor-pointer ${
                            u.status === "Active"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                              : "bg-red-50 border-red-200 text-red-800 hover:bg-red-100"
                          }`}
                        >
                          {u.status === "Active" ? "Aktif" : "Pasif"}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[10px]">
                        {u.last_login ? new Date(u.last_login).toLocaleString("tr-TR") : "Giriş Yok"}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            title="Şifreyi Değiştir"
                            onClick={() => { setResettingUserId(u.id); setErrorUsers(null); }}
                            className="p-1 text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Daveti Sıfırla ve Yenile"
                            onClick={() => handleResendInvite(u.id)}
                            className="p-1 text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={isSelf}
                            title="Üyeliği Sonlandır"
                            onClick={() => handleDeleteUser(u.id, u.full_name)}
                            className={`p-1 transition-colors ${isSelf ? "text-slate-200" : "text-slate-400 hover:text-red-600 cursor-pointer"}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* PENDING INVITATIONS (invited but not yet accepted — no `users` row exists for these) */}
        {pendingInvitations.length > 0 && (
          <div className="lg:col-span-2 bg-white border border-amber-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
              <span className="font-extrabold text-amber-900 uppercase tracking-wider text-xs flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Bekleyen Kullanıcılar ({pendingInvitations.length})</span>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-150 text-left">
                <thead className="bg-slate-50/65 text-[10px] text-slate-450 uppercase font-extrabold select-none">
                  <tr>
                    <th className="px-5 py-3">E-Posta</th>
                    <th className="px-5 py-3 text-center">Yetki (Role)</th>
                    <th className="px-5 py-3 text-center">Durum</th>
                    <th className="px-5 py-3">Son Geçerlilik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                  {pendingInvitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-[10px] text-slate-500">{inv.email}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2 py-1 text-[11px] rounded font-extrabold border bg-white border-slate-200 text-slate-650">
                          {inv.role === "Admin" ? "Yönetici" : inv.role === "Consultant" ? "Danışman" : "Müşteri Kullanıcısı"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2 py-0.5 text-[11px] rounded font-extrabold select-none border bg-amber-50 border-amber-200 text-amber-800">
                          Davet Bekleniyor
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[10px]">
                        {inv.expires_at ? new Date(inv.expires_at).toLocaleString("tr-TR") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RIGHT: INVITATION PANEL CARD (Col span 1) */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col h-fit">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <span className="font-extrabold text-gray-905 uppercase tracking-wider text-xs flex items-center space-x-1.5">
              <BadgePlus className="w-4 h-4 text-slate-500" />
              <span>Yeni Ekip Arkadaşı Daveti (Invite User)</span>
            </span>
          </div>

          <form onSubmit={handleInvite} className="p-5 space-y-4">
            <p className="text-slate-450 leading-relaxed font-semibold">
              Kendi e-posta uzantınızdaki meslektaşlarınızı sisteme davet ederek projeleri ortakça yönetin. Davet e-postası alan üyeler kendilerine ait yeni şifreler yaratırlar.
            </p>

            <div className="space-y-1">
              <label className="block text-slate-600 font-bold uppercase text-[10px]">E-POSTA UZANTISI ({currentUser.email.split("@")[1]})</label>
              <div className="flex rounded-md shadow-xs">
                <input
                  type="text"
                  required
                  placeholder="E.g. baris"
                  value={inviteEmail.split("@")[0]}
                  onChange={(e) => {
                    const localPrefix = e.target.value.toLowerCase().replace(/@.*/, "").trim();
                    const domain = currentUser.email.split("@")[1];
                    setInviteEmail(`${localPrefix}@${domain}`);
                  }}
                  className="block w-full min-w-0 flex-1 border border-slate-300 rounded-l-lg px-2.5 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <span className="inline-flex items-center px-3 rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 text-slate-500 font-mono text-[11px]">
                  @{currentUser.email.split("@")[1]}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-600 font-bold uppercase text-[10px]">YETKI SEVIYESI (Sys Role)</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-800"
              >
                <option value="Customer User">Müşteri Kullanıcısı (Standard Workspace Access)</option>
                <option value="Consultant">Danışman (Consultant)</option>
                <option value="Admin">Yönetici (Full Administrative Controls)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-black py-2.5 px-4 text-xs transition-colors cursor-pointer uppercase pt-3 pb-3 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Davet Belgesi Üret</span>
            </button>
          </form>
        </div>

      </div>

      {/* OVERLAY PASSWORD RESET DIALOG MODAL */}
      {resettingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden relative p-6 space-y-4">
            <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-widest border-b border-slate-100 pb-2">
              Yönetici Şifre Yenileme (Admin Password Override)
            </h3>
            
            <form onSubmit={handlePasswordReset} className="space-y-3">
              <div className="space-y-1">
                <span className="block text-[10px] text-slate-500 uppercase font-bold">Yeni Şifre Tanımla</span>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-800 text-xs focus:outline-none"
                  placeholder="Yeni şifreyi giriniz"
                />
              </div>

              <div className="flex items-center space-x-1.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setResettingUserId(null); setNewPassword(""); }}
                  className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold text-[11px]"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-gray-900 border border-transparent hover:bg-gray-800 text-white font-black text-[11px]"
                >
                  Şifreyi Ez ve Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
