[CmdletBinding()]
param(
    # Skip the HTML report and only print the numbers.
    [switch]$NoReport
)

# Runs the tests with coverage (the 50% line floor is enforced by the test project itself) and writes an HTML
# summary to coverage/report/index.html. Prints the total and the Business/ line coverage.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    dotnet test (Join-Path $root 'StargateAPI.sln')
    $testExit = $LASTEXITCODE

    $cobertura = Join-Path $root 'coverage/coverage.cobertura.xml'
    if (Test-Path $cobertura) {
        [xml]$xml = Get-Content $cobertura
        $lines = @($xml.SelectNodes('//class/lines/line'))
        $business = @($xml.SelectNodes('//class[contains(@filename, "Business")]/lines/line'))
        $pct = { param($set) if ($set.Count -eq 0) { 0 } else { [math]::Round(100 * @($set | Where-Object { [int]$_.hits -gt 0 }).Count / $set.Count, 2) } }
        "Total line coverage:     $(& $pct $lines)%"
        "Business/ line coverage: $(& $pct $business)%"

        if (-not $NoReport) {
            dotnet tool restore | Out-Null
            dotnet reportgenerator "-reports:$cobertura" "-targetdir:$(Join-Path $root 'coverage/report')" '-reporttypes:Html;TextSummary' | Out-Null
            "HTML report: coverage/report/index.html"
        }
    }

    exit $testExit
}
finally {
    Pop-Location
}
