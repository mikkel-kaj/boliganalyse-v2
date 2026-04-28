from enum import StrEnum


class AnalysisStatus(StrEnum):
    """State machine for the listing analysis pipeline.

    Values must match exactly what the database stores in
    `app.apartment_listings.status` and what the SSE events emit to the
    frontend.
    """

    PENDING = "pending"
    QUEUED = "queued"

    FETCHING_HTML = "fetching_html"
    PARSING_DATA = "parsing_data"
    PREPARING_ANALYSIS = "preparing_analysis"
    ANALYZING = "analyzing"
    GENERATING_INSIGHTS = "generating_insights"
    FINALIZING = "finalizing"

    COMPLETED = "completed"
    ERROR = "error"
    INVALID_URL = "invalid_url"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


TERMINAL_STATUSES: frozenset[AnalysisStatus] = frozenset(
    {
        AnalysisStatus.COMPLETED,
        AnalysisStatus.ERROR,
        AnalysisStatus.INVALID_URL,
        AnalysisStatus.TIMEOUT,
        AnalysisStatus.CANCELLED,
    }
)


def status_from_string(value: str | None) -> AnalysisStatus:
    if not value:
        return AnalysisStatus.PENDING
    try:
        return AnalysisStatus(value)
    except ValueError:
        return AnalysisStatus.ERROR
