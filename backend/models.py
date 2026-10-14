"""Data types shared by the Campus Customs agent team."""

from typing import Literal

from pydantic import BaseModel, Field

AgentName = Literal["boss", "inventory", "accounting", "facilities", "customer_service"]


class AgentStep(BaseModel):
    """What every agent returns at the end of its turn. The loop reads this to
    decide who goes next."""

    summary: str = Field(
        description="What you checked and found this turn, citing only numbers a tool returned."
    )
    next_action: Literal["handoff", "done", "needs_human"] = Field(
        description=(
            "'handoff' to pass the ticket to another agent, 'done' once close_ticket succeeded, "
            "'needs_human' if the ticket can't go further without a person."
        )
    )
    handoff_to: AgentName | None = Field(
        default=None, description="Which agent goes next. Required when next_action is 'handoff'."
    )
    handoff_message: str | None = Field(
        default=None, description="Exactly what you need the next agent to do."
    )


class ToolCallRecord(BaseModel):
    tool: str
    args: dict | str | None
    result: str | None = None


class AuditEntry(BaseModel):
    """One agent loop step, appended to output/audit_trail.json."""

    timestamp: str
    run_id: str
    ticket_id: int
    step: int
    agent: AgentName
    prompt: str
    tool_calls: list[ToolCallRecord]
    output: AgentStep | None
    error: str | None = None
    input_tokens: int
    output_tokens: int
    requests: int


class TicketResult(BaseModel):
    run_id: str
    ticket_id: int
    final_status: Literal["done", "needs_human", "step_limit", "token_limit", "error"]
    steps: int
    total_tokens: int
    last_summary: str
