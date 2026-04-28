import logging
from dataclasses import dataclass
from typing import Any

from src.config import get_settings
from src.services.base_tool import BaseTool
from src.services.tools.dst_api import (
    GetDataTool,
    GetSubjectsTool,
    GetTableInfoTool,
    GetTablesTool,
)

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ToolCallResponse:
    output: Any
    error: str | None = None


class ToolRegistry:
    """Holds the set of tools Claude can call during analysis. The DST
    tools are gated behind `enable_dst_tools` so they can be disabled
    without code changes (useful for local debugging or if DST goes down).
    """

    def __init__(self, *, initialize: bool = False) -> None:
        self._tools: dict[str, BaseTool] = {}
        if initialize:
            self.initialize_tools()

    def initialize_tools(self) -> None:
        settings = get_settings()
        if settings.enable_dst_tools:
            self.register(GetSubjectsTool())
            self.register(GetTablesTool())
            self.register(GetTableInfoTool())
            self.register(GetDataTool())
            logger.info("DST tools registered")
        else:
            logger.info("DST tools disabled (ENABLE_DST_TOOLS=false)")

    def register(self, tool: BaseTool) -> None:
        name = tool.definition["name"]
        if name in self._tools:
            logger.warning("Tool %s already registered; overwriting", name)
        self._tools[name] = tool
        logger.info("Registered tool: %s", name)

    def get_tool(self, name: str) -> BaseTool | None:
        return self._tools.get(name)

    def get_all_definitions(self) -> list[dict[str, Any]]:
        return [tool.definition for tool in self._tools.values()]

    async def execute(self, name: str, parameters: dict[str, Any]) -> ToolCallResponse:
        tool = self._tools.get(name)
        if tool is None:
            logger.error("Tool not found: %s", name)
            return ToolCallResponse(output=None, error=f"Tool not found: {name}")

        try:
            logger.info("Executing tool %s with parameters: %s", name, parameters)
            output = await tool.execute(parameters)
            if output is None:
                return ToolCallResponse(output=None, error="Tool returned null result")
            return ToolCallResponse(output=output)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Error executing tool %s", name)
            return ToolCallResponse(output=None, error=str(exc))
