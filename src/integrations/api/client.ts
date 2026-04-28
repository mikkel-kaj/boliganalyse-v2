// Thin client for the FastAPI listing service. Replaces the previous
// `@supabase/supabase-js` integration — the frontend no longer talks to
// Supabase directly; everything routes through the API server, which
// holds the service-role key and decides what to expose.

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error('VITE_API_URL must be set. See .env.example.');
}

export interface AnalysisProperty {
  address?: string;
  price?: string;
  udbetaling?: string;
  pricePerM2?: string;
  size?: string;
  værelser?: string;
  floor?: string;
  boligType?: string;
  ejerform?: string;
  energiMaerke?: string;
  byggeaar?: string;
  renoveringsaar?: string;
  maanedligeUdgift?: string;
}

export interface AnalysisRisk {
  category: string;
  title: string;
  details: string;
  excerpt?: string;
  recommendations?: { promptTitle: string; prompt: string }[];
}

export interface AnalysisHighlight {
  icon: string;
  title: string;
  details: string;
}

export interface Analysis {
  summary?: string;
  property?: AnalysisProperty;
  risks?: AnalysisRisk[];
  highlights?: AnalysisHighlight[];
  [key: string]: unknown;
}

export interface Listing {
  id: string;
  url: string;
  status: string;
  realtor: string | null;
  property_image_url: string | null;
  analysis: Analysis | null;
  created_at: string;
  updated_at: string;
}

export interface StartAnalysisResponse {
  listing: Listing;
  is_existing: boolean;
}

export interface FeedbackPayload {
  feedback_type: 'idea' | 'problem' | 'other' | string;
  message: string;
  email?: string | null;
  listing_id?: string | null;
  property_address?: string | null;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body = await response.json();
      detail = body?.detail ?? body?.error;
    } catch {
      detail = undefined;
    }
    throw new ApiError(detail ?? response.statusText, response.status);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  startAnalysis(payload: { url: string; force?: boolean }): Promise<StartAnalysisResponse> {
    return request<StartAnalysisResponse>('/listings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getListing(id: string): Promise<Listing> {
    return request<Listing>(`/listings/${encodeURIComponent(id)}`);
  },

  listRecent(limit = 20): Promise<Listing[]> {
    return request<Listing[]>(`/listings?limit=${limit}`);
  },

  submitFeedback(payload: FeedbackPayload): Promise<{ id: string; created_at: string }> {
    return request('/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Open an SSE stream for a listing's status updates. The stream emits
   * `status` events on every DB-observed status change, plus a final
   * `complete` or `error` event when the analysis reaches a terminal
   * state. The returned `close` function tears down the EventSource —
   * call it from the consumer's cleanup hook.
   */
  streamListingEvents(
    id: string,
    handlers: {
      onStatus?: (listing: Listing) => void;
      onComplete?: (listing: Listing) => void;
      onError?: (listing: Listing | null, message?: string) => void;
    },
  ): () => void {
    const url = `${API_URL}/listings/${encodeURIComponent(id)}/events`;
    const source = new EventSource(url);

    const parse = (event: MessageEvent): Listing | null => {
      try {
        return JSON.parse(event.data) as Listing;
      } catch {
        return null;
      }
    };

    source.addEventListener('status', (e) => {
      const listing = parse(e as MessageEvent);
      if (listing && handlers.onStatus) handlers.onStatus(listing);
    });

    source.addEventListener('complete', (e) => {
      const listing = parse(e as MessageEvent);
      if (listing && handlers.onComplete) handlers.onComplete(listing);
      source.close();
    });

    source.addEventListener('error', (e) => {
      const listing = parse(e as MessageEvent);
      if (handlers.onError) handlers.onError(listing);
    });

    return () => source.close();
  },
};
