using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StargateAPI.Business.Migrations
{
    /// <inheritdoc />
    public partial class AddDutyConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AstronautDuty_PersonId",
                table: "AstronautDuty");

            migrationBuilder.CreateIndex(
                name: "IX_AstronautDuty_PersonId_DutyStartDate",
                table: "AstronautDuty",
                columns: new[] { "PersonId", "DutyStartDate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AstronautDuty_PersonId_DutyStartDate",
                table: "AstronautDuty");

            migrationBuilder.CreateIndex(
                name: "IX_AstronautDuty_PersonId",
                table: "AstronautDuty",
                column: "PersonId");
        }
    }
}
