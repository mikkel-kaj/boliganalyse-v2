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
    model: "gpt-4-turbo-preview", // Default model, can be overridden
    maxTokens: 4000,
    temperature: 0.1, // Low temperature for more consistent results
  },
  
  // Database table names
  database: {
    listingsTable: "apartment_listings",
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
};

/**
 * Validate critical configuration
 * @returns Array of missing configuration values
 */
export function validateConfig(): string[] {
  const missingConfig: string[] = [];
  
  if (!config.supabase.url) missingConfig.push("SUPABASE_URL");
  if (!config.supabase.serviceRoleKey) missingConfig.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!config.openai.apiKey) missingConfig.push("OPENAI_API_KEY");
  
  return missingConfig;
} 