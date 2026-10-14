"""The five Campus Customs agents.

Every agent gets its shop facts from the Campus Customs MCP server (the same
server registered in .mcp.json). There is no other tools layer. Each agent
only sees the MCP tools its job needs.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI
from fastmcp.client.transports import StdioTransport
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.models.openai import OpenAIResponsesModel, OpenAIResponsesModelSettings
from pydantic_ai.providers.openai import OpenAIProvider

from backend.models import AgentName, AgentStep

HW_DIR = Path(__file__).resolve().parent.parent
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

load_dotenv(HW_DIR / ".env")         # HW 5/.env (copy of .env.example)
load_dotenv(HW_DIR.parent / ".env")  # fallback: the course folder's .env
os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

MODEL_NAME = os.getenv("CAMPUS_MODEL", "gpt-6-luna")

# A model call that hangs fails after this many seconds (one automatic retry)
# instead of freezing the whole run.
REQUEST_TIMEOUT_S = 60

# Token guardrails. A single response is capped, and each agent turn is capped
# by the usage limits the loop passes in (see backend/run.py).
MODEL_SETTINGS = OpenAIResponsesModelSettings(
    max_tokens=2000,
    openai_reasoning_effort="low",
    parallel_tool_calls=False,
)

# Least privilege: which MCP tools each agent may call.
READ = {"get_ticket", "add_ticket_note"}
AGENT_TOOLS: dict[AgentName, set[str]] = {
    "boss": READ | {"list_open_tickets", "close_ticket"},
    "inventory": READ | {"check_order_fulfillment", "check_bulk_discount"},
    "accounting": READ | {
        "check_rent_payment", "check_order_fulfillment", "check_bulk_discount",
        "draft_bulk_quote", "request_payment_approval",
    },
    "facilities": READ | {"check_rent_payment"},
    "customer_service": READ | {
        "check_order_fulfillment", "check_bulk_discount", "draft_customer_reply",
    },
}


def make_mcp_toolset() -> MCPToolset:
    """Start the Campus Customs MCP server using the config in .mcp.json."""
    cfg = json.loads((HW_DIR / ".mcp.json").read_text())["mcpServers"]["campus-customs"]
    # Paths in .mcp.json are relative to HW 5, so the repo works wherever it's cloned.
    transport = StdioTransport(
        command=str(HW_DIR / cfg["command"]), args=[str(HW_DIR / a) for a in cfg["args"]],
        cwd=str(HW_DIR), keep_alive=False,
    )
    return MCPToolset(transport)


def build_agents(shop: MCPToolset) -> dict[AgentName, Agent[None, AgentStep]]:
    model = OpenAIResponsesModel(
        MODEL_NAME, provider=OpenAIProvider(openai_client=AsyncOpenAI(
            api_key=os.environ["OPENAI_API_KEY"],
            timeout=REQUEST_TIMEOUT_S,
            max_retries=1,
        ))
    )
    agents: dict[AgentName, Agent[None, AgentStep]] = {}
    for name, allowed in AGENT_TOOLS.items():
        agents[name] = Agent(
            model,
            name=name,
            output_type=AgentStep,
            instructions=(PROMPTS_DIR / f"{name}.md").read_text(),
            toolsets=[shop.filtered(lambda ctx, tool, allowed=allowed: tool.name in allowed)],
            model_settings=MODEL_SETTINGS,
            retries=2,
        )
    return agents
