# Router Debug Guide

Use this to test deterministic routing decisions from the terminal.

## Base URL

- Local backend: `http://localhost:4100`

## 1) Health Check

```powershell
Invoke-RestMethod -Uri http://localhost:4100/api/router/health | ConvertTo-Json -Depth 8
```

## 2) Debug Scoring (Auto Mode)

```powershell
$payload = @'
{
  "user_query": "Build a regulatory planning workflow for SACCO quarterly provisioning",
  "mode": "auto",
  "task_type": "planning",
  "complexity": "high",
  "latency_priority": "medium",
  "requirements": {
    "needs_json": true,
    "needs_tools": false,
    "min_context_tokens": 4000
  },
  "providers": [
    { "name": "ollama", "available": true, "latency_ms": 220, "error_rate": 0.05, "healthy": true },
    { "name": "groq", "available": true, "latency_ms": 130, "error_rate": 0.08, "healthy": true },
    { "name": "openrouter", "available": true, "latency_ms": 260, "error_rate": 0.08, "healthy": true },
    { "name": "claude", "available": false, "latency_ms": 280, "error_rate": 0.04, "healthy": false }
  ],
  "models": [
    {
      "name": "qwen2.5",
      "provider": "ollama",
      "available": true,
      "context_window": 32000,
      "supports_json": true,
      "supports_tools": false,
      "avg_latency_ms": 240,
      "cost_per_1k_tokens": 0.0001,
      "quality_score": 0.8
    },
    {
      "name": "llama3-70b",
      "provider": "groq",
      "available": true,
      "context_window": 8000,
      "supports_json": true,
      "supports_tools": false,
      "avg_latency_ms": 150,
      "cost_per_1k_tokens": 0.0005,
      "quality_score": 0.84
    },
    {
      "name": "deepseek-chat",
      "provider": "openrouter",
      "available": true,
      "context_window": 64000,
      "supports_json": true,
      "supports_tools": false,
      "avg_latency_ms": 330,
      "cost_per_1k_tokens": 0.001,
      "quality_score": 0.82
    }
  ]
}
'@

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:4100/api/router/debug-score `
  -ContentType "application/json" `
  -Body $payload | ConvertTo-Json -Depth 10
```

## 3) Free Mode Check (Claude blocked)

Set `"mode": "free"` and include Claude in `models`.
Expected: diagnostics should show Claude entries rejected with `mode_free_disallows_claude`.

## 4) Paid Mode Check (Claude preferred)

Set:
- provider `claude` to `available: true` and `healthy: true`
- include a Claude model in `models`
- `"mode": "paid"`

Expected: Claude should rank at/near top unless hard constraints fail.

## 5) Route-Only Selection Endpoint

If you only want final selection (without diagnostics/rank table):

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:4100/api/router/select `
  -ContentType "application/json" `
  -Body $payload | ConvertTo-Json -Depth 8
```
