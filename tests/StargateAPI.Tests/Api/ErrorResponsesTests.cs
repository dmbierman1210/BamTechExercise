using System.Net;
using StargateAPI.Business.Exceptions;
using StargateAPI.Controllers;

namespace StargateAPI.Tests.Api;

/// <summary>The mapping from an exception or a bare status code to the contract envelope.</summary>
public class ErrorResponsesTests
{
    private sealed class UnmappedDomainException : DomainException
    {
        public UnmappedDomainException() : base("unmapped")
        {
        }
    }

    [Fact]
    public void A_domain_exception_without_a_status_mapping_is_a_programming_error()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => ErrorResponses.From(new UnmappedDomainException()));
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound, "Not found.")]
    [InlineData(HttpStatusCode.MethodNotAllowed, "Method not allowed.")]
    [InlineData(HttpStatusCode.BadRequest, "The request is not valid.")]
    [InlineData(HttpStatusCode.Forbidden, "The request could not be processed.")]
    public void A_bare_status_code_gets_the_envelope_with_a_matching_message(HttpStatusCode status, string message)
    {
        var body = ErrorResponses.ForStatus((int)status);

        Assert.False(body.Success);
        Assert.Equal((int)status, body.ResponseCode);
        Assert.Equal(message, body.Message);
    }

    [Fact]
    public void A_malformed_request_lists_its_field_errors_or_names_the_body()
    {
        var withFields = ErrorResponses.Malformed(new[] { new FieldError("name", "bad") }, bodyProblem: false);
        var bodyOnly = ErrorResponses.Malformed(Array.Empty<FieldError>(), bodyProblem: true);

        Assert.Equal("Validation failed.", withFields.Message);
        Assert.Single(withFields.Errors!);
        Assert.Equal("The request body is missing or is not valid.", bodyOnly.Message);
        Assert.Null(bodyOnly.Errors);
    }
}
