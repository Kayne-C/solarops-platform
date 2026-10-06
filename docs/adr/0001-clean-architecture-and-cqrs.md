# ADR-0001: Clean Architecture, vertical slice'lar ve kendi mediator'ımız

- **Durum:** Kabul edildi
- **Bağlam:** v1'de iş kuralları Express controller'larına ve React bileşenlerine dağılmıştı (ör. bozunum hesabı
  arayüzdeydi). Aynı kuralın REST, dosya import'u, gRPC ve arka plan işlerinden tutarlı çalışması gerekiyor.

## Karar

- Katmanlar: `Domain` ← `Application` ← `Infrastructure` ← `Api` / `Worker`. Kural mimari testlerle CI'da zorlanır.
- Application, use case başına bir dosya (command/query + validator + handler) içerir.
- Repository soyutlaması yerine `IApplicationDbContext` (EF Core `DbSet<T>`) kullanılır; EF Core zaten Unit of Work ve
  repository'dir. Sağlayıcı paketleri Application'a giremez.
- MediatR yerine ~60 satırlık `Sender` + `IPipelineBehavior<,>` yazıldı.

## Gerekçe

- MediatR 13 ve MassTransit 9 ticari lisansa geçti; çekirdek akışın lisans riskine bağlı olması istenmedi. İhtiyaç
  duyulan özellik seti (dispatch + behavior zinciri) küçüktür ve test edilebilir.
- Static abstract interface (`IResultFactory<TSelf>`) ile validation behavior, yansıma kullanmadan tipli hata üretir.

## Sonuçlar

- (+) Handler'lar `internal sealed`; dış dünya yalnızca `ISender` ile konuşur.
- (+) Use case'ler HTTP'den bağımsız test edilir; aynı komut gRPC ve worker'dan çağrılır.
- (−) Notification/streaming gibi MediatR özellikleri yok; ihtiyaç olursa eklenecek (bilinçli YAGNI).
