# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f src/SolarOps.Api/Dockerfile .

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore in its own layer: it only re-runs when a project file or package version changes.
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/SolarOps.Domain/SolarOps.Domain.csproj src/SolarOps.Domain/
COPY src/SolarOps.Application/SolarOps.Application.csproj src/SolarOps.Application/
COPY src/SolarOps.Infrastructure/SolarOps.Infrastructure.csproj src/SolarOps.Infrastructure/
COPY src/SolarOps.Migrations.SqlServer/SolarOps.Migrations.SqlServer.csproj src/SolarOps.Migrations.SqlServer/
COPY src/SolarOps.Migrations.Oracle/SolarOps.Migrations.Oracle.csproj src/SolarOps.Migrations.Oracle/
COPY src/SolarOps.Api/SolarOps.Api.csproj src/SolarOps.Api/
RUN dotnet restore src/SolarOps.Api/SolarOps.Api.csproj

COPY src/ src/
RUN dotnet publish src/SolarOps.Api/SolarOps.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

# Chiseled "extra": distroless Ubuntu (no shell, non-root) plus ICU + tzdata — SqlClient and
# tr-TR culture handling do not work in globalization-invariant mode.
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080 8081
ENTRYPOINT ["dotnet", "SolarOps.Api.dll"]
