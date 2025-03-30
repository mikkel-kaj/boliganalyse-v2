# Analyze Apartment Edge Function

This Supabase Edge Function analyzes real estate listings from various Danish property websites. It extracts structured data from the HTML content and uses AI to analyze the property details.

## Features

- Extracts structured data from real estate listings
- Supports multiple providers (Boligsiden.dk, Home.dk, Nybolig.dk)
- Uses OpenAI for advanced analysis
- Extensible architecture for adding new providers
- Background processing for better user experience
- Advanced web scraping with Firecrawl integration

## Architecture

The project follows SOLID principles and clean code practices:

- **Providers**: Each real estate website has its own provider implementation
- **Repository Pattern**: Database operations are abstracted
- **Service Layer**: Business logic is separated from data access
- **Dependency Injection**: Services are loosely coupled
- **Utility Modules**: Common functionality is extracted into reusable utilities

## Directory Structure

```
analyze-apartment/
├── src/
│   ├── config/         # Configuration settings
│   ├── models/         # Data models
│   ├── parsers/        # HTML parsing utilities
│   ├── providers/      # Website-specific providers
│   ├── repositories/   # Data access layer
│   ├── services/       # Business logic
│   ├── tests/          # Unit tests
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── index.ts        # Main entry point
├── deno.json           # Deno configuration
└── README.md           # This file
```

## Testing

Tests are written using Deno's built-in testing framework. To run the tests:

```bash
deno test --allow-net src/tests/
```

## Adding a New Provider

To add support for a new real estate website:

1. Create a new provider class in `src/providers/` that extends `BaseProvider`
2. Implement the required methods for the specific website
3. Register the provider in `ProviderRegistry`

Example:

```typescript
// src/providers/new-provider.ts
import { BaseProvider } from "./base-provider.ts";
import { HTMLParseResult } from "../types/index.ts";
import { extractDomain } from "../utils/url.ts";

export class NewProvider extends BaseProvider {
  get name(): string {
    return "New Provider";
  }
  
  canHandle(url: string): boolean {
    return extractDomain(url) === "newprovider.dk";
  }
  
  // Implement other required methods...
}

// Then register in provider-registry.ts
this.registerProvider(new NewProvider());
```

## Environment Variables

The function requires the following environment variables:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access
- `OPENAI_API_KEY`: OpenAI API key for analysis
- `LOG_LEVEL`: (Optional) Logging level (error, warn, info, debug)

## Deployment

Deploy to Supabase Edge Functions:

```bash
supabase functions deploy analyze-apartment --project-ref your-project-ref
```

## API Usage

Send a POST request to the function with a URL to analyze:

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/analyze-apartment \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.boligsiden.dk/adresse/example"}'
```

Response:

```json
{
  "message": "Analysis started",
  "listing": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "url": "https://www.boligsiden.dk/adresse/example",
    "normalized_url": "https://boligsiden.dk/adresse/example",
    "status": "Starter analyse",
    "created_at": "2023-01-01T12:00:00.000Z"
  },
  "isExisting": false
}
```

## Next Steps

To complete the implementation for more explicit parsing and additional sources:

1. **Implement Additional Providers**
   - Create providers for Home.dk, Nybolig.dk, etc. in the `src/providers/` directory
   - Each provider should implement specific extraction logic for its website structure

2. **Enhance Extraction Logic**
   - Improve the HTML parsing in each provider to extract more structured data
   - Add more specialized extraction for specific fields like prices, square meters, etc.

3. **Optimize AI Analyzer**
   - Fine-tune the prompts based on the extracted structured data
   - Consider using a staged approach with multiple AI calls for complex listings

4. **Add Data Validation**
   - Add validation for extracted data to ensure consistency
   - Implement sanitization for common formatting issues

5. **Error Handling Improvements**
   - Add better recovery strategies for failed requests
   - Implement retry logic for transient errors

6. **Performance Optimizations**
   - Cache common HTML extraction patterns
   - Consider parallelizing some operations where appropriate

7. **Monitoring & Logging**
   - Add telemetry for production monitoring
   - Enhance logging for better debugging in production

To implement these changes, follow the existing architecture patterns and add new components as needed, while maintaining the separation of concerns established in the codebase. 