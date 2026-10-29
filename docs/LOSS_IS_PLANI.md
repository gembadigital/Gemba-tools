# Loss Capacity Analizi — İş Planı (L adımları)

Amaç: VSM'den ve Gemba OpEx Suite'ten gelen üretim kayıplarını (hurda, rework, arıza, setup, küçük duruş,
hız kaybı, stok…) **izlenebilir formüllerle** paraya çevirmek. Mantık Gemba QLA ile aynı
(`github.com/gembadigital/Gemba-QLA`, motor: `src/engine/qla.ts`); Loss modülü bunu proses/istasyon
düzeyinde yapar. Canlı test listesi: [LOSS_CANLI_TEST.md](LOSS_CANLI_TEST.md).

## 0. Mevcut durum (inceleme, 2026-10-29)

### Kayıp verisi nereden geliyor?

| Kaynak | Ne taşıyor | Loss'a ulaşıyor mu? |
|---|---|---|
| VSM prosesi (`vsmTypes.ts`) | C/T, ideal C/T, OEE, kullanılabilirlik, performans, kalite (FPY), kapasite, operatör, makine, vardiya/saat, C/O, **hurda, rework, arıza dk, küçük duruş dk, bekleme dk, ilk parça onayı dk**, planlanan/gerçekleşen adet, sağlam adet, ara stok | Kısmen. Senkron (`vsmRoutes.ts` sync-cost-table) yalnızca C/T, OEE, kapasite, operatör, makine, vardiya, saat, kullanılabilirlik, C/O yazıyor. **Hurda, rework, arıza, küçük duruş, performans, kalite, adetler ve ara stok aktarılmıyor**; danışman bunları Loss editörüne yeniden girmek zorunda. |
| VSM Kurulum (`VsmFactorySetup`) | Çalışma günü, mola, planlı bakım, haftalık talep, **hurda birim maliyeti, duruş saat maliyeti, WIP yıllık taşıma maliyeti**, ürün grubu payı | Hayır. Loss bunları okumuyor; talep sabit 1.100 adet/gün. |
| OpEx Suite (`vsm/dataSources/opxSuite.ts`) | İş emri kapanışı (adet, hurda, rework), makine OEE/duruş kayıtları | Hayır. Arayüz tanımlı, bağlantı yok (VSM planı V11). |
| Şirket kartı | Müşteri: yıllık ciro, para birimi, sektör. Workspace: **yıllık üretim adedi**, ürün aileleri, mavi yaka/operatör sayısı, vardiya düzeni, OEE | Yalnızca ciro, para birimi, sektör. Üretim hacmi, kadro, vardiya kullanılmıyor. |

### Maliyetlendirme yöntemleri — devrede mi?

**Yöntem 1: danışman birim tutarları girer.** Kısmen devrede, büyük kısmı yalnızca görünüşte.
- Girilebilen değerler: saatlik işçilik (varsayılan 350), malzeme payı (0,45), enerji TL/kWh (3,5), makine
  genel gideri TL/saat (500), lojistik TL/km (25). Bunlar müşteri ayarında saklanıyor. Varsayılanlar uydurma;
  yeni müşteri bunlarla açılıyor.
- Hesaba giren: işçilik yalnızca norm fazlası kişi maliyetinde, malzeme payı hurda birim maliyeti tahmininde,
  enerji ise sabit 12 kW varsayımıyla kullanılıyor. **Makine genel gideri ve lojistik yalnızca bir tabloda
  gösteriliyor**, kayıp toplamına girmiyor.
- **Kayıp başına birim tutar girişi yok.** Hurda TL/adet, rework TL/adet, duruş TL/dk, setup TL/dk
  girilemiyor. Duruş 12,5 TL/dk, setup 15 TL/dk sabit; hurda birim maliyeti ciro ÷ (1.100 × 250) ×
  malzeme payı × 1,5'ten türetiliyor.
- "Gerçek muhasebe verisi" (`actualCostOverrides`): kategori bazında yıllık tutar girilirse tahminin yerine
  geçiyor. Çalışan tek gerçek-tutar yolu bu.

**Yöntem 2: şirket kartından türetme (QLA kurgusu).** Devrede değil.
- Ciro kart üzerinden geliyor. Maliyet yapısı yüzdeleri (malzeme %40,5, işçilik %13,5, enerji %18…) sektör
  tablosundan dolduruluyor ve yalnızca "Ürün Maliyet Modeli" ile COPQ matrisinde kullanılıyor.
- Yıllık üretim hacmi kullanılmıyor, birim maliyet hesaplanmıyor. QLA'daki zincir (değişken maliyet ÷
  hacim → birim maliyet; hurda = malzeme + %50 dönüşüm; rework = %50 dönüşüm; zaman kaybı = süre payı ×
  (enerji + bakım) + talep varsa kayıp katkı payı) burada yok.
- COPQ matrisinde veri yoksa sektör ortalamasıyla tutar üretiliyor (hurda = malzeme bütçesi × sektör hurda
  %'si, setup = ciro × %2,5, duruş = ciro × %2, stok = ciro × %1,8, sevkiyat = ciro × %1,5). Aynı türden
  uydurma; L1'de temizlenmedi.

### OEE / JIPM kayıp maliyet analizi

Yok. OEE yalnızca proses başına tek sayı olarak hesaplanıyor (K × P × Q). Kayıp ağacı, 6 büyük kayıp
ya da 16 büyük kayıp ayrımı, kayıp × maliyet unsuru matrisi yok. "OEE İyileştirmesi" satırı ciro ×
(sektör OEE − ortalama OEE) × 0,25 gibi tek bir oranla hesaplanıyor. VSM'de küçük duruş, ilk parça onayı
ve hız (ideal/gerçek C/T) verisi olduğu halde kullanılmıyor.

## L adımları

| Adım | Kapsam | Durum |
|---|---|---|
| **L1** | Uydurma varsayılanların temizlenmesi: veri eşleme, preset'ler, "Vernikleme", Copilot sabit tutarları. Eksik alan "girilmedi" olarak gösterilir. | ✅ `3285d09` |
| **L2** | **VSM → Loss veri akışı.** Senkron hurda, rework, arıza, küçük duruş, bekleme, ilk parça onayı, planlanan/gerçekleşen/sağlam adet, performans, kalite ve ara stoku da yazsın. VSM Kurulum'dan mola, planlı bakım, çalışma günü, haftalık talep ve birim maliyetler gelsin. Sabit talep 1.100 kalksın; talep yoksa takt / WIP günü "hesaplanamadı". Kaynağı her alanın yanında gösterilsin (VSM / Loss / OpEx Suite). | Sırada |
| **L3** | **Maliyet yöntemi seçimi (müşteri başına).** **A — Birim tutar:** danışman hurda TL/adet, rework TL/adet, makine saat maliyeti, işçilik TL/saat, setup TL/saat, stok taşıma %/yıl ve enerji girer. VSM'deki hurda/duruş/WIP birim maliyetleri hazır değer olarak önerilir. **B — Şirket kartından türetme (QLA):** ciro, yıllık üretim hacmi ve maliyet yapısı %'lerinden birim maliyet, katkı payı ve kayıp tutarları çıkar; formüller QLA motoruyla aynı. Her kayıp satırında formül ve kaynak (A / B / gerçek muhasebe) yazar. Girilmemiş birim tutar varsa o satır "hesaplanamadı" olur. Uydurma ayar varsayılanları (350 TL/saat, 0,45, 12 kW, 12,5 ve 15 TL/dk) ile COPQ matrisindeki sektör/ciro yedekleri kalkar. | Karar bekliyor |
| **L4** | **JIPM tipi Loss Cost Analysis (TPM).** Proses başına OEE kayıp ağacı (dk/gün): kullanılabilirlik (arıza, setup/ayar, takım değişimi, başlangıç), performans (küçük duruş/boşta, hız kaybı) ve kalite (hurda, rework, başlangıç verim kaybı). Kayıp × maliyet unsuru matrisi (işçilik, makine saati, enerji, malzeme, bakım); talep kanıtı varsa kayıp katkı payı ayrı sütunda. Pareto, kayıp başına hedef ve Kobetsu Kaizen → CI Proje'ye aktarım. 16 büyük kayıp için insan (yönetim, hareket, hat organizasyonu, lojistik, ölçme-ayar) ve kaynak (verim, enerji, kalıp/takım) kayıpları danışman girişiyle eklenir. | Karar bekliyor |
| **L5** | Kalan sabit oran/çarpanlar: COPQ dağılımları (%18 ayıklama, %22 iade, %15 garanti…), gizli fabrika %58, kayıp eşleme oranları (%75 / %25 …), taşıma × 22, lead time 4,2 gün, Copilot hazır metinleri. Her biri ya kaynağı belirtilmiş, düzenlenebilir bir varsayıma döner ya da kaldırılır. | Bekliyor |
| **L6** | OpEx Suite kaynağı: hat · ürün · tarih aralığı seçilip kayıplar iş emri ve duruş kayıtlarından okunur (VSM V11'e bağlı). | VSM V11'e bağlı |
| **L7** | PDF / Excel raporunun yeni yapıya uyarlanması ve canlı test. | Bekliyor |

## Kararı kullanıcıya ait sorular

1. **L3 varsayılan yöntem:** Yeni müşteride A mı (birim tutar), B mi (şirket kartı)? İkisi birlikte
   kullanılabilir mi (girilen birim tutar varsa onu, yoksa karttan türetileni kullan)?
2. **QLA motoru:** `qla.ts` formülleri ortak bir modüle taşınıp iki uygulamada da kullanılsın mı, yoksa
   Gemba Tools'a uyarlanmış bir kopya mı?
3. **L4 kapsamı:** Önce ekipman kayıpları (6 büyük kayıp + başlangıç + planlı duruş = JIPM'in 8 ekipman
   kaybı) mı, yoksa 16 kaybın tamamı tek seferde mi?
4. **Makine saat maliyeti:** Proses/makine başına mı girilsin, yoksa fabrika ortalaması mı yeterli?
