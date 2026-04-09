param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("check", "test", "dev", "token", "token-dev", "docker-up", "docker-down")]
  [string]$Task,

  [string]$Role = "analyst",
  [string]$Sub = "dev-user",
  [string]$Expiry = "1d",
  [string]$Prefix = "dev"
)

switch ($Task) {
  "check" { pnpm check; break }
  "test" { pnpm test; break }
  "dev" { pnpm dev; break }
  "token" { pnpm token:generate -- --role $Role --sub $Sub; break }
  "token-dev" { pnpm token:generate:dev -- $Expiry $Prefix; break }
  "docker-up" { docker compose up --build; break }
  "docker-down" { docker compose down; break }
  default { Write-Error "Unknown task: $Task" }
}
