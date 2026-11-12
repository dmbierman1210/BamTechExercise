using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StargateAPI.Business.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditEntry",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    EntityType = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    EntityId = table.Column<int>(type: "INTEGER", nullable: false),
                    Action = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Actor = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Reason = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    TimestampUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    BeforeJson = table.Column<string>(type: "TEXT", nullable: true),
                    AfterJson = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditEntry", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditEntry_EntityType_EntityId",
                table: "AuditEntry",
                columns: new[] { "EntityType", "EntityId" });

            // Append-only: the database itself refuses to change or remove an entry.
            migrationBuilder.Sql(@"CREATE TRIGGER AuditEntry_no_update BEFORE UPDATE ON AuditEntry
BEGIN SELECT RAISE(ABORT, 'AuditEntry is append-only: updates are not allowed.'); END;");
            migrationBuilder.Sql(@"CREATE TRIGGER AuditEntry_no_delete BEFORE DELETE ON AuditEntry
BEGIN SELECT RAISE(ABORT, 'AuditEntry is append-only: deletes are not allowed.'); END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS AuditEntry_no_update;");
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS AuditEntry_no_delete;");
            migrationBuilder.DropTable(
                name: "AuditEntry");
        }
    }
}
