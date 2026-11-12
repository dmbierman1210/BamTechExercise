using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StargateAPI.Business.Migrations
{
    /// <inheritdoc />
    public partial class AddDutyReason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Reason",
                table: "AstronautDuty",
                type: "TEXT",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Reason",
                table: "AstronautDuty");
        }
    }
}
