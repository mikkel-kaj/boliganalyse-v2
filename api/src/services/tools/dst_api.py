"""Danmarks Statistik (statbank.dk) tool implementations.

Four tools that walk the user from subjects → tables → table metadata →
data, mirroring the original TypeScript implementation 1:1.
"""

import base64
import json
import logging
from typing import Any

import httpx

from src.services.base_tool import BaseTool

logger = logging.getLogger(__name__)

BASE_URL = "https://api.statbank.dk/v1"


GET_SUBJECTS_TOOL_DEFINITION: dict[str, Any] = {
    "name": "get_subjects",
    "description": (
        "Get subjects from Danmarks Statistik API. Returns a list of subjects "
        "or sub-subjects."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "subjects": {
                "type": "array",
                "description": (
                    "Optional list of subject codes. If provided, fetches "
                    "sub-subjects for these subjects."
                ),
                "items": {"type": "string"},
            },
            "includeTables": {
                "type": "boolean",
                "description": "If true, includes tables in the result under each subject.",
            },
            "recursive": {
                "type": "boolean",
                "description": (
                    "If true, fetches sub-subjects (and tables) recursively through "
                    "all levels."
                ),
            },
            "omitInactiveSubjects": {
                "type": "boolean",
                "description": "If true, omits subjects/sub-subjects that are no longer updated.",
            },
            "lang": {
                "type": "string",
                "description": "Language code ('da' or 'en', default 'da').",
                "enum": ["da", "en"],
            },
        },
        "required": [],
    },
}

GET_TABLES_TOOL_DEFINITION: dict[str, Any] = {
    "name": "get_tables",
    "description": (
        "Get tables from Danmarks Statistik API. Returns a list of tables, "
        "optionally filtered by subjects."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "subjects": {
                "type": "array",
                "description": "Optional list of subject codes to filter tables on.",
                "items": {"type": "string"},
            },
            "pastdays": {
                "type": "number",
                "description": (
                    "Optional number of days; only tables updated within these days are included."
                ),
            },
            "includeInactive": {
                "type": "boolean",
                "description": "If true, includes inactive (discontinued) tables.",
            },
            "lang": {
                "type": "string",
                "description": "Language code ('da' or 'en', default 'da').",
                "enum": ["da", "en"],
            },
        },
        "required": [],
    },
}

GET_TABLE_INFO_TOOL_DEFINITION: dict[str, Any] = {
    "name": "get_table_info",
    "description": (
        "Get table metadata from Danmarks Statistik API. Returns detailed "
        "information about a specific table (variables, value codes, etc.)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "table_id": {
                "type": "string",
                "description": "The table code (e.g., 'folk1c').",
            },
            "lang": {
                "type": "string",
                "description": "Language code ('da' or 'en', default 'da').",
                "enum": ["da", "en"],
            },
        },
        "required": ["table_id"],
    },
}

GET_DATA_TOOL_DEFINITION: dict[str, Any] = {
    "name": "get_data",
    "description": (
        "Get data from Danmarks Statistik API. Returns data from a specific "
        "table, optionally filtered by variables."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "table_id": {
                "type": "string",
                "description": "The table code (e.g., 'folk1c').",
            },
            "variables": {
                "type": "array",
                "description": (
                    "List of filters for data selection. IMPORTANT: Always use the "
                    "exact variable codes (not display names) from get_table_info "
                    "results. For example, use 'TAL' if that's the code, even if the "
                    "display name is 'enhed'."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": (
                                "Variable code exactly as shown in get_table_info "
                                "response (e.g., 'OMRÅDE', 'TAL', 'EJENDOMSKATE'). "
                                "NOT the display name. Request only one value for TAL "
                                "at a time"
                            ),
                        },
                        "values": {
                            "type": "array",
                            "description": (
                                "List of valid value codes for this variable. Only "
                                "use codes that exist in get_table_info results."
                            ),
                            "items": {"type": "string"},
                        },
                    },
                },
            },
            "format": {
                "type": "string",
                "description": "Output format. Default 'JSONSTAT'.",
                "enum": [
                    "JSONSTAT",
                    "JSON",
                    "CSV",
                    "XLSX",
                    "BULK",
                    "PX",
                    "TSV",
                    "HTML5",
                    "HTML5InclNotes",
                ],
            },
            "timeOrder": {
                "type": "string",
                "description": "Optional string for sorting time series ('Ascending' or 'Descending').",
                "enum": ["Ascending", "Descending"],
            },
            "valuePresentation": {
                "type": "string",
                "description": "Optional string to control value presentation ('Code' or 'Text').",
                "enum": ["Code", "Text"],
            },
            "lang": {
                "type": "string",
                "description": "Language code for metadata in result ('da' or 'en', default 'da').",
                "enum": ["da", "en"],
            },
        },
        "required": ["table_id"],
    },
}


async def _post_json(path: str, payload: dict[str, Any]) -> httpx.Response:
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
        return await client.post(f"{BASE_URL}{path}", json=payload)


def _raise_for_dst_status(response: httpx.Response) -> None:
    if not response.is_success:
        raise RuntimeError(
            f"DST API Error: {response.status_code} {response.reason_phrase} "
            f"{{{response.text}}}"
        )


class GetSubjectsTool(BaseTool):
    def __init__(self) -> None:
        super().__init__(GET_SUBJECTS_TOOL_DEFINITION)

    async def _execute_impl(self, params: dict[str, Any]) -> str:
        payload: dict[str, Any] = {"format": "JSON", "lang": params.get("lang", "da")}
        if params.get("subjects"):
            payload["subjects"] = params["subjects"]
        if params.get("includeTables"):
            payload["includeTables"] = True
        if params.get("recursive"):
            payload["recursive"] = True
        if params.get("omitInactiveSubjects"):
            payload["omitInactiveSubjects"] = True

        logger.info("Fetching subjects from DST API: %s", payload)
        response = await _post_json("/subjects", payload)
        _raise_for_dst_status(response)
        return json.dumps(response.json())


class GetTablesTool(BaseTool):
    def __init__(self) -> None:
        super().__init__(GET_TABLES_TOOL_DEFINITION)

    async def _execute_impl(self, params: dict[str, Any]) -> str:
        payload: dict[str, Any] = {"format": "JSON", "lang": params.get("lang", "da")}
        if params.get("subjects"):
            payload["subjects"] = params["subjects"]
        if params.get("pastdays") is not None:
            payload["pastdays"] = params["pastdays"]
        if params.get("includeInactive"):
            payload["includeInactive"] = True

        logger.info("Fetching tables from DST API: %s", payload)
        response = await _post_json("/tables", payload)
        _raise_for_dst_status(response)
        return json.dumps(response.json())


class GetTableInfoTool(BaseTool):
    def __init__(self) -> None:
        super().__init__(GET_TABLE_INFO_TOOL_DEFINITION)

    async def _execute_impl(self, params: dict[str, Any]) -> str:
        payload = {
            "table": params["table_id"],
            "format": "JSON",
            "lang": params.get("lang", "da"),
        }
        logger.info("Fetching table info from DST API for table %s", params["table_id"])
        response = await _post_json("/tableinfo", payload)
        _raise_for_dst_status(response)
        return json.dumps(response.json())


class GetDataTool(BaseTool):
    def __init__(self) -> None:
        super().__init__(GET_DATA_TOOL_DEFINITION)

    async def _execute_impl(self, params: dict[str, Any]) -> str:
        table_id = params["table_id"]
        variables = params.get("variables")
        fmt = (params.get("format") or "JSONSTAT").upper()
        time_order = params.get("timeOrder")
        value_presentation = params.get("valuePresentation")
        lang = params.get("lang", "da")

        payload: dict[str, Any] = {"table": table_id, "format": fmt, "lang": lang}

        if variables:
            for variable in variables:
                if "code" not in variable or "values" not in variable:
                    raise ValueError("Each variable must have 'code' and 'values'")
                if not isinstance(variable["values"], list):
                    variable["values"] = [variable["values"]]
            payload["variables"] = variables

        if time_order:
            payload["timeOrder"] = time_order
        if value_presentation:
            payload["valuePresentation"] = value_presentation

        logger.info("Fetching data from DST API for table %s: %s", table_id, payload)
        response = await _post_json("/data", payload)
        _raise_for_dst_status(response)

        if fmt in {"JSON", "JSONSTAT"}:
            return json.dumps(response.json())
        if fmt in {"CSV", "PX", "TSV", "HTML5", "HTML5INCLNOTES"}:
            return response.text
        encoded = base64.b64encode(response.content).decode("ascii")
        return f"data:application/{fmt.lower()};base64,{encoded}"
