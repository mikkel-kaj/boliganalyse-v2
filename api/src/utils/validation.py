from urllib.parse import urlparse

from src.types.models import ValidationResult
from src.utils.url import extract_domain

SUPPORTED_DOMAINS: frozenset[str] = frozenset(
    {
        "boligsiden.dk",
        "home.dk",
        "nybolig.dk",
        "edc.dk",
        "danbolig.dk",
        "estate.dk",
        "realmaeglerne.dk",
        "lejebolig.dk",
        "boligportal.dk",
        "lokalbolig.dk",
        "boligone.dk",
        "1848.dk",
        "dinmaegler.dk",
        "lilholts.dk",
        "coldwellbanker.dk",
    }
)


def validate_listing_url(url: str | None) -> ValidationResult:
    if not url:
        return ValidationResult(valid=False, error="Link er ikke angivet")

    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return ValidationResult(valid=False, error="Linket er ugyldigt")

        if "ViewPage" in url:
            return ValidationResult(
                valid=False,
                error="Linket ser ud til at være en bolig der ikke er til salg.",
            )

        domain = extract_domain(url)
        if domain == "boligsiden.dk":
            return _validate_boligsiden_url(url)

        if domain not in SUPPORTED_DOMAINS:
            return ValidationResult(
                valid=False,
                error=(
                    "Linket skal være fra en understøttet boligportal. "
                    "Se listen over understøttede portaler på forsiden."
                ),
            )

        return ValidationResult(valid=True)
    except Exception:
        return ValidationResult(valid=False, error="Linket er ugyldigt")


def _validate_boligsiden_url(url: str) -> ValidationResult:
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        if host not in {"boligsiden.dk", "www.boligsiden.dk"}:
            return ValidationResult(valid=False, error="Linket skal være fra boligsiden.dk")

        from urllib.parse import parse_qs

        params = parse_qs(parsed.query)
        if "udbud" not in params:
            return ValidationResult(
                valid=False, error="Linket skal indeholde en udbuds-ID (udbud=...)"
            )

        if "ViewPage" in url:
            return ValidationResult(
                valid=False,
                error="Linket ser ud til at være en bolig der ikke er til salg.",
            )

        return ValidationResult(valid=True)
    except Exception:
        return ValidationResult(valid=False, error="Linket er ugyldigt")
