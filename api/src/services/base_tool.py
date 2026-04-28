import logging
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)


class BaseTool(ABC):
    """Base class for Anthropic tool-use implementations.

    Subclasses define a tool definition (name + JSON-schema input) and
    implement `_execute_impl`. Validation against the schema is handled
    here so each tool only worries about its own logic.
    """

    def __init__(self, definition: dict[str, Any]) -> None:
        self.definition = definition

    def get_definition(self) -> dict[str, Any]:
        return self.definition

    def _validate_parameters(self, params: dict[str, Any]) -> None:
        schema = self.definition["input_schema"]
        required: list[str] = schema.get("required", [])
        for key in required:
            if params.get(key) is None:
                raise ValueError(f"Missing required parameter: {key}")

        properties: dict[str, Any] = schema.get("properties", {})
        for key, value in params.items():
            prop = properties.get(key)
            if not prop:
                continue
            expected = prop.get("type")
            if expected == "string" and not isinstance(value, str):
                raise ValueError(f"Parameter {key} must be a string")
            elif expected == "number" and not isinstance(value, (int, float)):
                raise ValueError(f"Parameter {key} must be a number")
            elif expected == "boolean" and not isinstance(value, bool):
                raise ValueError(f"Parameter {key} must be a boolean")
            elif expected == "array" and not isinstance(value, list):
                raise ValueError(f"Parameter {key} must be an array")
            elif expected == "object" and not isinstance(value, dict):
                raise ValueError(f"Parameter {key} must be an object")

            enum_values = prop.get("enum")
            if enum_values and value not in enum_values:
                raise ValueError(
                    f"Parameter {key} value {value!r} not in allowed enum: {enum_values}"
                )

    async def execute(self, params: dict[str, Any]) -> Any:
        try:
            self._validate_parameters(params)
            return await self._execute_impl(params)
        except Exception:
            logger.exception("Error executing tool %s", self.definition["name"])
            raise

    @abstractmethod
    async def _execute_impl(self, params: dict[str, Any]) -> Any: ...
