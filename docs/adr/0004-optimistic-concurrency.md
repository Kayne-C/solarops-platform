# ADR-0004: Taşınabilir optimistic concurrency ve HTTP ETag

- **Durum:** Kabul edildi
- **Bağlam:** İş emirleri merkezdeki planlamacı, sahadaki teknisyen ve otomasyon (performans pipeline'ı) tarafından
  eşzamanlı değiştirilir. v1'de son yazan kazanıyordu (lost update).

## Karar

- `WorkOrder.ConcurrencyStamp` (Guid) her mutasyonda yenilenir ve EF Core concurrency token olarak eşlenir.
  SQL Server `rowversion` kullanılmadı çünkü Oracle ve SQLite'ta karşılığı yoktur.
- HTTP'de damga **ETag** olarak döner; tüm iş emri mutasyonları **If-Match** ister:
  eski ETag → `412 Precondition Failed`, ETag yok → `428 Precondition Required`.
- Alt kayıt eklemek (aktivite, atama) kökün damgasını değiştirir; aggregate bir bütün olarak korunur.
- Otomasyon çakışmada geri çekilir: `DbUpdateConcurrencyException` durumunda insanın değişikliği kazanır.

## Sonuçlar

- (+) Kilitlenme (pessimistic lock) yok; okuma ölçeklenir.
- (+) Standart HTTP semantiği; istemciler ETag zincirleyerek ilerler.
- (−) İstemcinin 412'de yeniden okuyup birleştirmesi gerekir (UI'da "kayıt değişti" uyarısı).
