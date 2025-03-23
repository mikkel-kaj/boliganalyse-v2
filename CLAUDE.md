# Project Guide for Claude

## Build and Development Commands
- `npm run dev`: Start frontend development server
- `npm run build`: Build for production
- `npm run build:dev`: Build for development
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint on codebase
- `npm run functions`: Serve Supabase functions locally

## Testing
- Deno: `deno test --allow-net --allow-env src/tests/`
- Single test: `deno test --allow-net --allow-env src/tests/url-utils.test.ts`

## Code Style Guidelines
- **TypeScript**: Strict typing preferred but project has `strictNullChecks: false`
- **Imports**: Use absolute imports with `@/` prefix for src directory
- **Components**: React functional components with TypeScript types
- **Error Handling**: Use try/catch with specific error types, log in catch blocks
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Architecture**: Frontend (React/Vite) + Backend (Supabase Edge Functions/Deno)

## API Patterns
- Supabase for database and serverless functions
- Edge functions for data processing and AI analysis
- React Query for data fetching and state management