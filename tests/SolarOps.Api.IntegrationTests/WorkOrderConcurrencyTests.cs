using System.Net;
using System.Net.Http.Json;
using SolarOps.Application.Features.WorkOrders;
using SolarOps.Domain.WorkOrders;

namespace SolarOps.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class WorkOrderConcurrencyTests(SolarOpsApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Concurrent_editors_cannot_overwrite_each_other()
    {
        var tenant = await factory.SeedTenantAsync();
        using var dispatcher = await factory.CreateClientAsync(tenant, "engineer");
        using var technician = await factory.CreateClientAsync(tenant, "tech");
        var workOrderId = await CreateWorkOrderAsync(dispatcher, tenant);

        // Both open the same version.
        var etag = (await dispatcher.GetAsync($"/api/v1/work-orders/{workOrderId}", Ct)).Headers.ETag!.Tag;

        var first = await SendAsync(dispatcher, $"/api/v1/work-orders/{workOrderId}/assignments", new { userId = tenant.TechnicianId }, etag);
        var second = await SendAsync(technician, $"/api/v1/work-orders/{workOrderId}/activities", new { description = "On my way" }, etag);
        var withoutEtag = await SendAsync(technician, $"/api/v1/work-orders/{workOrderId}/activities", new { description = "On my way" }, null);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.PreconditionFailed, second.StatusCode);
        Assert.Equal(HttpStatusCode.PreconditionRequired, withoutEtag.StatusCode);
        Assert.NotEqual(etag, first.Headers.ETag!.Tag);
    }

    [Fact]
    public async Task Lifecycle_is_driven_by_etag_chaining_and_the_aggregate_state_machine()
    {
        var tenant = await factory.SeedTenantAsync();
        using var client = await factory.CreateClientAsync(tenant, "engineer");
        var workOrderId = await CreateWorkOrderAsync(client, tenant);
        var etag = (await client.GetAsync($"/api/v1/work-orders/{workOrderId}", Ct)).Headers.ETag!.Tag;

        var startTooEarly = await SendAsync(client, $"/api/v1/work-orders/{workOrderId}/transitions", new { transition = "Start" }, etag);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, startTooEarly.StatusCode);

        var assigned = await SendAsync(client, $"/api/v1/work-orders/{workOrderId}/assignments", new { userId = tenant.TechnicianId }, etag);
        var started = await SendAsync(client, $"/api/v1/work-orders/{workOrderId}/transitions", new { transition = "Start" }, assigned.Headers.ETag!.Tag);
        var completed = await SendAsync(
            client, $"/api/v1/work-orders/{workOrderId}/transitions", new { transition = "Complete", note = "String fuse replaced" }, started.Headers.ETag!.Tag);

        Assert.Equal(HttpStatusCode.OK, completed.StatusCode);
        var details = await client.GetFromJsonAsync<WorkOrderDetailsResponse>($"/api/v1/work-orders/{workOrderId}", SolarOpsApiFactory.Json, Ct);
        Assert.Equal(WorkOrderStatus.Completed, details!.Status);
        Assert.Equal([tenant.TechnicianId], details.AssigneeIds);
        Assert.Equal("String fuse replaced", details.Resolution);
    }

    [Fact]
    public async Task Users_of_another_tenant_cannot_be_assigned()
    {
        var tenant = await factory.SeedTenantAsync();
        var other = await factory.SeedTenantAsync();
        using var client = await factory.CreateClientAsync(tenant, "engineer");
        var workOrderId = await CreateWorkOrderAsync(client, tenant);
        var etag = (await client.GetAsync($"/api/v1/work-orders/{workOrderId}", Ct)).Headers.ETag!.Tag;

        var response = await SendAsync(client, $"/api/v1/work-orders/{workOrderId}/assignments", new { userId = other.TechnicianId }, etag);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task<Guid> CreateWorkOrderAsync(HttpClient client, SeededTenant tenant)
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/work-orders",
            new { plantId = tenant.PlantId, title = "Inverter 3 offline", type = "Fault", priority = "High" },
            Ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<WorkOrderVersionResponse>(SolarOpsApiFactory.Json, Ct))!.Id;
    }

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, string url, object body, string? etag)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body) };
        if (etag is not null)
        {
            request.Headers.TryAddWithoutValidation("If-Match", etag);
        }

        return client.SendAsync(request, Ct);
    }
}
