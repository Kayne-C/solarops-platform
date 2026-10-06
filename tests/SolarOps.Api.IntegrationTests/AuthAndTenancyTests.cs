using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SolarOps.Application.Common;
using SolarOps.Application.Features.Assets;
using SolarOps.Application.Features.Auth;
using SolarOps.Domain.Assets;

namespace SolarOps.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class AuthAndTenancyTests(SolarOpsApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Valid_credentials_issue_a_token_bound_to_the_tenant()
    {
        var tenant = await factory.SeedTenantAsync();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/token", new IssueAccessTokenCommand(tenant.Slug, $"engineer@{tenant.Slug}.test", SolarOpsApiFactory.Password), Ct);

        response.EnsureSuccessStatusCode();
        var token = await response.Content.ReadFromJsonAsync<AccessTokenResponse>(SolarOpsApiFactory.Json, Ct);
        var payload = JsonDocument.Parse(DecodeSegment(token!.AccessToken.Split('.')[1])).RootElement;
        Assert.Equal(tenant.TenantId.ToString(), payload.GetProperty("tenant_id").GetString());
        Assert.Equal("Engineer", payload.GetProperty("role").GetString());
    }

    [Theory]
    [InlineData(true, "wrong-password")]
    [InlineData(false, SolarOpsApiFactory.Password)]
    public async Task Bad_credentials_and_unknown_tenants_get_the_same_401(bool knownTenant, string password)
    {
        var tenant = await factory.SeedTenantAsync();
        using var client = factory.CreateClient();
        var slug = knownTenant ? tenant.Slug : "no-such-tenant";

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/token", new IssueAccessTokenCommand(slug, $"admin@{tenant.Slug}.test", password), Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains("Auth.InvalidCredentials", await response.Content.ReadAsStringAsync(Ct), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Anonymous_requests_are_rejected()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/v1/plants", Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Another_tenants_plant_is_indistinguishable_from_a_missing_one()
    {
        var owner = await factory.SeedTenantAsync();
        var intruder = await factory.SeedTenantAsync();
        using var intruderClient = await factory.CreateClientAsync(intruder);

        var read = await intruderClient.GetAsync($"/api/v1/plants/{owner.PlantId}", Ct);
        var write = await intruderClient.PutAsJsonAsync(
            $"/api/v1/plants/{owner.PlantId}/daily-yields",
            new { entries = new[] { new { date = "2025-06-01", energyKwh = 100 } } },
            Ct);
        var workOrder = await intruderClient.PostAsJsonAsync(
            "/api/v1/work-orders",
            new { plantId = owner.PlantId, title = "Hijack", type = "Fault", priority = "Low" },
            Ct);
        var list = await intruderClient.GetFromJsonAsync<PagedResponse<PlantSummaryResponse>>("/api/v1/plants", SolarOpsApiFactory.Json, Ct);

        Assert.Equal(HttpStatusCode.NotFound, read.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, write.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, workOrder.StatusCode);
        Assert.DoesNotContain(list!.Items, p => p.Id == owner.PlantId);
        Assert.Contains(list.Items, p => p.Id == intruder.PlantId);
    }

    [Fact]
    public async Task Plant_codes_are_unique_per_tenant_not_globally()
    {
        var first = await factory.SeedTenantAsync();
        var second = await factory.SeedTenantAsync();
        using var firstClient = await factory.CreateClientAsync(first);
        using var secondClient = await factory.CreateClientAsync(second);

        var duplicateInSameTenant = await RegisterAsync(firstClient, "PLT-01");
        var sameCodeOtherTenant = await RegisterAsync(secondClient, "PLT-02");

        Assert.Equal(HttpStatusCode.Conflict, duplicateInSameTenant.StatusCode);
        Assert.Equal(HttpStatusCode.Created, sameCodeOtherTenant.StatusCode);
    }

    [Fact]
    public async Task Technicians_cannot_register_plants()
    {
        var tenant = await factory.SeedTenantAsync();
        using var technician = await factory.CreateClientAsync(tenant, "tech");

        var response = await RegisterAsync(technician, "PLT-99");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Validation_errors_are_reported_per_field()
    {
        var tenant = await factory.SeedTenantAsync();
        using var client = await factory.CreateClientAsync(tenant);

        var response = await client.PostAsJsonAsync(
            "/api/v1/plants",
            new { code = "bad code!", name = "", type = "GroundSolar", installedCapacityKwp = -5, annualDegradationRatePercent = 9, commissioningDate = "2024-01-01" },
            Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("errors");
        foreach (var field in new[] { "Code", "Name", "InstalledCapacityKwp", "AnnualDegradationRatePercent", "InvestorId" })
        {
            Assert.True(errors.TryGetProperty(field, out _), $"Missing validation error for {field}.");
        }
    }

    private static async Task<HttpResponseMessage> RegisterAsync(HttpClient client, string code)
    {
        var investors = await client.GetFromJsonAsync<List<InvestorResponse>>("/api/v1/investors", SolarOpsApiFactory.Json, Ct);
        var sites = await client.GetFromJsonAsync<List<SiteResponse>>("/api/v1/sites", SolarOpsApiFactory.Json, Ct);
        return await client.PostAsJsonAsync(
            "/api/v1/plants",
            new RegisterPlantCommand(
                code, "Another GES", PlantType.RooftopSolar, investors![0].Id, sites![0].Id, 500m, new DateOnly(2023, 1, 1), 0.4m, null, null),
            SolarOpsApiFactory.Json,
            Ct);
    }

    private static string DecodeSegment(string segment)
    {
        var base64 = segment.Replace('-', '+').Replace('_', '/');
        base64 = base64.PadRight(base64.Length + ((4 - (base64.Length % 4)) % 4), '=');
        return Encoding.UTF8.GetString(Convert.FromBase64String(base64));
    }
}
