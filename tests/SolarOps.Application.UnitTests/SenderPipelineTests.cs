using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using SolarOps.Application.Abstractions.Behaviors;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Domain.Common;

namespace SolarOps.Application.UnitTests;

public sealed class SenderPipelineTests
{
    public sealed record Ping(string Message) : ICommand<string>;

    internal sealed class PingHandler(List<string> trace) : ICommandHandler<Ping, string>
    {
        public Task<Result<string>> Handle(Ping request, CancellationToken cancellationToken)
        {
            trace.Add("handler");
            return Task.FromResult<Result<string>>($"pong:{request.Message}");
        }
    }

    internal sealed class PingValidator : AbstractValidator<Ping>
    {
        public PingValidator() => RuleFor(p => p.Message).NotEmpty().MaximumLength(5);
    }

    internal sealed class TracingBehavior<TRequest, TResponse>(List<string> trace, string name) : IPipelineBehavior<TRequest, TResponse>
        where TRequest : IRequest<TResponse>
    {
        public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
        {
            trace.Add($"{name}:before");
            var response = await next();
            trace.Add($"{name}:after");
            return response;
        }
    }

    private static (ISender Sender, List<string> Trace) Build(bool withValidation)
    {
        var trace = new List<string>();
        var services = new ServiceCollection();
        services.AddSingleton(trace);
        services.AddScoped<ISender, Sender>();
        services.AddScoped<IRequestHandler<Ping, Result<string>>, PingHandler>();
        services.AddScoped<IPipelineBehavior<Ping, Result<string>>>(_ => new TracingBehavior<Ping, Result<string>>(trace, "outer"));
        services.AddScoped<IPipelineBehavior<Ping, Result<string>>>(_ => new TracingBehavior<Ping, Result<string>>(trace, "inner"));
        if (withValidation)
        {
            services.AddScoped<IValidator<Ping>, PingValidator>();
            services.AddScoped<IPipelineBehavior<Ping, Result<string>>, ValidationBehavior<Ping, Result<string>>>();
        }

        var provider = services.BuildServiceProvider().CreateScope().ServiceProvider;
        return (provider.GetRequiredService<ISender>(), trace);
    }

    [Fact]
    public async Task Behaviors_wrap_the_handler_in_registration_order()
    {
        var (sender, trace) = Build(withValidation: false);

        var result = await sender.Send(new Ping("hi"), TestContext.Current.CancellationToken);

        Assert.Equal("pong:hi", result.Value);
        Assert.Equal(["outer:before", "inner:before", "handler", "inner:after", "outer:after"], trace);
    }

    [Fact]
    public async Task Validation_short_circuits_with_a_typed_failure()
    {
        var (sender, trace) = Build(withValidation: true);

        var result = await sender.Send(new Ping("far too long"), TestContext.Current.CancellationToken);

        var error = Assert.IsType<ValidationError>(result.Error);
        Assert.Contains("Message", error.Errors.Keys);
        Assert.DoesNotContain("handler", trace);
    }

    [Fact]
    public void Application_registration_discovers_every_handler_and_event_subscription()
    {
        var services = new ServiceCollection().AddApplication();

        var handlerContracts = services
            .Where(d => d.ServiceType.IsGenericType && d.ServiceType.GetGenericTypeDefinition() == typeof(IRequestHandler<,>))
            .ToList();

        Assert.True(handlerContracts.Count >= 25, $"Only {handlerContracts.Count} handlers were registered.");
        Assert.Equal(2, services.Count(d => d.ServiceType == typeof(Abstractions.Events.EventSubscription)));
    }
}
