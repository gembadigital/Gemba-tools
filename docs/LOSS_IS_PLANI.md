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
| **L2** | **VSM → Loss veri akışı.** Senkron artık girilen günlük kayıp verisini (`vsmLoss`: planlanan/gerçekleşen/sağlam adet, hurda, rework, arıza, küçük duruş, bekleme, ilk parça onayı, ideal C/T, ara stok, performans, kalite) ve proje kurulumunu (`vsmSetup`: çalışma günü, mola, planlı bakım, haftalık talep, birim maliyetler) de yazıyor. Loss alan başına öncelik: Loss'ta düzeltilen (`lossOverrides`) → VSM ölçümü → eski Loss girişi (`lossInputs`). Kaynak editörde "VSM / Loss" olarak görünüyor. VSM'in günlük C/O, ilk parça onayı ve arıza dakikaları doğru birime çevriliyor (önceki eşleme C/O'yu "setup başına" sayıyordu). Üretilen adet artık kapasite değil, gerçekleşen adet. Sabit talep 1.100 kalktı; talep VSM'den, yoksa takt/WIP günü "hesaplanamadı". VSM satırlarında Loss kaydı VSM'in ölçtüğü ortak alanları (operatör, C/T, OEE…) artık ezmiyor. | ✅ |
| **L3** | **Maliyet yöntemi.** Yeni `src/components/loss-analysis/lossCosting.ts` (QLA motorunun Gemba Tools uyarlaması). Her istasyonda her birim maliyet sırayla: **girilen birim tutar** (hurda/adet, rework/adet, işçilik/kişi-saat, stok/adet/yıl, **hat bazında makine saat maliyeti**) → **VSM Kurulum birim maliyeti** (hurda, duruş saat, WIP taşıma) → **şirket kartından türetilen** (ciro, yıllık üretim adedi, maliyet yapısı %, mavi yaka × vardiya saati × gün; QLA formülleri). Bulunamayan tutarla fiyatlanacak kayıp toplama girmez, "hesaplanamadı" olarak listelenir. Duruş/setup saati = makine saati × makine sayısı + işçilik saati × operatör. Kaldırılanlar: 12,5 TL/dk duruş, 15 TL/dk setup, ciro ÷ (talep × 250) × 0,45 × 1,5 hurda, 350 TL/saat, %45 malzeme, 500 TL/saat makine, 25 TL/km lojistik, 3,5 TL/kWh, 12,5 × 40 bakım; maliyet yapısı %'lerinin her yüklemede sektör tablosuyla ezilmesi (artık yalnızca "Sektör Ortalamasını Uygula" ile). Kaydet, CI havuzunun okuduğu yıllık hurda/rework/duruş tutarlarını bu fiyatlarla yazar; WIP × 50 / × 10 bekleme/taşıma yazılmaz. | ✅ |
| **L4** | **JIPM tipi TPM Kayıp Maliyet Analizi** — yeni sekme "6. TPM Kayıp Maliyeti (JIPM)", motor `loss-analysis/jipmLossCost.ts`. 16 büyük kayıp: ekipman 1–8 (arıza, setup ve ayar, takım değişimi, başlangıç, küçük duruş, hız, hata/rework, planlı duruş), insan 9–13 (yönetim/bekleme, hareket, hat organizasyonu, lojistik, ölçme-ayar), kaynak 14–16 (verim/malzeme, enerji, kalıp-takım). **OEE varsa** (VSM ölçümü; yoksa girdileri tam Loss hesabı) yükleme süresi × (1 − OEE) A×P×Q ile ayrılır: kullanılabilirlik kaybı → 1–4 (ölçülen/girilen dk; aşarsa oranlanır), performans → 5 küçük duruş + kalan 6 hız, kalite → 7. Açıklanamayan kalan "Dağıtılamayan OEE kaybı" satırı olarak fiyatlanır. Yalnız toplam OEE varsa ölçülenler yerleşir, kalan dağıtılamaz. OEE yoksa yalnızca ölçülen/girilen süreler. Maliyet: ekipman süresi = makine saati × makine + işçilik × operatör; insan = işçilik saati; verim = hurda × birim malzeme (kart); enerji/kalıp girilen tutar. Plan altında üretim varsa kayıp katkı payı ayrı sütun (toplama girmez, plan açığıyla sınırlı). Kayıp × maliyet unsuru matrisi, Pareto, ölçülmeyen kayıplar için istasyon girişleri (ayarlarda saklanır), her kayıp için "CI'ye ata" (Kobetsu Kaizen). VSM senkronundan küçük duruş, bekleme ve OEE bileşenleri artık istasyona taşınıyor. | ✅ |
| **L5** | **Kalan sabit oran ve çarpanlar.** Kaldırılanlar: fazla mesai (½ işçilik günü × zorlanan istasyon), geç teslimat (ciro %0,01–0,05), enerji (12 kW × tüm çalışma), bekleme (%12), bakım (12,5 × 40). Bunlar artık yalnızca girilen gerçek tutardan geliyor. COPQ dış hata ve muayene kalemleri (ayıklama %18, iade %22, garanti %15, nakliye %8; şikâyet, muayene, kalite personeli, kayıp satış için ciro %'leri) artık "Kalite Maliyetleri — Müşteri Verisi" panelinden girilen yıllık tutar. Gizli fabrika: %58 yerine ölçülen kayıplar + muayene + ayıklama; eşdeğer operatör = tutar / (işçilik saati × yıllık saat), makine kapasitesi = OEE kayıp süresi / yükleme süresi (JIPM); ×1,5 ciro eşdeğeri kaldırıldı. COPQ matrisi: ciro/sektör yedekleri, %8 tabanlar, OEE açığı × ciro × 0,25 ve oran × 1,2–1,8 çarpanları kaldırıldı. Satırlar ölçülen/fiyatlanan kayıp (OEE = JIPM 5+6+dağıtılamayan, operatör = JIPM 9+10+12+13), aralık QLA ±%20. Çift sayılan satırlar 0: Fire → Hurda'da, Lead Time → WIP'te. Ürün grubu kapsamında kayıpların ikinci kez ciro payıyla çarpılması düzeltildi. Kayıp eşleme oranları (75/25, 50/20/30, 50/15/35, WIP × 22) yerine düz toplamlar. Lead time + 4,2 gün, darboğaz 45 sn / 1000 adet, VSM ürün payı %30 yedeği, simülasyon yedekleri (%12/20/25/2) ve SMED/OEE 40/60 bölüşümü, "%50 kayıp azaltım" kartı, faaliyet kârı eğrisindeki %20/55/85 fazları da kaldırıldı. Ekonomik kayıp ağacında malzeme %45 ve gizli fabrika %8 satırları çıktı. Copilot: P&L tablosu artık maliyet yapısı %'lerinden; proje maliyeti / geri ödeme günleri, +68 / +18.500 adet, %7,8, %18–25, 2,5 kat gibi sabit iddialar kaldırıldı ya da veriden hesaplanıyor. | ✅ |
| **L6** | OpEx Suite kaynağı: hat · ürün · tarih aralığı seçilip kayıplar iş emri ve duruş kayıtlarından okunur (VSM V11'e bağlı). | VSM V11'e bağlı |
| **L7** | PDF / Excel raporunun yeni yapıya uyarlanması ve canlı test. | Bekliyor |

## Bilinçli olarak bırakılan varsayımlar (L5 sonrası)

- **Geri Kazanım Matrisi** iyileştirme oranları (konu başına benchmark aralıkları, olgunluk/OEE ile konumlandırma, yatırım %) birer projeksiyon varsayımı. Ekranda düzenlenebilir. QLA'daki kalibrasyonla (kaybın %25–35'i, olgunluğa göre) hizalanıp hizalanmayacağı kullanıcı kararı.
- QLA formül sabitleri (hurdada %50 dönüşüm payı, rework %50, ±%20 bant) ve sektör benchmark tabloları (yalnızca düğmeyle uygulanır).
- What-if kaydırıcılarının başlangıç değerleri (senaryo girdileri).

## Kullanıcı kararları (2026-10-29)

1. **L3 yöntemi:** İkisi birlikte. Birim tutar (danışman) girildiyse o kullanılır; tablo boşsa değerler
   müşteri/şirket kartından (ciro, üretim hacmi, maliyet yapısı) türetilir.
2. **QLA motoru:** Gemba Tools'a uyarlanmış ayrı bir kopya.
3. **L4 kapsamı:** OEE verisi girildiyse OEE kaybı **16 büyük kayba** dağıtılır.
4. **Makine maliyeti:** Müşterinin belirttiği tutar, **hat bazında** (enjeksiyon hattı ile talaşlı imalat
   hattının saat maliyeti farklı). VSM projesi = hat/ürün grubu olduğundan tutar VSM projesi/hat başına tutulur.
