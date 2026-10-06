using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SolarOps.Migrations.OracleDb.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InboxMessages",
                columns: table => new
                {
                    MessageId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    Consumer = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: false),
                    ProcessedOnUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InboxMessages", x => new { x.MessageId, x.Consumer });
                });

            migrationBuilder.CreateTable(
                name: "OutboxMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    TenantId = table.Column<Guid>(type: "RAW(16)", nullable: true),
                    Type = table.Column<string>(type: "NVARCHAR2(256)", maxLength: 256, nullable: false),
                    Payload = table.Column<string>(type: "NCLOB", maxLength: 1000000, nullable: false),
                    TraceParent = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: true),
                    OccurredOnUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    ProcessedOnUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    Attempts = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    LastError = table.Column<string>(type: "NVARCHAR2(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutboxMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tenants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    Name = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: false),
                    Slug = table.Column<string>(type: "NVARCHAR2(64)", maxLength: 64, nullable: false),
                    IsActive = table.Column<bool>(type: "BOOLEAN", nullable: false),
                    PerformanceAlertThreshold = table.Column<decimal>(type: "DECIMAL(5,4)", precision: 5, scale: 4, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Investors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    TenantId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    CompanyName = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: false),
                    ContactPerson = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: true),
                    Email = table.Column<string>(type: "NVARCHAR2(256)", maxLength: 256, nullable: true),
                    Phone = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Investors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Investors_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    TenantId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    Name = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: false),
                    City = table.Column<string>(type: "NVARCHAR2(64)", maxLength: 64, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sites_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    TenantId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    Email = table.Column<string>(type: "NVARCHAR2(256)", maxLength: 256, nullable: false),
                    DisplayName = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: false),
                    PasswordHash = table.Column<string>(type: "NVARCHAR2(512)", maxLength: 512, nullable: false),
                    Role = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: false),
                    IsActive = table.Column<bool>(type: "BOOLEAN", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Plants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    TenantId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    Code = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: false),
                    Type = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: false),
                    InvestorId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    SiteId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    InstalledCapacityKwp = table.Column<decimal>(type: "DECIMAL(12,3)", precision: 12, scale: 3, nullable: false),
                    CommissioningDate = table.Column<DateTime>(type: "DATE", nullable: false),
                    AnnualDegradationRatePercent = table.Column<decimal>(type: "DECIMAL(5,3)", precision: 5, scale: 3, nullable: false),
                    PvModuleModel = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: true),
                    InverterModel = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: true),
                    LastProductionDate = table.Column<DateTime>(type: "DATE", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "BOOLEAN", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Plants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Plants_Investors_InvestorId",
                        column: x => x.InvestorId,
                        principalTable: "Investors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Plants_Sites_SiteId",
                        column: x => x.SiteId,
                        principalTable: "Sites",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Plants_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DailyYields",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    TenantId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    PlantId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    Date = table.Column<DateTime>(type: "DATE", nullable: false),
                    EnergyKwh = table.Column<decimal>(type: "DECIMAL(14,3)", precision: 14, scale: 3, nullable: false),
                    Source = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: false),
                    RecordedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyYields", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DailyYields_Plants_PlantId",
                        column: x => x.PlantId,
                        principalTable: "Plants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductionBaselines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    TenantId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    PlantId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    Year = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    Month = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    ExpectedKwh = table.Column<decimal>(type: "DECIMAL(14,2)", precision: 14, scale: 2, nullable: false),
                    Source = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionBaselines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionBaselines_Plants_PlantId",
                        column: x => x.PlantId,
                        principalTable: "Plants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WorkOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    TenantId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    PlantId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    Title = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "NCLOB", maxLength: 4000, nullable: true),
                    Type = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: false),
                    Priority = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: false),
                    Origin = table.Column<string>(type: "NVARCHAR2(32)", maxLength: 32, nullable: false),
                    CorrelationKey = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "RAW(16)", nullable: true),
                    DueDate = table.Column<DateTime>(type: "DATE", nullable: true),
                    StartedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    CompletedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    Resolution = table.Column<string>(type: "NCLOB", maxLength: 4000, nullable: true),
                    ConcurrencyStamp = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkOrders_Plants_PlantId",
                        column: x => x.PlantId,
                        principalTable: "Plants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WorkActivities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    AuthorUserId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    Description = table.Column<string>(type: "NCLOB", maxLength: 4000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkActivities_Users_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkActivities_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkOrderAssignments",
                columns: table => new
                {
                    WorkOrderId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    UserId = table.Column<Guid>(type: "RAW(16)", nullable: false),
                    AssignedAtUtc = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrderAssignments", x => new { x.WorkOrderId, x.UserId });
                    table.ForeignKey(
                        name: "FK_WorkOrderAssignments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkOrderAssignments_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DailyYields_PlantId",
                table: "DailyYields",
                column: "PlantId");

            migrationBuilder.CreateIndex(
                name: "IX_DailyYields_TenantId_Date",
                table: "DailyYields",
                columns: new[] { "TenantId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_DailyYields_TenantId_PlantId_Date",
                table: "DailyYields",
                columns: new[] { "TenantId", "PlantId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Investors_TenantId_CompanyName",
                table: "Investors",
                columns: new[] { "TenantId", "CompanyName" });

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_ProcessedOnUtc_OccurredOnUtc",
                table: "OutboxMessages",
                columns: new[] { "ProcessedOnUtc", "OccurredOnUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Plants_InvestorId",
                table: "Plants",
                column: "InvestorId");

            migrationBuilder.CreateIndex(
                name: "IX_Plants_SiteId",
                table: "Plants",
                column: "SiteId");

            migrationBuilder.CreateIndex(
                name: "IX_Plants_TenantId_Code",
                table: "Plants",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Plants_TenantId_Status",
                table: "Plants",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBaselines_PlantId",
                table: "ProductionBaselines",
                column: "PlantId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBaselines_TenantId_PlantId_Year_Month",
                table: "ProductionBaselines",
                columns: new[] { "TenantId", "PlantId", "Year", "Month" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sites_TenantId_Name",
                table: "Sites",
                columns: new[] { "TenantId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_Slug",
                table: "Tenants",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_TenantId_Email",
                table: "Users",
                columns: new[] { "TenantId", "Email" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkActivities_AuthorUserId",
                table: "WorkActivities",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkActivities_WorkOrderId_CreatedAtUtc",
                table: "WorkActivities",
                columns: new[] { "WorkOrderId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderAssignments_UserId",
                table: "WorkOrderAssignments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_PlantId",
                table: "WorkOrders",
                column: "PlantId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_TenantId_CorrelationKey",
                table: "WorkOrders",
                columns: new[] { "TenantId", "CorrelationKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_TenantId_PlantId",
                table: "WorkOrders",
                columns: new[] { "TenantId", "PlantId" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_TenantId_Status_CreatedAtUtc",
                table: "WorkOrders",
                columns: new[] { "TenantId", "Status", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyYields");

            migrationBuilder.DropTable(
                name: "InboxMessages");

            migrationBuilder.DropTable(
                name: "OutboxMessages");

            migrationBuilder.DropTable(
                name: "ProductionBaselines");

            migrationBuilder.DropTable(
                name: "WorkActivities");

            migrationBuilder.DropTable(
                name: "WorkOrderAssignments");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "WorkOrders");

            migrationBuilder.DropTable(
                name: "Plants");

            migrationBuilder.DropTable(
                name: "Investors");

            migrationBuilder.DropTable(
                name: "Sites");

            migrationBuilder.DropTable(
                name: "Tenants");
        }
    }
}
