# Kaizen Öneri Sistemi — Gereksinim Karşılaştırması ve İş Planı (2026-10-27)

Kaynak: kullanıcının gereksinim dosyası `~/Claude/5SAudit/Kaizen öneri fonksiyonları .rtf` ve 2026-10-27
sistem incelemesi. Kod durumu: `main` @ 2757a65 (Faz 0, 2-A, 2-B tamam). İlerleme notu:
[KAIZEN_PROGRESS_2026-10-27.md](KAIZEN_PROGRESS_2026-10-27.md).

**Yol haritası kararı (kullanıcı):** temel fonksiyonlar önce Gemba Tools içinde tamamlanır; repoların ayrılması
(stand-alone SaaS ve Gemba Opx Suite Pro/Plus entegrasyonu) **en son** yapılır. Bu yüzden her yeni parça,
ileride ayrılabilecek şekilde yazılır (bkz. §3 "Tasarım kuralları").

## 1. Gereksinim karşılaştırması

✅ var · 🟡 kısmen · ❌ yok

| # | Gereksinim (dosyadan) | Durum | Bugünkü karşılığı / eksik |
|---|---|---|---|
| G1 | Personel kaydı: çalışan, **sicil no**, bölüm, amir (kurulumda ya da sistem veritabanında) | 🟡 | Kurulum → Personel Listesi var (ad, e-posta, bölüm, görev, vardiya, amir/makine lideri e-postası, Kurul üyeliği). **Sicil no yok**; amir e-postayla bağlı, personel kaydına değil; giriş hesabıyla bağ yalnızca e-posta eşleşmesi. |
| G2 | Telefondan / responsive siteden giriş, **QR okutarak** giriş | 🟡 | Uygulama telefonda açılıyor (responsive kabuk, kamera ile fotoğraf). Ama tam hesap (e-posta+şifre) gerekiyor; QR ile müşteriye özel giriş sayfası, PWA yok. |
| G3 | **Kiosk**: sicil no ile bağlanıp öneri verme | ❌ | Sicil/PIN girişi, ortak cihaz modu, otomatik çıkış yok. |
| G4 | Öneri sahibi: kendi puanları, geçmiş/onaylı/bekleyen önerileri | ✅ | Ana Sayfa (puanım, sayılar) + Önerilerim (durum filtreleri, süreç adımları). Ancak sunucu tüm önerileri herkese gönderiyor (yalnızca ekran filtreliyor) → G9. |
| G5 | Öneri sahibi amirine **mesaj** bırakabilmeli; **hazır talep butonları** (değerlendirme talebi, onay talebi, durum teyidi); kayıtlar öneri altında | ❌ | Yalnızca karar yorumları (onay/red gerekçesi) öneri altında görünüyor. Mesaj/talep akışı yok. |
| G6 | Öneri gelince amire otomatik **e-posta**; ileride app / WhatsApp | 🟡 | E-posta var (amire, Kurul'a, öneri sahibine). Kanal soyutlaması yok; WhatsApp/SMS/push yok (Opx Suite'te `whatsappService`, `netgsmSmsService` mevcut). |
| G7 | Amir: kendi ekibinin önerileri ve **ekibin toplam puanları**; raporlar yalnızca kendi ekibi | 🟡 | Amir ekibinin önerilerini Önerilerim'de görüyor, onay kuyruğunu yönetiyor, ekibi adına öneri girebiliyor. **Ekip puanları ve ekip raporu yok** (Rapor yalnızca Kurul'a açık). **Tek kademe**: hat yöneticisi alt ekipleri göremiyor. |
| G8 | Amir onaylayınca Kurul ekranına düşer; **amir Kurul ekranını göremez** | ✅ | Kurul sekmeleri yalnızca Kurul üyelerine görünüyor; amir onayı Kurul kuyruğuna düşürüyor (Faz 2-B.3 ile müşteri bazında ayarlanabilir). |
| G9 | Amir yalnızca kendi ekibinin bilgilerini görür | 🟡 | Ekranda öyle; **sunucuda değil** — öneri, değerlendirme ve uygulama listeleri müşterideki herkese tümüyle gidiyor (fotoğraflar dahil). |
| G10 | **Kurul yöneticisi**: tüm Kaizen ekranlarında admin yetkisi, görür ve değiştirir | ❌ | Böyle bir rol yok. Kurulum ve Ayarlar yalnızca Gemba Tools Admin/Consultant'ına açık; müşterinin kendi Kurul yöneticisi personeli/ayarları yönetemiyor. |
| G11 | Durumlar: **Ret, Değerlendiriliyor (fizibilite), Kabul edildi, Uygulama aşaması (izleniyor)** | 🟡 | Ret / Kabul / uygulama durumları (Planlandı, Sürüyor, Tamamlandı, İptal) var. **"Değerlendiriliyor (fizibilite)" ara durumu yok** — Kurul tek adımda karar veriyor. |
| G12 | Kabul edilmiş ama uygulamaya alınmamış öneriler **potansiyel fırsat ve kazanç** olarak izlenmeli, **uyarı** yapılmalı | 🟡 | Uygulama ekranında "Plan bekliyor" ve "Geciken" filtreleri/kartları var. **Potansiyel kazanç toplamı (fırsat havuzu), yaşlandırma ve otomatik hatırlatma yok.** |
| G13 | Sistem hafızası: **benzer içerikli / benzer konulu önceki önerileri tespit** | ❌ | Yok. |
| G14 | Beklenen kazanç **teyit edilebilmeli, revize edilebilmeli**; raporlarda beklenen vs gerçekleşen kazanç ve **geri dönüş** | 🟡 | Kurul onayında beklenen getiri, uygulamada gerçekleşen kazanç + Kurul doğrulaması, raporda ikisi yan yana var. **Beklenen kazancın sonradan revizyonu (geçmişiyle), gerçekleşen yatırım/maliyet ve geri dönüş (ROI, geri ödeme süresi) yok.** |
| G15 | Önce/Sonra **A4** çıktı | ✅ | CI formatında yatay A4 tek sayfa (KaizenOnePager), Yazdır/PDF. |
| G16 | Raporlar: aylık gelen, kabul edilen, **kazançlı** öneriler, katılım, **kişi başı öneri**, **toplam yatırım** ve toplam kazanç | 🟡 | Var: aylık sayı, durum analizi, katılım oranı, tahmini/doğrulanmış kazanç. **Yok: kazançlı öneri sayısı, kişi başı öneri, toplam yatırım, net kazanç/ROI.** |
| G17 | En çok öneri veren kişiler, isme göre süzme, **katılım puanları**, en çok öneri veren departmanlar | 🟡 | Var: kişi başına öneri (ilk 20), Lider Panosu (puan + öneri sayısı), departman dağılımı, isim filtresi. **Katılım puanı tanımı yok** (yalnızca Kurul puanı); departman sıralaması grafik olarak var, tablo/sıralama değil. |
| G18 | Rapor **PDF** ve **XLS** olarak dışa aktarım | 🟡 | Excel yalnızca öneri listesi (`export-excel`). **Rapor PDF'i ve rapor özetini içeren Excel yok.** |
| G19 | **Ayın Kaizen şampiyonları** sekmesi | ❌ | Lider Panosu tüm dönem için; aylık şampiyon sekmesi yok. |
| G20 | Personel verisi Opx Suite'ten alınmalı; stand-alone'da kurulumda girilmeli | 🟡 | Stand-alone kurulum (Personel Listesi) var; dış kaynaktan personel alma yok → Faz 7. |
| G21 | Stand-alone SaaS **veya** Opx Suite Pro/Plus içinde (frame) çalışma | 🟡 | Ön yüz modülü uygulamaya yalnızca 2 noktadan bağlı (müşteri/oturum bağlamı, token). Sunucu rotaları `app.ts` içinde, giriş/e-posta/veri Gemba Tools'a bağlı → Faz 7. |

## 2. İş planı

Sıra bağımlılığa göre: önce kimlik ve yetki (her şey buna dayanıyor), sonra akış ve iletişim, sonra
kazanç/rapor, en son ayırma. Boyut: S ≈ 1 oturum, M ≈ 2–3, L ≈ 4+.

### Faz 3 — Kimlik, roller ve görünürlük (temel) — G1, G3, G7, G9, G10
| İş | Boyut | Kabul ölçütü |
|---|---|---|
| 3.1 Personel modeli: **sicil no** (müşteri içinde benzersiz, zorunlu), amir **personel kaydına** referans (e-posta değil), hiyerarşi (amirin amiri) ile **çok kademeli ekip** | M | Sicil no tekrarında kayıt reddedilir; bir hat yöneticisi alt takım liderlerinin ekiplerini de görür; eski e-posta bağlı kayıtlar otomatik eşleştirilir. |
| 3.2 Personel içe aktarma (Excel) ve sicil no ile toplu güncelleme | S | Şablonla yüzlerce personel tek seferde yüklenir; hatalı satırlar listelenir. |
| 3.3 **Kaizen rolleri**: Personel · Amir (ekip) · Kurul Üyesi · **Kurul Yöneticisi** (müşteri içinde Kaizen admin'i: tüm ekranlar + Kurulum/Ayarlar) | M | Kurul yöneticisi Gemba Tools Admin'i olmadan personel/kriter/ayar yönetir; amir Kurul sekmelerini ve diğer ekipleri göremez. |
| 3.4 **Sunucu taraflı görünürlük**: liste uçları role göre filtreler (personel → kendi; amir → ekibi; Kurul → tümü); listeden fotoğraflar ayrılır (detayda yüklenir) | M | API'den başkasının önerisi alınamaz (test ile); telefonda liste yükü belirgin düşer. |
| 3.5 **Sicil no + PIN girişi** (e-postasız saha çalışanı); PIN'i Kurul yöneticisi atar/sıfırlar; hız sınırı ve kilitleme | M | E-postası olmayan çalışan sicil+PIN ile girer, yalnızca Kaizen ekranlarını görür. |
| 3.6 **Kiosk modu**: müşteriye özel kiosk adresi, büyük dokunmatik arayüz, sicil+PIN, işlem sonrası/hareketsizlikte otomatik çıkış | M | Ortak tablette arka arkaya farklı çalışanlar öneri verir; bir öncekinin oturumu açık kalmaz. |
| 3.7 **QR ile giriş**: müşteriye (ya da hatta) özel QR → telefonda Kaizen giriş sayfası | S | QR okutulunca doğru müşterinin giriş ekranı açılır. |

### Faz 4 — Akış ve iletişim — G5, G6, G11, G12
| İş | Boyut | Kabul ölçütü |
|---|---|---|
| 4.1 **"Değerlendiriliyor (fizibilite)"** durumu: Kurul öneriyi fizibiliteye alır (sorumlu + hedef tarih), sonra kabul/ret | S | Durum etiketleri ve raporlar yeni durumu içerir; eski kayıtlar etkilenmez. |
| 4.2 **Öneri altı mesajlaşma** + hazır talep butonları (Değerlendirme talebi, Onay talebi, Durum teyidi); kayıtlar öneri zaman çizelgesinde | M | Öneri sahibi ve amir aynı öneri altında yazışır; her talep amire bildirim olarak gider. |
| 4.3 **Bildirim katmanı**: tek arayüz, kanal olarak e-posta (şimdi), WhatsApp/SMS/push (sonra; Opx Suite servisleri); kullanıcı bazında kanal tercihi | M | Yeni kanal eklemek akış koduna dokunmadan yapılır. |
| 4.4 **Hatırlatmalar** (zamanlanmış): amir onayı bekleyen, kabul edilip planlanmayan, geciken uygulama, kalıcılık kontrolü günü gelen | S | Eşik günleri Faz 2-B ayarlarından okunur; haftalık cron ile gönderilir. |
| 4.5 **Fırsat havuzu**: kabul edilip uygulanmayan öneriler — toplam potansiyel kazanç, yaşlandırma (0-30/30-90/90+ gün), uyarı rozetleri | S | Kurul ekranında ve raporda "bekleyen potansiyel kazanç" görünür. |

### Faz 5 — Kazanç, raporlar ve motivasyon — G14, G16–G19, amir raporu (G7)
| İş | Boyut | Kabul ölçütü |
|---|---|---|
| 5.1 **Beklenen kazanç revizyonu** (kim, ne zaman, neden; geçmiş korunur) + uygulamada **gerçekleşen yatırım/maliyet** | S | Revizyon geçmişi öneri altında görünür; raporlar son değeri kullanır. |
| 5.2 **Geri dönüş**: net kazanç, ROI, geri ödeme süresi (Kazanç Süresi'ne göre yıllıklaştırma) | S | Öneri ve rapor düzeyinde hesaplanır; birim ve varsayımlar ekranda yazılı. |
| 5.3 Rapor eklemeleri: kazançlı öneri sayısı, kişi başı öneri, toplam yatırım, net kazanç, departman sıralama tablosu | S | Yeni KPI'lar filtrelerle (tarih, bölüm, kişi) birlikte çalışır. |
| 5.4 **Katılım puanı** tanımı (öneri verme, onaylanma, uygulanma için puanlar — ayarlardan) | S | Kurul puanından ayrı, şeffaf kurallarla hesaplanır. |
| 5.5 **Ayın Kaizen Şampiyonları** sekmesi (kişi ve departman, aylık; geçmiş aylar) | S | Seçilen ay için ilk 3 kişi/departman, puan ve öneri sayısıyla. |
| 5.6 **Amir raporu**: yalnızca kendi ekibi (alt kademeler dahil) — ekip puanları, durumlar, kazanç | S | Amir başka ekip verisi göremez (sunucu taraflı, 3.4). |
| 5.7 Rapor **PDF** (yönetici özeti) ve rapor **Excel**'i (KPI + tablolar) | M | Filtrelenmiş rapor iki biçimde de indirilebilir. |

### Faz 6 — Hafıza ve mobil — G13, G2
| İş | Boyut | Kabul ölçütü |
|---|---|---|
| 6.1 **Benzer öneri tespiti** — 1. adım: metin benzerliği (konu/mevcut durum/öneri, aynı bölüm/sınıf), öneri girerken ve Kurul ekranında "benzer öneriler" | M | Aynı konulu önceki öneriler (durumu ve sonucuyla) listelenir. |
| 6.2 Benzer öneri — 2. adım: anlamsal benzerlik (AI embedding; projede Gemini mevcut) | M | Farklı kelimelerle yazılmış aynı fikir bulunur; müşteri verisi müşteri dışına karışmaz. |
| 6.3 **PWA**: ana ekrana ekleme, telefon için sadeleştirilmiş öneri akışı, kamera, zayıf bağlantıda taslak saklama | M | Telefonda Kaizen tek başına uygulama gibi açılır. Mağaza uygulaması kararı sonra (bkz. §4). |

### Faz 7 — Ayırma ve entegrasyon (en son) — G20, G21
| İş | Boyut | Kabul ölçütü |
|---|---|---|
| 7.1 Kaizen sunucu kodunu ayrı modüle taşıma (router + servis); giriş, personel kaynağı, bildirim, depolama için **adaptör arayüzleri** | L | Gemba Tools davranışı değişmeden modül tek klasörden çalışır. |
| 7.2 **Stand-alone SaaS** paketi (kendi girişi, kurulum, personel kaydı) | L | Ayrı alan adında Gemba Tools olmadan çalışır. |
| 7.3 **Opx Suite Pro/Plus entegrasyonu**: personel Opx Suite'ten (sicil, bölüm, ekip lideri — `personel`, `personel_calisma_grup_tanim.ekip_lideri_ref_no`), Opex menüsünden açılış (frame + tek oturum) ya da yerel ekran | L | Opx Suite kullanıcısı yeniden giriş yapmadan Kaizen'i kullanır; Opx Suite'teki eski basit Kaizen (`kaizen_onerisi`) verisi taşınır. |

## 3. Tasarım kuralları (ayırmayı en sona bırakmanın şartı)
- Yeni Kaizen kodu, Gemba Tools'a özgü yapılara (`useFactory`, `users` tablosu, `sendMail`) **doğrudan** değil, ince
  bir katman üzerinden bağlanır; Faz 7'de yalnızca o katman değişir.
- Personel kimliği **sicil no + müşteri** ile tanımlanır; e-posta yalnızca bildirim kanalıdır.
- Tüm kurallar (aşamalar, eşikler, puanlar) Faz 2-B'deki `kaizen_settings` üzerinden müşteri bazında kalır.
- Görünürlük sunucuda uygulanır; ekran filtresi yetki sayılmaz.

## 2a. Durum ve sıra (2026-10-28)
**Tamamlanan:** Faz 3 (3.1–3.7) ve Faz 4 (4.1–4.5) — ayrıntılar `KAIZEN_PROGRESS_2026-10-27.md`. Ek olarak: parça başı kazanç
(yıllık hacim × yıl), QR girişinde personel aramasının sağlamlaştırılması (2026-10-28, telefonda doğrulandı).

**Sıradaki işler (bu sırayla):**
1. ~~§4 açık kararları 2, 4, 6~~ — verildi (2026-10-28), aşağıda.
2. ~~Eskalasyon~~ — yapıldı (2026-10-28).
3. Faz 5: ~~5.1 kazanç revizyonu + gerçekleşen yatırım~~ (2026-10-28) → ~~5.2 ROI/geri ödeme~~ (2026-10-28) → ~~5.3 rapor KPI'ları~~ (2026-10-28) →
   ~~5.5 Şampiyonlar sekmesi~~ (2026-10-28) → ~~5.6 amir raporu~~ (2026-10-28) → ~~5.7 PDF/Excel rapor~~ (2026-10-28). **Faz 5 tamamlandı.** (5.4 iptal.)
4. Faz 6: ~~6.1 benzer öneri (metin)~~ (2026-10-28) → ~~6.3 PWA~~ (2026-10-28) → 6.2 anlamsal benzerlik.
5. Faz 7: 7.1 modül ayırma → 7.3 Opx Suite entegrasyonu → 7.2 stand-alone (madde 5 kararıyla).

**Canlıda yapılacak:** Vercel'de `CRON_SECRET` tanımlı olmalı (haftalık hatırlatmalar); 4.x özellikleri canlıda uçtan uca denenmedi.

## 4. Kullanıcı kararı gereken noktalar
1. ~~**Giriş**~~ — **karar verildi:** sicil no; PIN yalnızca yetkili rollerden (ayarlardan değiştirilebilir). Eski soru: sicil no + PIN mi, sicil no + kart (barkod/RFID) mi, ya da ikisi? PIN'i kim dağıtır?
2. ~~**Mobil**~~ — **karar verildi:** önce PWA; mağaza uygulaması gerekirse sonra. Eski soru: önce PWA (önerilen) mı, doğrudan mağaza uygulaması mı?
3. ~~**Kurul yöneticisi**~~ — **karar verildi:** müşteri çalışanı, yetkiyi Gemba personeli verir. Eski soru: Kurul yöneticisi müşteri çalışanı mı olacak (önerilen), yoksa yalnızca Gemba danışmanı mı?
4. ~~**Katılım puanı**~~ — **karar verildi:** olmayacak; Şampiyonlar Kurul puanı ve öneri sayısıyla sıralanır (5.4 iptal). Eski soru: Katılım puanı kuralları (öneri verme / onay / uygulama başına kaç puan) ve ödülle ilişkisi.
5. **Opx Suite entegrasyon biçimi**: frame içinde Gemba Tools ekranı mı, Opx Suite içinde yerel ekran mı; veri MySQL'de mi kalacak?
6. ~~Eskalasyon~~ — **karar verildi:** mesajların hepsi değil; amir onayı "gecikmiş" eşiğini aşınca haftalık özet amirin amirine de gider. Eski soru: Öneri sahibinin amirine mesajı amirin amirine de (eskalasyon) gitmeli mi?

## 5. Önerilen başlangıç
Faz 3.1 → 3.3 → 3.4 (personel modeli, roller, sunucu görünürlüğü): kiosk, telefon ve amir raporlarının hepsi
bunlara dayanıyor. Ardından 3.5–3.7 (sicil/PIN, kiosk, QR) — §4 madde 1–3 kararlarıyla.
