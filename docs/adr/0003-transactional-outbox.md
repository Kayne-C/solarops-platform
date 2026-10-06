# ADR-0003: Transactional outbox + idempotent tüketiciler

- **Durum:** Kabul edildi
- **Bağlam:** Üretim yazıldığında performans değerlendirmesi ve bildirim tetiklenmeli. "Veritabanına yaz, sonra
  broker'a yayınla" yaklaşımı iki sistem arasında atomik değildir: ikinci adım başarısız olursa olay kaybolur, sıra
  terse dönerse geri alınmış bir değişiklik için olay yayınlanır.

## Karar

- Domain olayları, durum değişikliğiyle **aynı `SaveChanges`** içinde `OutboxMessages` tablosuna yazılır
  (`OutboxInterceptor`).
- Worker'daki relay, mesajları RabbitMQ'ya **publisher confirms** ile yayınlar ve sonra işaretler.
- Teslimat **at-least-once**'tır. Tekrarlar tüketicide emilir:
  - `InboxMessages (MessageId, Consumer)` birincil anahtarı,
  - iş kuralının doğal anahtarı (ör. `perf-alert:{plant}:{yyyy-MM}` + unique index).
- Her abonelik kendi **quorum queue**'suna sahiptir (abonelik içinde competing consumers, abonelikler arasında
  fan-out). Hatalı mesaj requeue edilir; `x-delivery-limit` aşılınca DLQ'ya düşer.
- Routing key ve mesaj tipi, olayın kısa tip adıdır; tüketici yalnızca abone olduğu tipe deserialize eder.

## Değerlendirilen alternatifler

- **Dağıtık transaction (2PC):** RabbitMQ desteklemez; ölçeklenmez.
- **MassTransit/NServiceBus outbox:** olgun ama ticari lisans; ayrıca öğrenilecek davranışı gizler.
- **CDC (Debezium):** güçlü ama bu ölçek için operasyonel yükü fazla.

## Sonuçlar

- (+) Olay kaybı yok; geri alınan değişiklik için olay yok.
- (+) Birden fazla relay/tüketici replikası güvenle çalışır (ölçümlerde 2 worker ile tekrarlı iş emri oluşmadı).
- (−) Uçtan uca gecikme polling aralığına bağlı (varsayılan 1 sn; ölçümde ort. 0,6 sn).
- (−) Outbox tablosu büyür → işlenmiş mesajlar için temizleme işi (retention) yol haritasında.
