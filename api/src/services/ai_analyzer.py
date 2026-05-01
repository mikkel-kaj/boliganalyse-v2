import base64
import logging
from typing import Any

from anthropic import AsyncAnthropic

from src.config import get_settings
from src.services.prompt import (
    FORCE_FINAL_JSON_INSTRUCTION,
    build_analysis_prompt,
    build_analysis_prompt_with_documents,
)
from src.services.tool_registry import ToolRegistry
from src.types.models import HTMLParseResult

logger = logging.getLogger(__name__)


class AIAnalyzerService:
    """Drives the Claude tool-use loop and returns parsed JSON.

    Mirrors the TypeScript original:
    - Cap of MAX_TOOL_TURNS so a chatty model can't loop forever.
    - When the cap is hit, one final request is made *without tools* plus
      a forced "JSON only" instruction.
    - Tool results are truncated to MAX_TOOL_RESULT_CHARS — DST API
      payloads can be huge.
    - JSON extraction strips code fences and walks the brace depth so
      stray prose around the JSON object doesn't break parsing.
    """

    def __init__(self, *, initialize_tools: bool = True) -> None:
        settings = get_settings()
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model
        self._max_tokens = settings.anthropic_max_tokens
        self._max_tool_turns = settings.max_tool_turns
        self._max_tool_result_chars = settings.max_tool_result_chars

        self._tool_registry = ToolRegistry(initialize=initialize_tools)

    async def analyze_multiple_texts(
        self,
        primary: HTMLParseResult,
        secondary: HTMLParseResult | None,
    ) -> dict[str, Any]:
        if secondary is None:
            logger.warning("Secondary text content missing; analyzing primary only")
            return await self.analyze_text(primary.extracted_text or "")

        combined = (
            f"ORIGINAL ARTICLE FROM BOLIGSIDEN -- > {primary.extracted_text or ''}"
            f"\n\n---\n\n ARTICLE FROM THE ORIGINAL REALESTATE AGENT:\n"
            f"{secondary.extracted_text or ''}"
        )
        return await self.analyze_text(combined)

    async def analyze_text(self, text_content: str) -> dict[str, Any]:
        if not text_content:
            raise ValueError("No text content provided for analysis")

        logger.info("Starting analyze_text with text length: %d", len(text_content))
        prompt = build_analysis_prompt(text_content)
        return await self._run_analysis([{"role": "user", "content": prompt}])

    async def analyze_with_documents(
        self,
        text_content: str,
        pdf_documents: list[tuple[str, bytes]],
    ) -> dict[str, Any]:
        """Analyse a listing with the broker's PDFs attached as Claude
        document blocks (tilstandsrapport, energimærke, elinstallation, …).

        Each entry in `pdf_documents` is a `(filename, pdf_bytes)` pair.
        The prompt is rewritten via build_analysis_prompt_with_documents
        so the model knows the PDFs are part of the input and is told to
        reference them explicitly in `excerpt` fields. Falls back to the
        text-only path when `pdf_documents` is empty.
        """
        if not text_content and not pdf_documents:
            raise ValueError("No text or documents provided for analysis")

        if not pdf_documents:
            return await self.analyze_text(text_content)

        logger.info(
            "Starting analyze_with_documents (text=%d chars, pdfs=%d)",
            len(text_content or ""),
            len(pdf_documents),
        )
        prompt = build_analysis_prompt_with_documents(
            text_content, [name for name, _ in pdf_documents]
        )

        content_blocks: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        for filename, pdf_bytes in pdf_documents:
            content_blocks.append(
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": base64.standard_b64encode(pdf_bytes).decode("ascii"),
                    },
                    "title": filename,
                }
            )

        return await self._run_analysis(
            [{"role": "user", "content": content_blocks}]
        )

    async def _run_analysis(
        self, initial_messages: list[dict[str, Any]]
    ) -> dict[str, Any]:
        response = await self._analyze_with_tools(initial_messages)

        stop_reason = response.get("stop_reason")
        if stop_reason and stop_reason != "end_turn":
            raise RuntimeError(f"Claude API error: stop_reason={stop_reason}")

        text_blocks = [c for c in response.get("content", []) if c.get("type") == "text"]
        if not text_blocks:
            raise RuntimeError("Claude returned no text content")

        return self._extract_json_from_response(text_blocks[-1]["text"])

    async def _analyze_with_tools(
        self, initial_messages: list[dict[str, Any]]
    ) -> dict[str, Any]:
        tools = self._tool_registry.get_all_definitions()
        messages: list[dict[str, Any]] = list(initial_messages)
        accumulated_text_blocks: list[dict[str, Any]] = []

        data = await self._make_claude_request(messages, tools=tools)
        turn = 0

        while data.get("content"):
            for block in data["content"]:
                if block.get("type") == "text":
                    logger.debug("AI thought: %s", block.get("text", "")[:200])
                    accumulated_text_blocks.append(block)

            tool_calls = [c for c in data["content"] if c.get("type") == "tool_use"]
            if not tool_calls:
                break

            tool_results = []
            for call in tool_calls:
                logger.info("Executing tool: %s", call["name"])
                result = await self._tool_registry.execute(
                    call["name"], call.get("input", {})
                )
                raw = result.error if result.error else str(result.output)
                if len(raw) > self._max_tool_result_chars:
                    raw = (
                        raw[: self._max_tool_result_chars]
                        + f"\n[truncated {len(raw) - self._max_tool_result_chars} chars]"
                    )
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": call["id"],
                        "content": raw,
                    }
                )

            messages.append({"role": "assistant", "content": data["content"]})
            messages.append({"role": "user", "content": tool_results})

            turn += 1
            if turn >= self._max_tool_turns:
                logger.info(
                    "Hit MAX_TOOL_TURNS (%d); forcing final JSON answer without tools",
                    self._max_tool_turns,
                )
                messages.append({"role": "user", "content": FORCE_FINAL_JSON_INSTRUCTION})
                data = await self._make_claude_request(messages, tools=None)
                for block in data.get("content") or []:
                    if block.get("type") == "text":
                        accumulated_text_blocks.append(block)
                break

            data = await self._make_claude_request(messages, tools=tools)

        return {
            "id": data.get("id"),
            "model": data.get("model"),
            "role": data.get("role"),
            "stop_reason": data.get("stop_reason"),
            "content": accumulated_text_blocks,
        }

    async def _make_claude_request(
        self, messages: list[dict[str, Any]], *, tools: list[dict[str, Any]] | None
    ) -> dict[str, Any]:
        logger.info("Making request to Claude API (tools=%d)", len(tools) if tools else 0)

        kwargs: dict[str, Any] = {
            "model": self._model,
            "max_tokens": self._max_tokens,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = tools

        message = await self._client.messages.create(**kwargs)

        return {
            "id": message.id,
            "model": message.model,
            "role": message.role,
            "stop_reason": message.stop_reason,
            "content": [block.model_dump() for block in message.content],
        }

    @staticmethod
    def _extract_json_from_response(raw_text: str) -> dict[str, Any]:
        """Walk the brace depth from the first `{`, skipping braces inside
        strings, to extract a balanced JSON object even if Claude wraps it
        in markdown fences or chats around it."""
        import json
        import re

        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_text)
        text = fence_match.group(1) if fence_match else raw_text

        start = text.find("{")
        if start == -1:
            raise ValueError("Could not find JSON in response")

        depth = 0
        in_string = False
        escape = False
        end = -1
        for i in range(start, len(text)):
            ch = text[i]
            if escape:
                escape = False
                continue
            if ch == "\\" and in_string:
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break

        if end == -1:
            raise ValueError("Could not find balanced JSON object in response")

        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            raise ValueError(f"Failed to parse response from Claude: {exc}") from exc
