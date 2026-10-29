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

## L3 — Maliyet yöntemi (girilen → VSM → şirket kartı)

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| L3.1 | Test müşterisinde Loss → **2. Ürün Maliyet Modeli** → "Kayıp Birim Maliyetleri". | Tüm girişler boş ("girilmedi"); eski 350 TL/saat, %45, 500 TL/saat, 25 TL/km, 3,5 TL/kWh değerleri yok. İstasyon tablosunda tutarlar "hesaplanamadı", altında hangi kayıpların toplama girmediği listeli. Dashboard'da hurda/duruş/setup kayıpları 0. |
| L3.2 | Şirket kartına yıllık ciro, Operasyon → yıllık üretim adedi, İş Gücü → mavi yaka, vardiya saati, haftalık gün girin. Loss'ta maliyet yapısını girin (veya "Sektör Ortalamasını Uygula") ve stok taşıma oranı yazın. | Sağdaki "Şirket kartı tabanı" değerleri dolar; istasyon tablosunda değerler mor **Şirket kartı** etiketiyle gelir. Hücre üzerine gelince formül görünür. Örnek: ciro 100 Mn, adet 1 Mn, malzeme %50, işçilik %15, enerji %5 → hurda 60 /adet, rework 10 /adet. |
| L3.3 | VSM Kurulum'a hurda birim maliyeti 70 ve duruş saat maliyeti 900 girip kaydedin. | O projenin istasyonlarında hurda 70 ve makine/saat 900 mavi **VSM** etiketiyle (kart değerinin önünde). |
| L3.4 | Loss'ta hurda birim maliyetine 65, o hattın makine saat maliyetine 1.200 girin. | Hurda 65 ve makine 1.200 **Girilen** etiketiyle; başka hattın istasyonları kendi değerini (VSM/kart) korur. |
| L3.5 | Sektörü değiştirin, sayfayı yenileyin. | Maliyet yapısı %'leri değişmez (yalnızca butonla uygulanır). |
| L3.6 | VSM Canlı Veri Düzenleyicisi → Değişiklikleri Veritabanına Kaydet; CI Proje → yeni proje sihirbazındaki maliyet tablosu fırsatlarına bakın. | Hurda / rework / plansız duruş fırsat tutarları Loss'taki yıllık tutarlarla aynı; birim maliyeti bulunamayan kalem yazılmaz, "Bekleme / Taşıma Kaybı" (WIP × 50 / × 10) artık yazılmaz. |
| L3.7 | Makine sayısı girilmemiş (VSM dışı) bir istasyona bakın. | İstasyon adının yanında "(makine sayısı yok → 1)". |

## L3 düzeltmesi (db7952c)

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| L3.0 | `01fa4a7` canlıdayken Loss Capacity ekranı açılmıyorsa (beyaz ekran / hata) | `db7952c` deploy olduktan sonra ekran açılır. Hata, birim maliyet bulunamayan kayıp listesinin `byStation` alanını da dolaşmasıydı. |

## L4 — TPM Kayıp Maliyeti (JIPM 16 kayıp)

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| L4.1 | L2.1'deki VSM projesine Üretim sekmesinde ilk parça onayı 20, küçük duruş 50, bekleme 30 dk girip kaydedin. Loss → **6. TPM Kayıp Maliyeti (JIPM)**. | İstasyon kartında OEE (mavi **VSM**), yükleme ve OEE kaybı dk/gün. Matriste 16 kayıp: 1 Arıza = VSM arıza dk, 2 Setup ve ayar = model değişim + ilk parça onayı, 5 Küçük duruş = 50, 6 Hız kaybı = performans kaybı − 50 (kaynak "OEE dağılımı"), 7 Hata = kalite kaybı süresi, 9 Yönetim = 30 dk × operatör. 1–7 + dağıtılamayan = yükleme × (1 − OEE). |
| L4.2 | Kayıp Birim Maliyetleri boşken sekmeye bakın. | Süreler görünür; tutarlar "hesaplanamadı" (üzerine gelince istasyon adı). Hat makine saati ve işçilik saati girildiğinde İşçilik / Makine sütunları ve Toplam dolar. |
| L4.3 | Takım değişimine, OEE'nin kullanılabilirlik kaybından büyük bir süre girin (ör. 500 dk). | Ekipman 1–4 kullanılabilirlik kaybına oranlanarak sığar; altta "aşıyor … oranlanarak sığdırıldı" uyarısı. |
| L4.4 | OEE'si olmayan (VSM dışı, eksik girdili) istasyonu filtreden seçin. | "OEE girilmedi — dağıtım yok"; yalnız ölçülen/girilen süreler, 6 Hız ve 7 Hata boş. |
| L4.5 | Gerçekleşen < planlanan olan istasyonda, şirket kartı (ciro, adet, malzeme %, enerji %) doluyken "Kayıp katkı payı" sütunu. | Ekipman kayıplarında tutar çıkar, toplam plan açığı × katkı payı × gün'ü aşmaz; "Toplam" sütununa eklenmez. |
| L4.6 | Enerji kaybı ve kalıp/takım alanlarına yıllık tutar girin; sayfayı yenileyin. | 15 / 16. satırlarda tutar (kaynak "giriş"); girişler kalıcı. |
| L4.7 | Bir kayıpta "CI'ye ata" → lider girip onaylayın. | CI Proje Yönetimi'nde "TPM n. kayıp adı İyileştirme Projesi" oluşur; butonda proje sayısı (1). Beklenen tasarruf 0 (varsayım yok). |
| L4.8 | Pareto bölümü. | Fiyatlanmış kayıplar büyükten küçüğe, kümülatif %. |

## L5 — Kalan sabit oranların temizliği

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| L5.1 | Dashboard, birim maliyetleri girilmiş bir müşteride. | Toplam kayıp = hurda + rework + duruş + setup + norm fazlası + stok. Fazla mesai, geç teslimat, enerji 0 (Gerçek Mali Veriler'de açılınca girilen tutar). "Net Kâr İyileştirme Hedefi" = Geri Kazanım Matrisi ortalama kazancı (%50 senaryosu yok). |
| L5.2 | 2. Ürün Maliyet Modeli → "Kalite Maliyetleri — Müşteri Verisi"ne garanti 100.000 girin. | COPQ toplamı tam 100.000 artar. Boşken iade, garanti, muayene vb. 0. |
| L5.3 | 3. COPQ Finansal Matrisi. | "Kaynak (aralık ±%20)" sütununda formül metni, oran girişi ve "Oranları Sıfırla" yok. Min/Max = ölçülen tutar × 0,8 / 1,2. "Fire & Malzeme" ve "Lead Time" 0 (Hurda ve WIP satırlarında). OEE İyileştirmesi = JIPM 5 + 6 + dağıtılamayan. Veri yokken satırlar 0 (ciro yüzdesi yok). |
| L5.4 | Ürün grubu kapsamı seçili iken COPQ matrisi ve Dashboard. | Hurda/setup/duruş tutarları iki ekranda aynı (önceden matris bir de ürün payıyla çarpıyordu). |
| L5.5 | Ekonomik Kayıp Ağacı (COPQ sekmesi altı). | "Malzeme Kayıpları %45" ve "Gizli Fabrika %8" satırları yok; iç hata, setup, arıza, norm fazlası, mesai, stok, COPQ toplamı. |
| L5.6 | Gemba AI'da "P&L Tablosu", "Yüksek Kazançlı Kaizen", "Setup", "OEE %5" sorularını sorun. | P&L kalemleri maliyet yapısı %'lerinden (girilmediyse 0); "Sadece 12 Gün", "45,000 TL", "+68 adet", "+18,500 adet", "%18 ila %25", "2.5 katına" yok; setup saat/adet ve OEE +5 adetleri istasyon verisinden. Öncelikler Geri Kazanım Matrisi'ndeki gerçek konulara göre adlandırılır. |
| L5.7 | VSM filtre penceresinde ürün grubu payı girilmemiş bir proje. | Model cirosu 0 (eskiden %30 varsayılırdı). |
| L5.8 | Faaliyet kârı eğrisi (Dashboard). | Aşamalar "Mevcut → + en büyük fırsat → + ilk 3 fırsat → Hedef"; 5S/SMED/TPM fazları yok. |

## Bilinen, bu adımda değiştirilmeyenler

- Geri Kazanım Matrisi iyileştirme oranları (projeksiyon varsayımı, düzenlenebilir) — QLA kalibrasyonuyla hizalama kararı bekliyor.
- OpEx Suite bağlantısı (L6) ve PDF/Excel raporunun yeni yapıya uyarlanması (L7).
