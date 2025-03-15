import { config } from "../config/config.ts";

/**
 * CORS headers for cross-origin requests
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": config.cors.allowOrigin,
  "Access-Control-Allow-Headers": config.cors.allowHeaders,
};

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(data: any, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    { 
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json" 
      }, 
      status 
    }
  );
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  message: string, 
  details?: any, 
  status = 400, 
  code?: string
): Response {
  const errorBody: Record<string, any> = { 
    error: message
  };
  
  if (details) {
    errorBody.details = details;
  }
  
  if (code) {
    errorBody.code = code;
  }
  
  return new Response(
    JSON.stringify(errorBody),
    { 
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json" 
      }, 
      status 
    }
  );
}

/**
 * Creates a standardized CORS preflight response
 */
export function createCorsPreflightResponse(): Response {
  return new Response(null, { headers: corsHeaders });
} 