const baseUrl = process.env.ROUTER_BASE_URL ?? "http://localhost:4100";

const payload = {
  user_query: "Build a regulatory planning workflow for SACCO quarterly provisioning",
  mode: "auto",
  task_type: "planning",
  complexity: "high",
  latency_priority: "medium",
  requirements: {
    needs_json: true,
    needs_tools: false,
    min_context_tokens: 4000,
  },
  providers: [
    { name: "ollama", available: true, latency_ms: 220, error_rate: 0.05, healthy: true },
    { name: "groq", available: true, latency_ms: 130, error_rate: 0.08, healthy: true },
    { name: "openrouter", available: true, latency_ms: 260, error_rate: 0.08, healthy: true },
    { name: "claude", available: false, latency_ms: 280, error_rate: 0.04, healthy: false },
  ],
  models: [
    {
      name: "qwen2.5",
      provider: "ollama",
      available: true,
      context_window: 32000,
      supports_json: true,
      supports_tools: false,
      avg_latency_ms: 240,
      cost_per_1k_tokens: 0.0001,
      quality_score: 0.8,
    },
    {
      name: "llama3-70b",
      provider: "groq",
      available: true,
      context_window: 8000,
      supports_json: true,
      supports_tools: false,
      avg_latency_ms: 150,
      cost_per_1k_tokens: 0.0005,
      quality_score: 0.84,
    },
    {
      name: "deepseek-chat",
      provider: "openrouter",
      available: true,
      context_window: 64000,
      supports_json: true,
      supports_tools: false,
      avg_latency_ms: 330,
      cost_per_1k_tokens: 0.001,
      quality_score: 0.82,
    },
  ],
};

async function main() {
  const response = await fetch(`${baseUrl}/api/router/debug-score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[router:debug] failed:", error.message);
  process.exit(1);
});
