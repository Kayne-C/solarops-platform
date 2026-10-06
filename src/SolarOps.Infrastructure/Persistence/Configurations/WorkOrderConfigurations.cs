using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Identity;
using SolarOps.Domain.WorkOrders;
using SolarOps.Infrastructure.Persistence.Outbox;

namespace SolarOps.Infrastructure.Persistence.Configurations;

internal sealed class WorkOrderConfiguration : IEntityTypeConfiguration<WorkOrder>
{
    public void Configure(EntityTypeBuilder<WorkOrder> builder)
    {
        builder.ToTable("WorkOrders");
        builder.Property(w => w.Title).HasMaxLength(WorkOrder.TitleMaxLength).IsRequired();
        builder.Property(w => w.Description).HasMaxLength(WorkOrder.TextMaxLength);
        builder.Property(w => w.Resolution).HasMaxLength(WorkOrder.TextMaxLength);
        builder.Property(w => w.CorrelationKey).HasMaxLength(WorkOrder.CorrelationKeyMaxLength).IsRequired();

        // Portable optimistic concurrency (no SQL Server rowversion, so it works on Oracle and SQLite too).
        builder.Property(w => w.ConcurrencyStamp).IsConcurrencyToken();

        // Always non-null, so a plain composite unique index behaves identically on SQL Server and Oracle.
        builder.HasIndex(w => new { w.TenantId, w.CorrelationKey }).IsUnique();
        builder.HasIndex(w => new { w.TenantId, w.Status, w.CreatedAtUtc });
        builder.HasIndex(w => new { w.TenantId, w.PlantId });

        builder.HasOne<Plant>().WithMany().HasForeignKey(w => w.PlantId).OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(w => w.Assignments).WithOne().HasForeignKey(a => a.WorkOrderId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(w => w.Assignments).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(w => w.Activities).WithOne().HasForeignKey(a => a.WorkOrderId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(w => w.Activities).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class WorkOrderAssignmentConfiguration : IEntityTypeConfiguration<WorkOrderAssignment>
{
    public void Configure(EntityTypeBuilder<WorkOrderAssignment> builder)
    {
        builder.ToTable("WorkOrderAssignments");
        builder.HasKey(a => new { a.WorkOrderId, a.UserId });
        builder.HasOne<User>().WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class WorkActivityConfiguration : IEntityTypeConfiguration<WorkActivity>
{
    public void Configure(EntityTypeBuilder<WorkActivity> builder)
    {
        builder.ToTable("WorkActivities");
        builder.Property(a => a.Description).HasMaxLength(WorkOrder.TextMaxLength).IsRequired();
        builder.HasIndex(a => new { a.WorkOrderId, a.CreatedAtUtc });
        builder.HasOne<User>().WithMany().HasForeignKey(a => a.AuthorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("OutboxMessages");
        builder.Property(m => m.Id).ValueGeneratedNever();
        builder.Property(m => m.Type).HasMaxLength(OutboxMessage.TypeMaxLength).IsRequired();
        builder.Property(m => m.Payload).HasMaxLength(OutboxMessage.PayloadMaxLength).IsRequired();
        builder.Property(m => m.TraceParent).HasMaxLength(128);
        builder.Property(m => m.LastError).HasMaxLength(OutboxMessage.ErrorMaxLength);

        // Relay scan: oldest unprocessed first.
        builder.HasIndex(m => new { m.ProcessedOnUtc, m.OccurredOnUtc });
    }
}

internal sealed class InboxMessageConfiguration : IEntityTypeConfiguration<InboxMessage>
{
    public void Configure(EntityTypeBuilder<InboxMessage> builder)
    {
        builder.ToTable("InboxMessages");
        builder.HasKey(m => new { m.MessageId, m.Consumer });
        builder.Property(m => m.Consumer).HasMaxLength(InboxMessage.ConsumerMaxLength);
    }
}
