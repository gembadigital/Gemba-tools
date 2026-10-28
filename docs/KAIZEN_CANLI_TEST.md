# Kaizen Öneri Sistemi — Canlı Test Listesi (2026-10-28)

Faz 3–6'da yapılan her şeyin canlıda (https://gemba-tools.vercel.app) uçtan uca denenmesi için. Her satır:
**ne yapılır → ne görülmeli**. Sorun çıkan satırın numarasını, ekran görüntüsünü ve telefon/tarayıcıyı not edin.

> **Önemli:** Canlı veritabanı gerçek müşterilerle ortaktır. Testi **yalnızca test için açılmış bir müşteride**
> yapın (örn. "Test Fabrika"); gerçek müşteride öneri, personel ya da ayar değiştirmeyin.

## 0. Hazırlık

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 0.1 | Vercel → Project → Settings → Environment Variables: `CRON_SECRET` tanımlı mı bakın; yoksa uzun rastgele bir değer ekleyip yeniden deploy edin. | Değişken listede var. (Yoksa 4.x haftalık hatırlatmalar çalışmaz.) |
| 0.2 | `GEMINI_API_KEY` tanımlı mı bakın (zaten diğer modüllerde kullanılıyor). | Var. |
| 0.3 | Gemba Tools'a Admin olarak girip yeni müşteri açın: **Test Fabrika**. | Müşteri listede. |
| 0.4 | Kaizen Öneri → Kurulum → Personel'de aşağıdaki kişileri ekleyin (Otomatik sicil no kullanabilirsiniz). | 6 kişi listede, sicil no'ları dolu. |

Test kişileri (e-postası olanlara gerçek, erişebildiğiniz adresler verin; olmayanlar sicil no ile girer):

| Kişi | Rol | Amiri | E-posta |
|---|---|---|---|
| **A — Hat Yöneticisi** | Amir (kendisine bağlı B var) | — | var |
| **B — Takım Lideri** | Amir | A | var |
| **C — Operatör** | Personel | B | **yok** (sicil no ile) |
| **D — Operatör** | Personel | B | **yok** |
| **K — Kurul Üyesi** | Kurul üyesi | — | var |
| **Y — Kurul Yöneticisi** | Kurul Yöneticisi (Gemba personeli verir) | — | var |

Cihazlar: bir bilgisayar, bir telefon (iPhone ya da Android), mümkünse bir tablet (kiosk için).

## 1. Personel ve roller (Faz 3.1–3.3)

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 1.1 | B'nin amirini A yapın, sonra A'nın amirini B yapmayı deneyin. | İkincisi reddedilir (döngü uyarısı). |
| 1.2 | Aynı sicil no'yu iki kişiye vermeyi deneyin. | Kayıt reddedilir. |
| 1.3 | Personel → Excel şablonunu indirin, 2 yeni kişi + 1 hatalı satır ekleyip yükleyin (önce önizleme). | Önizlemede hatalı satır işaretli; onaylayınca 2 kişi eklenir. |
| 1.4 | Y'ye Kurul Yöneticisi yetkisini Admin hesabıyla verin. Y ile girin. | Y, Kurulum ve Ayarlar'ı görür; başka birine Kurul Yöneticisi yetkisi **veremez**. |

## 2. Giriş: QR, sicil no, PIN, kiosk (Faz 3.5–3.7)

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 2.1 | Ayarlar → "Sicil no ile giriş" → QR kodu → A4 afiş → Yazdır/PDF. | Tek sayfa afiş; QR telefonla okununca Test Fabrika giriş ekranı açılır. |
| 2.2 | Telefonda QR'ı okutun, **C'nin** sicil no'sunu girin. | PIN sorulmadan girer; yalnızca Kaizen ekranları görünür. |
| 2.3 | Telefonda B'nin sicil no'su ile girin. | PIN kurulumu ister (ilk giriş kodu Kurulum → Personel → Giriş'ten alınır); kendi PIN'ini belirler. |
| 2.4 | B ile 5 kez yanlış PIN girin. | "Çok fazla hatalı deneme" — 15 dakika kilit. |
| 2.5 | Ayarlar → Kiosk modu → bağlantıyı tablette açın; D ile girip bir öneri gönderin. | Gönderimden ~15 sn sonra oturum kendiliğinden kapanır; ekran sıradaki kişiye hazır. |
| 2.6 | Kioskta girip 2 dakika dokunmayın. | "Hâlâ orada mısınız?" uyarısı, sonra çıkış. |

## 3. Öneri verme, benzer öneri, taslak, telefon (Faz 3.4, 6.1, 6.3)

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 3.1 | C (telefon) ile öneri: "Montaj hattında vida besleme aparatı", Kazanç Süresi **Senelik**, kazanç 45.000, maliyet 5.000, fotoğrafı **Kamerayı aç** ile çekin. | Kamera doğrudan açılır; öneri gönderilir; Yeni Öneri özetinde "Geri ödeme: 1,3 ay". |
| 3.2 | D ile öneri: Kazanç Süresi **Parça Başı**, parça başı 2 TL, yıllık 10.000 adet, 3 yıl. | Yıllık 20.000, toplam 60.000 kendiliğinden hesaplanır. |
| 3.3 | C ile yeni öneriye "Vida düşmesini önleyen besleyici" yazın, 2. adımda mevcut durumu yazın. | "Benzer 1 öneri var" kutusu çıkar (3.1'deki öneri, durumu ile). |
| 3.4 | D ile 3.3'ü deneyin. | Benzer öneri görünür ama **kişi adı görünmez** (D, C'nin önerisini göremez). |
| 3.5 | Telefonda yarım bir öneri yazın, tarayıcıyı/uygulamayı kapatıp açın. | "Yarım kalan taslağınız geri yüklendi" + metin yerinde. |
| 3.6 | Telefonu uçak moduna alıp öneriyi gönderin. | Üstte "Bağlantı yok" şeridi; gönderince form kaybolmaz, uyarı çıkar. Bağlantı gelince tekrar gönderin → gider. |
| 3.7 | Telefonda Ana Sayfa'daki "Ana ekrana ekle" ipucunu izleyin (Android: düğme; iPhone: Paylaş → Ana Ekrana Ekle). Ana ekrandan açın. | Tam ekran "Kaizen" uygulaması açılır, oturum hatırlanır. Çıkış yapıp ana ekrandan açınca Test Fabrika sicil girişi gelir. |
| 3.8 | C ile Önerilerim'e bakın; D ile bakın. | Herkes yalnızca kendi önerisini görür. |
| 3.9 | B (amir) ile Önerilerim'e bakın. | C ve D'nin önerileri (ekibi) görünür; K ve Y'nin önerileri görünmez. |

## 4. Bildirim, mesaj, hatırlatma (Faz 4.2–4.4)

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 4.1 | 3.1'den sonra B'nin zil simgesine bakın. | Okunmamış bildirim; tıklayınca Değerlendirmeler açılır. B'nin e-postasına da mail gelir. |
| 4.2 | C, önerisinin altından "Durum teyidi talebi" gönderin. | B'ye bildirim; mesaj öneri altında görünür. C'nin e-postası olmadığı için cevaplar C'ye **zilden** ulaşır. |
| 4.3 | Y ile Ayarlar → Haftalık hatırlatmalar → **Önizle**. | Kimin hangi konu için hatırlatma alacağı listelenir (eşikler dolmamışsa boş olabilir). |
| 4.4 | **3. bölümden en az 2 gün sonra** (D'nin 3.2 önerisi B'nin onayını beklerken): Ayarlar'da bekleme uyarısını **1**, gecikmiş eşiğini **2** gün yapıp kaydedin, tekrar Önizle. (En düşük değerler bunlar; aynı gün verilen öneri hatırlatma üretmez.) | B (amir onayı bekleyen) ve **A (amirin amiri, eskalasyon)** listede. Sonra eski değerlere geri alın. |
| 4.5 | **Şimdi gönder**. | B ve A'ya e-posta + zilde "Kaizen hatırlatma". |
| 4.6 | Pazartesi 08:30 (TR) sonrası Vercel → Logs'ta `/api/cron/kaizen-reminders` çağrısına bakın. | 200 yanıtı. (401/503 ise 0.1'e dönün.) |

## 5. Amir ve Kurul kararları, fizibilite, uygulama (Faz 4.1, 4.5, 5.1, 5.2)

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 5.1 | B ile 3.1'i onaylayın (3.2'yi 4.4 için bekletin). | Öneri Kurul kuyruğuna düşer; B Kurul sekmelerini **görmez**. |
| 5.2 | K ile Kurul Değerlendirmesi → liste görünümü, filtre ikonu, sıralama; öneriye tıklayın. | Sağda karar paneli; altında "Benzer öneriler" ve "Geri dönüş" (net 40.000, %800, 1,3 ay). |
| 5.3 | K: "Karar vermeden önce fizibiliteye al" (sorumlu + hedef tarih). | Durum "Fizibilitede"; sorumluya bildirim. |
| 5.4 | K: panelde **Revize et** → 60.000, gerekçe yazın. | Revizyon geçmişi görünür; C'ye "kazanç revize edildi" bildirimi; Rapor'daki tutarlar güncellenir. |
| 5.5 | K: kriter seçip kabul edin. | Durum "Kurul Onayladı"; Uygulama'da "Fırsat havuzu"nda görünür. |
| 5.6 | B ile Uygulama → plan oluşturun, aksiyonları tamamlayın, gerçekleşen kazanç 52.000 ve **gerçekleşen yatırım** 6.000 girin, Tamamlandı yapın. | Geri dönüş kartında Beklenen / Gerçekleşen yan yana. |
| 5.7 | K ile gerçekleşen kazancı doğrulayın; sonra B ile yatırımı değiştirin. | Doğrulama "Bekliyor"a döner (yeniden doğrulama gerekir). |
| 5.8 | Uygulamada "Tek sayfa" çıktısını alın. | Yatay A4 tek sayfa, alt satırlar kesilmeden. |

## 6. Raporlar ve şampiyonlar (Faz 5.3–5.7)

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 6.1 | K ile Rapor. | Kazançlı öneri, kişi başı öneri, toplam yatırım, net gerçek kazanç; Geri Dönüş kartı; Bölüm Sıralaması. |
| 6.2 | Bölüm filtresi seçin. | Göstergeler ve tablolar süzülür. |
| 6.3 | **Excel indir** ve **PDF özet → Yazdır / PDF**. | Excel'de Özet / Öneriler / Bölüm Sıralaması sayfaları, yalnızca filtrelenmiş kayıtlar; PDF tek sayfa. |
| 6.4 | A (Kurul dışı amir) ile girin. | Menüde "Ekip Raporu": yalnızca B, C, D'nin önerileri; "Alt Ekip Sıralaması"nda B'nin dalı. A'nın kendi önerisi yok. |
| 6.5 | Şampiyonlar sekmesi; ay seçici ile önceki aya geçin. | Bu ay puan alan kişi ve bölüm kürsüde; Ana Sayfa kartında "Tümü" bağlantısı. |

## 7. Yapay zekâ ile benzerlik (Faz 6.2) — isteğe bağlı

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 7.1 | Y ile Ayarlar → "Yapay zekâ ile benzer öneri"yi açın, kaydedin, **Mevcut önerileri hazırla**. | "N / N öneri hazır". |
| 7.2 | C ile hiç ortak kelime kullanmadan aynı fikri yazın: "Operatör bağlantı elemanlarını tek tek topluyor, yere dökülüyor". | 3.1 benzer olarak gelir, yanında **"anlamca"** rozeti. |
| 7.3 | Özelliği kapatın, 7.2'yi tekrarlayın. | Rozet yok; ortak kelime yoksa sonuç da yok. |

## 8. Temizlik

- Test bitince Test Fabrika'yı silmek yerine pasife alın ya da Admin ile kayıtlarını temizleyin; gerçek müşterilere dokunmayın.
- Telefonda ana ekrana eklenen uygulamayı silmek isterseniz uzun basıp kaldırın.
- Bulunan sorunları numarasıyla bildirin (örn. "3.6: uçak modunda form boşaldı, iPhone 15, Safari").
