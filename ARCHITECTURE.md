# Bolig Analyse AI - Architecture Documentation

## Deployment topology (current)

```
┌─────────────────────────────────────────────────────────────────┐
│  Hetzner CPX31 VPS — 178.104.213.102 — Ubuntu 24.04             │
│                                                                 │
│  ┌────────┐    ┌─────────────────────────────────────────────┐  │
│  │  Caddy │ →  │  Supabase stack (upstream v1.26.04 compose) │  │
│  │  :443  │    │  ─ Postgres 15      ─ Auth (GoTrue)         │  │
│  └────────┘    │  ─ PostgREST        ─ Realtime              │  │
│        ↑       │  ─ Storage          ─ Studio                │  │
│        │       │  ─ Kong gateway     ─ Edge Runtime (Deno)   │  │
│   TLS via      │  ─ Vector + Logflare analytics              │  │
│   Let's        └─────────────────────────────────────────────┘  │
│   Encrypt      Edge Runtime mounts                              │
│                /opt/supabase-stack/volumes/functions/           │
│                  └ analyze-apartment/  ← deployed via rsync     │
└─────────────────────────────────────────────────────────────────┘
              ↑ DNS: supabase.dev.boliganalyse.ai (Cloudflare,
              │      DNS-only / not proxied during phase 1)
              │
   Frontend (Vite/React, currently `npm run dev` only)
   ─ Reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY from env
   ─ Hits PostgREST, Realtime, and `functions/v1/analyze-apartment`
     all under the same supabase.dev.boliganalyse.ai hostname
```

Secrets and config live in `/opt/supabase-stack/.env` (mode 600). The
Caddy + edge-runtime layering is provided by composing
`docker-compose.yml` (upstream) + `docker-compose.caddy.yml` (upstream
TLS overlay) + `docker-compose.app.yml` (app-specific env passthrough,
checked into `deploy/`).

## Phase 2 plan: dedicated API server

The edge function is the friction point. Anthropic's agentic tool-calling
loops over many DST queries blow past the edge runtime's 60-second
wall-clock and 200K-token context windows. Phase 2 lifts
`analyze-apartment` out of the edge runtime into a long-running container
on the same box:

```
┌─────────────────────────────────────────────────────────────────┐
│  Hetzner CPX31 VPS                                              │
│                                                                 │
│  ┌────────┐    ┌──────────────────────┐                         │
│  │  Caddy │ →  │  Supabase stack      │  (DB / Auth / Realtime  │
│  │  :443  │    └──────────────────────┘   / Storage / Studio)   │
│  │        │    ┌──────────────────────┐                         │
│  │        │ →  │  api/  Hono on Bun   │  (analyze, scrape, AI)  │
│  └────────┘    │  Long-running, no    │                         │
│                │  wall-clock limits.  │                         │
│                │  Hits Supabase via   │                         │
│                │  service-role key.   │                         │
│                └──────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘

  api.dev.boliganalyse.ai → POST /analyze
  supabase.dev.boliganalyse.ai → REST/Realtime/Storage as before
```

Frontend swaps `supabase.functions.invoke('analyze-apartment', …)` for
`fetch('https://api.dev.boliganalyse.ai/analyze', …)`. Realtime, status,
RLS, and DB layout are unchanged. The `analyze-apartment` source moves
mostly 1:1 from Deno → Bun (a handful of imports and `Deno.env.get`
substitutions).

## Status Management System

The application features a robust status management system that tracks and displays the progress of property analyses.

### Core Components

#### 1. Status Library (`/src/lib/status/`)

- **types.ts**: Core definitions
  - `AnalysisStatus` enum (pending, queued, processing states, terminal states)
  - Status groupings and valid transitions
  - Processing order for workflow progression

- **utils.ts**: Helper functions
  - Status type checking and conversion
  - Progress calculation
  - Transition validation

- **ui.ts**: UI utilities
  - Human-readable messages
  - CSS class generation
  - Error message templates

#### 2. Status Manager

- **Backend** (`/supabase/functions/analyze-apartment/src/services/status-manager.ts`):
  - Handles status transitions
  - Manages status persistence
  - Provides error handling capabilities

#### 3. React Context (`/src/contexts/StatusContext.tsx`)

- Provides status state to components
- Manages subscriptions to real-time updates
- Exposes status-related properties and actions

#### 4. UI Components (`/src/components/status/`)

- `StatusIndicator`: Step indicators
- `StatusProgressBar`: Visual progress representation
- `StatusMessage`: User-friendly status messages
- `StatusStepList`: Workflow visualization
- `StatusError`: Error display with context

### Status Workflow

1. Analysis begins in `PENDING` state
2. Transitions through processing states based on backend progress
3. Terminates in `COMPLETED`, `ERROR`, `TIMEOUT`, `INVALID_URL`, or `CANCELLED`

### Status Transitions

The system enforces valid status transitions through the `isValidTransition` function:

- Same status is always valid
- Each status can only transition to specific next states
- Terminal states cannot transition to other states

### Error Handling

- `StatusError` component displays error messages based on status
- Error metadata is captured (type, message, stack trace)
- User-friendly error messages are provided based on error context

## Frontend Architecture

### Main Components

- `AnalysisPage`: Container component with StatusProvider
- `AnalysisPageContent`: Presentation component using StatusContext
- `AnalysisProgressView`: Status visualization for in-progress analyses
- `AnalysisDetailsView`: Display of completed analysis results

### Data Flow

1. User submits property URL for analysis
2. Backend processes the listing, updating status at each step
3. Frontend subscribes to status changes via StatusContext
4. UI renders appropriate view based on current status
5. Analysis results are displayed when status reaches `COMPLETED`

## Backend Architecture

### Processing Pipeline

1. `ListingProcessorService`: Orchestrates the analysis workflow
2. `StatusManager`: Manages status transitions and validation
3. Analysis steps:
   - Fetch property listing HTML
   - Parse structured data
   - Prepare data for AI analysis
   - Generate AI insights
   - Save analysis results

### Error Handling

- Timeout detection with AbortController
- Structured error information in database
- Error categorization (general, timeout, invalid URL)

## Key Benefits

1. **Maintainability**: Clear separation of concerns
2. **Reliability**: Validated status transitions
3. **Extensibility**: New statuses can be added with minimal changes
4. **User Experience**: Consistent status visualization
5. **Performance**: Optimized real-time updates
6. **Error Handling**: Context-aware error information

## Usage Examples

### Checking Status in Components

```tsx
const MyComponent = () => {
  const { status, isError, isTerminal } = useStatus();
  
  // Conditional rendering based on status
  if (isError) {
    return <ErrorView />;
  }
  
  if (isTerminal) {
    return <CompletedView />;
  }
  
  return <ProgressView status={status} />;
};
```

### Updating Status in Backend

```typescript
// Update status with validation
await statusManager.updateStatus(listingId, AnalysisStatus.ANALYZING);

// Handle errors with context
try {
  // Processing logic
} catch (error) {
  await statusManager.setErrorStatus(listingId, error, AnalysisStatus.ERROR);
}
```