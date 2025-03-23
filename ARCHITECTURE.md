# Bolig Analyse AI - Architecture Documentation

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