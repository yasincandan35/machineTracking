using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TemperatureHumidityAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddPositionToDevice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Position",
                table: "Devices",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Position",
                table: "Devices");
        }
    }
}
