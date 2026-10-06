# ADR-0002: Paylaşılan şema + TenantId ile multi-tenancy

- **Durum:** Kabul edildi
- **Bağlam:** Platform birden fazla O&M şirketine hizmet verecek. Kiracı sayısı onlarca–yüzler, kiracı başına
  santral sayısı birkaç–birkaç yüz. Kiracılar arası veri sızıntısı kabul edilemez.

## Seçenekler

| Seçenek | İzolasyon | Operasyon maliyeti | Kiracılar arası raporlama |
|---|---|---|---|
| Kiracı başına veritabanı | En güçlü | Yüksek (N migration, N bağlantı havuzu) | Zor |
| Kiracı başına şema | Güçlü | Orta | Orta |
| **Paylaşılan şema + `TenantId`** | Uygulama düzeyinde | Düşük | Kolay |

## Karar

Paylaşılan şema; izolasyon üç katmanda **varsayılan olarak kapalı** (fail-closed) uygulanır:

1. **Okuma:** her `ITenantOwned` entity'ye EF Core 10 *named query filter* (`TenantIsolation`). Filtreyi kapatmak için
   ismini açıkça vermek gerekir; kod incelemesinde görünür.
2. **Yazma:** `AuditAndTenantInterceptor` yeni satıra kiracıyı basar ve başka kiracıya ait satırın değiştirilmesini
   reddeder.
3. **Paylaşılan altyapı:** cache anahtarları, rate limit partition'ları ve mesaj başlıkları kiracı taşır.

Tüm tenant'lı unique index'ler `TenantId` ile başlar (ör. `(TenantId, Code)`), böylece hem kiracı başına benzersizlik
hem de kiracı filtreli sorgular için doğru index önekleri elde edilir.

## Sonuçlar

- (+) Tek migration seti, tek bağlantı havuzu, düşük maliyet.
- (+) Entegrasyon testleri izolasyonu uçtan uca doğrular (okuma, yazma, iş emri, kullanıcı atama).
- (−) "Gürültülü komşu" riski → kiracı başına token-bucket rate limiting ile azaltıldı.
- (−) Çok büyük bir kiracı ileride kendi veritabanına taşınabilir; `TenantContext` + sağlayıcı seçimi bu geçişe izin
  verecek şekilde tasarlandı (yol haritasında).
