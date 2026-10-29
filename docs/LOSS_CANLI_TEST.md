# Loss Capacity Analizi — Canlı Test Listesi

Loss Capacity Analizi ekranındaki (`src/components/LossAnalysis.tsx`) değişikliklerin canlıda
(https://gemba-tools.vercel.app) uçtan uca denenmesi için. Her satır: **ne yapılır → ne görülmeli**.

> **Önemli:** Canlı veritabanı gerçek müşterilerle ortaktır. Testi **yalnızca test müşterisinde** yapın; gerçek
> müşteride "Değişiklikleri Veritabanına Kaydet"e basmayın.

## L1 — Uydurma varsayılanların temizlenmesi

Önceden maliyet tablosu satırında veri yoksa ekran değer uyduruyordu (mola 30 dk, bakım 15 dk, planlanan adet =
kapasite × 1,1, üretilen 950, setup sıklığı 3, makine ayarı 15 dk, vardiya 2, operatör 3, C/T 35 sn, ara stok 450;
hurda/rework/arıza maliyetin 800/350/2.500'e bölünmesiyle). Artık gerçek veri yoksa alan boş kalır, hesapta 0 sayılır.

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| L1.1 | Test müşterisinde VSM projesine proses girip kaydedin (kayıt maliyet tablosunu senkronlar). Loss Capacity → **VSM Canlı Veri Düzenleyicisi**. | Tabloda 16 sütun var. VSM'den gelen Operatör, C/T, Vardiya, Saat/Vardiya, Üretilen Adet (VSM kapasitesi) ve Setup Süresi (VSM C/O) dolu. Mola, Planlı Bakım, Çalışma Günü, Planlanan Adet, Setup Sıklığı, Makine Ayarı, Arıza, Hurda, Rework, WIP **boş, "girilmedi"** yazıyor (sarı çerçeve). Başlıkta "girilmedi görünen alanlar…" uyarısı var. |
| L1.2 | VSM'de C/O girilmemiş bir prosese bakın. | Setup Süresi "girilmedi" (eskiden sıraya göre 30/60/90 dk yazıyordu). |
| L1.3 | Hiç veri girmeden Dashboard / COPQ sekmelerine bakın. | Hurda, rework, arıza, stok kayıpları 0; 950 adet / 35 sn / 450 stok gibi sayılardan türeyen tutar yok. |
| L1.4 | Bir istasyonda Hurda'ya **0** yazın. | Alan 0 gösterir (artık "girilmedi" değil), uyarı o alan için kalkar. Alanı tamamen silin → tekrar "girilmedi". |
| L1.5 | Mola, Planlı Bakım, Çalışma Günü, Hurda vb. alanları doldurup **Değişiklikleri Veritabanına Kaydet**; sayfayı yenileyin. | Girilen değerler aynen geri gelir (kayıt `lossInputs` altında tutulur); girilmeyenler yine "girilmedi". |
| L1.6 | Bir alan "girilmedi" iken kaydedin; VSM / Executive Dashboard'da aynı prosesin OEE'sine bakın. | VSM'in ölçtüğü OEE / kullanılabilirlik **ezilmez** (eksik alan varken OEE yazılmaz). Makine sayısı 1'e çekilmez. |
| L1.7 | Tüm alanları doldurup kaydedin. | Proses kaydına OEE ve kullanılabilirlik (%) yazılır; kullanılabilirlik artık 0/1 değil yüzde (ör. 87). |
| L1.8 | Gemba AI (Copilot) panelinde "gizli fabrika" ve "setup" sorun (veri girilmemiş müşteri). | 480.000 / 850.000 / 1.830.000 / 1.200.000 gibi sabit tutarlar yok; 0 görünür. Kaizen önerilerinde "Örn: Varnishing / Press Shop" yazmaz. |
| L1.9 | Ekranın hiçbir yerinde "Vernikleme / Varnishing", "Talaşlı İmalat", "Press Shop" örnek istasyonları aranır. | Görünmez (örnek preset ve 5 Neden şablonları silindi). |

## L2 — VSM → Loss veri akışı

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| L2.1 | Test müşterisinde bir VSM projesinde Kurulum'a çalışma günü 5, mola 30, haftalık talep 4000 girin; Üretim sekmesine planlanan 900, gerçekleşen 800, ideal C/T 35, model değişim 60, arıza 50 dk; Kalite sekmesine hurda 12, rework 5, ara stok 300 girin; kaydedin. | Kayıt sonrası hata yok. |
| L2.2 | Loss → VSM Canlı Veri Düzenleyicisi. | O istasyonda değerler VSM'den gelir ve altında mavi **VSM** etiketi: vardiya, saat, gün 5, mola 30, planlanan 900, üretilen 800 (kapasite değil), arıza = 50 ÷ vardiya, setup 60, setup sıklığı 5, hurda 12, rework 5, WIP 300, C/T 35. Planlı bakım "girilmedi". |
| L2.3 | Dashboard'da "Norm (Hedef) İş Gücü" kartı. | "Takt bazlı" satırında kişi sayısı çıkar (talep 4000/5 = 800/gün). Talebi silip VSM'i kaydedince "hesaplanamadı (VSM talebi girilmedi)" ve editörde talep uyarısı. |
| L2.4 | Loss editöründe hurdayı 3 yapın, kaydedin, sayfayı yenileyin. | Hurda 3, etiketi gri **Loss**. VSM'de hurdayı 20 yapıp kaydedin → Loss'ta yine 3 (Loss düzeltmesi önde). Loss'ta alanı silip kaydedin → VSM değeri (20) geri gelir. |
| L2.5 | Loss'ta VSM istasyonunda değişiklik yapıp kaydedin; VSM / Executive Dashboard'da aynı prosesin operatör, C/T, OEE değerlerine bakın. | VSM'in ölçtüğü değerler değişmez. |
| L2.6 | VSM'e bağlı olmayan (elle oluşturulmuş) bir maliyet tablosu satırı varsa tüm alanları doldurup kaydedin. | Operatör, C/T, vardiya, saat, kapasite ve OEE bu satırda ortak alanlara yazılır (L1.7 ile aynı). |
| L2.7 | Ürün grubu kapsamında bir VSM projesi seçin. | Takt/talep yalnızca o projenin talebiyle hesaplanır; fabrika kapsamında projelerin günlük talepleri toplanır. |

## Bilinen, bu adımda değiştirilmeyenler

- Kaydet, hurda/rework/arıza/bekleme maliyetini hâlâ sabit birim maliyetle yazar (adet × 800 / 350, dk × 2.500,
  WIP × 50 / 10) — yalnızca alan girilmişse. Gerçek birim maliyet girişi ayrı iş.
- Finansal modeldeki oranlar (12,5 TL/dk duruş, 15 TL/dk setup, 12 kW makine gücü, COPQ yüzdeleri) ve Copilot'un
  hazır metinlerindeki sabit iddialar (+68 adet, 12 gün geri ödeme vb.) varsayım olarak duruyor.
