using System.Data;
using System.Globalization;
using Dapper;

namespace StargateAPI.Business.Data
{
    // Temporary: Dapper cannot read the TEXT dates SQLite stores for DateOnly. Removed with Dapper in STAR-4.
    public class DapperDateOnlyHandler : SqlMapper.TypeHandler<DateOnly>
    {
        public override DateOnly Parse(object value) =>
            DateOnly.ParseExact((string)value, "yyyy-MM-dd", CultureInfo.InvariantCulture);

        public override void SetValue(IDbDataParameter parameter, DateOnly value)
        {
            parameter.DbType = DbType.String;
            parameter.Value = value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
    }
}
