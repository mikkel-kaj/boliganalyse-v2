/**
 * Configuration module for analyze-apartment function
 * Centralizes access to environment variables and configuration values
 */

// Add Deno types reference
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export const config = {
  // Supabase configuration
  supabase: {
    url: Deno.env.get("SUPABASE_URL") || "",
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    anonKey: Deno.env.get("SUPABASE_ANON_KEY") || "",
  },
  
  // OpenAI configuration
  openai: {
    apiKey: Deno.env.get("OPENAI_API_KEY") || "",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-2024-11-20", // Default model, can be overridden
    maxTokens: 4000,
    temperature: 1.2, // Low temperature for more consistent results
  },
  
  // Firecrawl configuration
  firecrawl: {
    apiKey: Deno.env.get("FIRECRAWL_API_KEY") || "",
  },

  // Claude configuration
  claude: {
    apiKey: Deno.env.get("ANTHROPIC_API_KEY") || "",
    endpoint: "https://api.anthropic.com/v1/messages",
    model: "claude-opus-4-7", // Default model, can be overridden
    maxTokens: 8000,
    temperature: 0.5, // Low temperature for more consistent results
    apiVersion: "2023-06-01",
  },

  // Database table names
  database: {
    listingsTable: "apartment_listings",
    schema: "private",
  },
  
  // CORS settings
  cors: {
    allowOrigin: "*",
    allowHeaders: "authorization, x-client-info, apikey, content-type",
  },
  
  // HTTP settings
  http: {
    timeout: 30000, // 30 seconds default timeout for HTTP requests
    retryAttempts: 3,
  },
  
  // Logging settings
  logging: {
    enabled: true,
    level: Deno.env.get("LOG_LEVEL") || "info",
  },

  // Feature flags
  features: {
    // DST tool-calling is the slow part of the analysis pipeline.
    // Set ENABLE_DST_TOOLS=true to opt back in.
    enableDstTools: Deno.env.get("ENABLE_DST_TOOLS") === "true",
  },
};

/**
 * Validate critical configuration
 * @returns Array of missing configuration values
 */
export function validateConfig(): string[] {
  const missingConfig: string[] = [];
  
  if (!config.supabase.url) missingConfig.push("SUPABASE_URL");
  if (!config.supabase.serviceRoleKey) missingConfig.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!config.claude.apiKey) missingConfig.push("ANTHROPIC_API_KEY");
  if (!config.firecrawl.apiKey) missingConfig.push("FIRECRAWL_API_KEY");

  return missingConfig;
} 