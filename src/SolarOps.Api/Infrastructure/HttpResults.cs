using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using SolarOps.Domain.Common;
using SolarOps.Infrastructure.Tenancy;

namespace SolarOps.Api.Infrastructure;

/// <summary>Maps domain/application errors to RFC 9457 problem details. One table, used by every endpoint.</summary>
internal static class HttpResults
{
    public static IResult ToHttp<T>(this Result<T> result, Func<T, IResult> onSuccess) =>
        result.IsSuccess ? onSuccess(result.Value) : result.Error.ToProblem();

    public static IResult ToProblem(this Error error)
    {
        if (error is ValidationError validation)
        {
            return TypedResults.ValidationProblem(
                validation.Errors.ToDictionary(kv => kv.Key, kv => kv.Value),
                title: error.Description,
                extensions: new Dictionary<string, object?> { ["code"] = error.Code });
        }

        var status = error.Type switch
        {
            ErrorType.Validation => StatusCodes.Status400BadRequest,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.PreconditionFailed => StatusCodes.Status412PreconditionFailed,
            _ => StatusCodes.Status422UnprocessableEntity,
        };

        return TypedResults.Problem(
            statusCode: status,
            title: error.Code,
            detail: error.Description,
            extensions: new Dictionary<string, object?> { ["code"] = error.Code });
    }

    /// <summary>Strong ETag of the aggregate's concurrency stamp.</summary>
    public static string ToETag(Guid concurrencyStamp) => $"\"{concurrencyStamp:N}\"";

    public static void SetETag(this HttpContext context, Guid concurrencyStamp) =>
        context.Response.Headers[HeaderNames.ETag] = ToETag(concurrencyStamp);

    /// <summary>Reads <c>If-Match</c>. Mutations of shared work orders require it (RFC 6585: 428 Precondition Required).</summary>
    public static bool TryGetIfMatch(this HttpRequest request, out Guid stamp, out IResult? problem)
    {
        var raw = request.Headers.IfMatch.ToString().Trim();
        if (raw.StartsWith("W/", StringComparison.Ordinal))
        {
            raw = raw[2..];
        }

        if (Guid.TryParse(raw.Trim('"'), out stamp))
        {
            problem = null;
            return true;
        }

        problem = TypedResults.Problem(
            statusCode: StatusCodes.Status428PreconditionRequired,
            title: "ETag.Required",
            detail: "Send the work order's current ETag in the If-Match header to modify it.");
        return false;
    }
}

internal sealed partial class GlobalExceptionHandler(IProblemDetailsService problemDetails, ILogger<GlobalExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            BadHttpRequestException bad => (bad.StatusCode, "Request.Invalid"),
            CrossTenantWriteException => (StatusCodes.Status403Forbidden, "Tenant.CrossTenantWrite"),
            _ => (StatusCodes.Status500InternalServerError, "Server.Error"),
        };

        if (status >= StatusCodes.Status500InternalServerError || exception is CrossTenantWriteException)
        {
            LogUnhandled(logger, exception, httpContext.Request.Method, httpContext.Request.Path);
        }

        httpContext.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = title,
                Detail = status >= StatusCodes.Status500InternalServerError ? "An unexpected error occurred." : exception.Message,
            },
        });
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled exception for {Method} {Path}")]
    private static partial void LogUnhandled(ILogger logger, Exception exception, string method, string path);
}
