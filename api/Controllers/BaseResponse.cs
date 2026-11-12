using System.Net;
using System.Text.Json.Serialization;

namespace StargateAPI.Controllers
{
    public class BaseResponse
    {
        public bool Success { get; set; } = true;
        public string Message { get; set; } = "Successful";
        public int ResponseCode { get; set; } = (int)HttpStatusCode.OK;

        // One entry per invalid field; left out of the body when there are none.
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public List<FieldError>? Errors { get; set; }
    }

    public class FieldError
    {
        public FieldError(string field, string message)
        {
            Field = field;
            Message = message;
        }

        public string Field { get; set; }

        public string Message { get; set; }
    }
}
