using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SolarOps.Application.Diagnostics;
using SolarOps.Infrastructure.Persistence;

namespace SolarOps.Infrastructure.Messaging;

/// <summary>
/// Relays committed outbox rows to the broker. Delivery is at-least-once: a crash between publish and
/// "mark processed" re-publishes, which the consumer inbox absorbs. Running several relays concurrently is
/// safe for the same reason (duplicates, never losses); a single active relay per database is the cheap default.
/// </summary>
public sealed partial class OutboxProcessor(
    IServiceScopeFactory scopeFactory,
    IEventBus eventBus,
    IOptions<MessagingOptions> options,
    TimeProvider clock,
    ILogger<OutboxProcessor> logger) : BackgroundService, IOutboxProcessor
{
    private readonly OutboxOptions _options = options.Value.Outbox;

    public async Task<int> ProcessBatchAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SolarOpsDbContext>();

        // The outbox is not tenant-owned: the relay sees every tenant's messages and forwards the tenant id in the envelope.
        var messages = await db.OutboxMessages
            .Where(m => m.ProcessedOnUtc == null && m.Attempts < _options.MaxAttempts)
            .OrderBy(m => m.OccurredOnUtc)
            .Take(_options.BatchSize)
            .ToListAsync(cancellationToken);

        foreach (var message in messages)
        {
            try
            {
                await eventBus.PublishAsync(
                    new EventEnvelope(message.Id, message.Type, message.TenantId, message.Payload, message.TraceParent, message.OccurredOnUtc),
                    cancellationToken);

                message.MarkProcessed(clock.GetUtcNow().UtcDateTime);
                SolarOpsTelemetry.OutboxMessagesPublished.Add(1, new KeyValuePair<string, object?>("type", message.Type));
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                message.MarkFailed(exception.Message);
                LogPublishFailed(logger, exception, message.Id, message.Type, message.Attempts);
            }
        }

        if (messages.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }

        return messages.Count;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            return;
        }

        using var timer = new PeriodicTimer(_options.PollingInterval, clock);
        do
        {
            try
            {
                // Drain while full batches keep coming, then wait for the next tick.
                while (await ProcessBatchAsync(stoppingToken) == _options.BatchSize)
                {
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                LogRelayFailed(logger, exception);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Publishing outbox message {MessageId} ({Type}) failed, attempt {Attempt}")]
    private static partial void LogPublishFailed(ILogger logger, Exception exception, Guid messageId, string type, int attempt);

    [LoggerMessage(Level = LogLevel.Error, Message = "Outbox relay iteration failed")]
    private static partial void LogRelayFailed(ILogger logger, Exception exception);
}
