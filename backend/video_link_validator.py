from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Optional, TypedDict
from urllib import error, parse, request

from config import settings


class VideoLinkValidationResult(TypedDict):
    resolved: Optional[bool]
    error: Optional[str]
    checked_at: Optional[datetime]
    final_url: Optional[str]


_validation_cache: Dict[str, tuple[datetime, VideoLinkValidationResult]] = {}


def _is_valid_http_url(value: str) -> bool:
    parsed = parse.urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _cache_get(url: str) -> Optional[VideoLinkValidationResult]:
    now = datetime.utcnow()
    cached = _validation_cache.get(url)
    if not cached:
        return None

    expires_at, result = cached
    if expires_at <= now:
        _validation_cache.pop(url, None)
        return None

    return result


def _cache_set(url: str, result: VideoLinkValidationResult) -> None:
    ttl_seconds = max(settings.video_link_validation_cache_ttl_seconds, 0)
    if ttl_seconds <= 0:
        return

    expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
    _validation_cache[url] = (expires_at, result)


def _make_success_result(final_url: str) -> VideoLinkValidationResult:
    return {
        "resolved": True,
        "error": None,
        "checked_at": datetime.utcnow(),
        "final_url": final_url,
    }


def _make_error_result(message: str, final_url: Optional[str] = None) -> VideoLinkValidationResult:
    return {
        "resolved": False,
        "error": message,
        "checked_at": datetime.utcnow(),
        "final_url": final_url,
    }


def validate_video_link(video_link: Optional[str]) -> VideoLinkValidationResult:
    """Validate and resolve a video link.

    Validation is intentionally non-blocking for drill ingestion workflows.
    """
    if not video_link:
        return {
            "resolved": None,
            "error": None,
            "checked_at": None,
            "final_url": None,
        }

    normalized = video_link.strip()
    if not normalized:
        return {
            "resolved": None,
            "error": None,
            "checked_at": None,
            "final_url": None,
        }

    cached = _cache_get(normalized)
    if cached is not None:
        return cached

    if not _is_valid_http_url(normalized):
        result = _make_error_result("Video link must use a valid http(s) URL")
        _cache_set(normalized, result)
        return result

    timeout = max(settings.video_link_validation_timeout_seconds, 1)
    headers = {
        "User-Agent": "CoTrainer/1.0 video-link-validator",
    }

    try:
        head_request = request.Request(normalized, method="HEAD", headers=headers)
        with request.urlopen(head_request, timeout=timeout) as response:
            status = getattr(response, "status", 200)
            final_url = response.geturl() or normalized
            if 200 <= status < 400:
                result = _make_success_result(final_url)
                _cache_set(normalized, result)
                return result

            result = _make_error_result(f"Video link returned HTTP {status}", final_url)
            _cache_set(normalized, result)
            return result
    except error.HTTPError as http_error:
        # Some providers reject HEAD requests. Fallback to GET for those cases.
        if http_error.code in {403, 405}:
            try:
                get_headers = {**headers, "Range": "bytes=0-1024"}
                get_request = request.Request(normalized, method="GET", headers=get_headers)
                with request.urlopen(get_request, timeout=timeout) as response:
                    status = getattr(response, "status", 200)
                    final_url = response.geturl() or normalized
                    if 200 <= status < 400:
                        result = _make_success_result(final_url)
                        _cache_set(normalized, result)
                        return result

                    result = _make_error_result(f"Video link returned HTTP {status}", final_url)
                    _cache_set(normalized, result)
                    return result
            except error.HTTPError as get_error:
                final_url = get_error.geturl() or normalized
                result = _make_error_result(f"Video link returned HTTP {get_error.code}", final_url)
                _cache_set(normalized, result)
                return result
            except Exception as get_exception:  # pragma: no cover
                result = _make_error_result(f"Video link could not be reached: {get_exception}")
                _cache_set(normalized, result)
                return result

        final_url = http_error.geturl() or normalized
        result = _make_error_result(f"Video link returned HTTP {http_error.code}", final_url)
        _cache_set(normalized, result)
        return result
    except error.URLError as url_error:
        result = _make_error_result(f"Video link could not be reached: {url_error.reason}")
        _cache_set(normalized, result)
        return result
    except TimeoutError:
        result = _make_error_result("Video link check timed out")
        _cache_set(normalized, result)
        return result
    except Exception as exception:  # pragma: no cover
        result = _make_error_result(f"Video link could not be reached: {exception}")
        _cache_set(normalized, result)
        return result
