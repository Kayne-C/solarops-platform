using System.Reflection;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Domain.Common;

namespace SolarOps.ArchitectureTests;

/// <summary>Clean Architecture dependency rule, enforced in CI rather than by convention.</summary>
public sealed class LayeringTests
{
    private static readonly Assembly Domain = typeof(Entity).Assembly;
    private static readonly Assembly Application = typeof(ISender).Assembly;
    private static readonly Assembly Infrastructure = typeof(Infrastructure.DependencyInjection).Assembly;
    private static readonly Assembly Api = typeof(Api.Security.Policies).Assembly;

    private static IEnumerable<string> References(Assembly assembly) =>
        assembly.GetReferencedAssemblies().Select(a => a.Name!);

    [Fact]
    public void Domain_depends_on_nothing_but_the_base_class_library()
    {
        var forbidden = References(Domain).Where(name =>
            name.StartsWith("SolarOps.", StringComparison.Ordinal) ||
            name.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ||
            name.StartsWith("Microsoft.AspNetCore", StringComparison.Ordinal));

        Assert.Empty(forbidden);
    }

    [Fact]
    public void Application_does_not_know_about_infrastructure_or_delivery_mechanisms()
    {
        string[] forbiddenPrefixes =
        [
            "SolarOps.Infrastructure", "SolarOps.Api", "SolarOps.Worker", "Microsoft.AspNetCore",
            "Microsoft.EntityFrameworkCore.SqlServer", "Oracle.", "Microsoft.EntityFrameworkCore.Sqlite",
            "RabbitMQ", "StackExchange.Redis", "ClosedXML",
        ];

        var forbidden = References(Application).Where(name => forbiddenPrefixes.Any(p => name.StartsWith(p, StringComparison.Ordinal)));

        Assert.Empty(forbidden);
    }

    [Fact]
    public void Infrastructure_does_not_depend_on_the_delivery_layer()
    {
        Assert.DoesNotContain(References(Infrastructure), name => name is "SolarOps.Api" or "SolarOps.Worker");
    }

    [Fact]
    public void Api_reaches_use_cases_only_through_the_sender()
    {
        var handlerContract = typeof(IRequestHandler<,>);
        var apiTypesUsingHandlers = Api.GetTypes()
            .SelectMany(t => t.GetConstructors().SelectMany(c => c.GetParameters()), (t, p) => (Type: t, p.ParameterType))
            .Where(x => x.ParameterType.IsGenericType && x.ParameterType.GetGenericTypeDefinition() == handlerContract)
            .Select(x => x.Type.Name);

        Assert.Empty(apiTypesUsingHandlers);
    }
}

public sealed class DesignRuleTests
{
    private static readonly Type[] DomainTypes = typeof(Entity).Assembly.GetTypes();
    private static readonly Type[] ApplicationTypes = typeof(ISender).Assembly.GetTypes();

    [Fact]
    public void Entities_expose_no_public_setters()
    {
        var offenders = DomainTypes
            .Where(t => typeof(Entity).IsAssignableFrom(t) && !t.IsAbstract)
            .SelectMany(t => t.GetProperties(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly))
            .Where(p => p.SetMethod?.IsPublic == true)
            .Select(p => $"{p.DeclaringType!.Name}.{p.Name}");

        Assert.Empty(offenders);
    }

    [Fact]
    public void Domain_events_are_sealed_records_with_a_consistent_suffix()
    {
        var events = DomainTypes.Where(t => typeof(IDomainEvent).IsAssignableFrom(t) && !t.IsAbstract && !t.IsInterface).ToList();

        Assert.NotEmpty(events);
        Assert.All(events, e =>
        {
            Assert.True(e.IsSealed, $"{e.Name} must be sealed.");
            Assert.EndsWith("DomainEvent", e.Name, StringComparison.Ordinal);
        });
    }

    [Fact]
    public void Request_handlers_are_internal_and_sealed()
    {
        var handlers = ApplicationTypes
            .Where(t => !t.IsAbstract && t.GetInterfaces().Any(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IRequestHandler<,>)))
            .ToList();

        Assert.NotEmpty(handlers);
        Assert.All(handlers, h => Assert.True(h.IsSealed && !h.IsPublic, $"{h.Name} must be internal sealed."));
    }

    [Fact]
    public void Every_request_has_exactly_one_handler()
    {
        var requests = ApplicationTypes
            .Where(t => !t.IsAbstract && !t.IsInterface && t.GetInterfaces().Any(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IRequest<>)))
            .ToList();

        var handled = ApplicationTypes
            .SelectMany(t => t.GetInterfaces())
            .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IRequestHandler<,>))
            .Select(i => i.GetGenericArguments()[0])
            .ToList();

        Assert.All(requests, r => Assert.Equal(1, handled.Count(h => h == r)));
    }
}
