"""Tests for langchain-sidclaw tool governance wrappers."""
from unittest.mock import MagicMock, patch

import pytest


class FakeTool:
    """Minimal LangChain tool-like for testing without full langchain."""
    def __init__(self, name="test_tool", description="A test tool"):
        self.name = name
        self.description = description

    def invoke(self, input, config=None, **kwargs):
        return f"result:{input}"

    async def ainvoke(self, input, config=None, **kwargs):
        return f"async_result:{input}"


def test_imports():
    """Verify all expected exports are available."""
    from langchain_sidclaw import govern_tool, govern_tools, GovernanceCallbackHandler, __version__
    assert callable(govern_tool)
    assert callable(govern_tools)
    assert __version__ == "0.1.0"
