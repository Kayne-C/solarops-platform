# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f src/SolarOps.Worker/Dockerfile .

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore in its own layer: it only re-runs when a project file or package version changes.
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/SolarOps.Domain/SolarOps.Domain.csproj src/SolarOps.Domain/
COPY src/SolarOps.Application/SolarOps.Application.csproj src/SolarOps.Application/
COPY src/SolarOps.Infrastructure/SolarOps.Infrastructure.csproj src/SolarOps.Infrastructure/
COPY src/SolarOps.Migrations.SqlServer/SolarOps.Migrations.SqlServer.csproj src/SolarOps.Migrations.SqlServer/
COPY src/SolarOps.Migrations.Oracle/SolarOps.Migrations.Oracle.csproj src/SolarOps.Migrations.Oracle/
COPY src/SolarOps.Worker/SolarOps.Worker.csproj src/SolarOps.Worker/
RUN dotnet restore src/SolarOps.Worker/SolarOps.Worker.csproj

COPY src/ src/
RUN dotnet publish src/SolarOps.Worker/SolarOps.Worker.csproj -c Release -o /app --no-restore /p:UseAppHost=false

# Chiseled "extra": distroless Ubuntu (no shell, non-root) plus ICU + tzdata — SqlClient and
# tr-TR culture handling do not work in globalization-invariant mode.
FROM mcr.microsoft.com/dotnet/runtime:10.0-noble-chiseled-extra AS runtime
WORKDIR /app
COPY --from=build /app .

ENTRYPOINT ["dotnet", "SolarOps.Worker.dll"]
