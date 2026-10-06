using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using SolarOps.Application.Abstractions.Behaviors;
using SolarOps.Application.Abstractions.Events;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Features.Production;
using SolarOps.Application.Features.WorkOrders;

namespace SolarOps.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = typeof(DependencyInjection).Assembly;

        services.AddScoped<ISender, Sender>();

        foreach (var type in assembly.GetTypes().Where(t => t is { IsClass: true, IsAbstract: false }))
        {
            foreach (var contract in type.GetInterfaces().Where(i => i.IsGenericType))
            {
                var definition = contract.GetGenericTypeDefinition();
                if (definition == typeof(IRequestHandler<,>))
                {
                    services.AddScoped(contract, type);
                }
                else if (definition == typeof(IIntegrationEventHandler<>))
                {
                    services.AddScoped(type);
                    services.AddSingleton(new EventSubscription(contract.GetGenericArguments()[0], type));
                }
            }
        }

        services.AddSingleton<EventSubscriptionRegistry>();

        // Order matters: telemetry wraps validation so rejected requests are still measured.
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(RequestTelemetryBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);

        services.AddScoped<DailyYieldWriter>();
        services.AddScoped<WorkOrderMutator>();

        return services;
    }
}
