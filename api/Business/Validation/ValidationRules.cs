using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Data;
using StargateAPI.Controllers;

namespace StargateAPI.Business.Validation
{
    public static class PersonNameRules
    {
        public const int MaxLength = 200;

        /// <summary>Trims and validates a name; on failure adds a field error and returns null.</summary>
        public static string? Validate(string? raw, string field, string label, List<FieldError> errors)
        {
            var name = (raw ?? string.Empty).Trim();

            if (name.Length == 0)
            {
                errors.Add(new FieldError(field, $"The {label} is required."));
                return null;
            }

            if (name.Length > MaxLength)
            {
                errors.Add(new FieldError(field, $"The {label} must be at most {MaxLength} characters."));
                return null;
            }

            if (name.Any(char.IsControl))
            {
                errors.Add(new FieldError(field, $"The {label} must not contain control characters."));
                return null;
            }

            return name;
        }

        /// <summary>
        /// True when another person already has this name, ignoring case. The NOCASE column handles ASCII;
        /// names with other characters are compared in memory because SQLite does not fold them.
        /// </summary>
        public static async Task<bool> IsTakenAsync(StargateContext context, string name, int? exceptPersonId, CancellationToken cancellationToken)
        {
            if (name.All(char.IsAscii))
            {
                return await context.People.AnyAsync(p => p.Name == name && p.Id != exceptPersonId, cancellationToken);
            }

            var others = await context.People
                .AsNoTracking()
                .Where(p => p.Id != exceptPersonId)
                .Select(p => p.Name)
                .ToListAsync(cancellationToken);

            return others.Any(other => string.Equals(other, name, StringComparison.OrdinalIgnoreCase));
        }
    }

    public static class DbErrors
    {
        private const int SqliteConstraint = 19;

        public static bool IsUniqueViolation(DbUpdateException exception, string column) =>
            exception.InnerException is SqliteException { SqliteErrorCode: SqliteConstraint } sqlite
            && sqlite.Message.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase)
            && sqlite.Message.Contains(column, StringComparison.OrdinalIgnoreCase);
    }
}
