"""Run the agent team on Campus Customs tickets.

    python -m backend.run            # every open ticket
    python -m backend.run 101 103    # specific tickets

Boss reads each ticket first and delegates. Any agent can hand off to any
other. Every loop step is appended to output/audit_trail.json.
"""

import asyncio
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.messages import ToolCallPart, ToolReturnPart
from pydantic_ai.usage import UsageLimits

from backend.agents import HW_DIR, MODEL_NAME, build_agents, make_mcp_toolset
from backend.models import AgentName, AgentStep, AuditEntry, TicketResult, ToolCallRecord

AUDIT_PATH = HW_DIR / "output" / "audit_trail.json"

# Token guardrails.
MAX_STEPS_PER_TICKET = 10           # agent turns before the loop gives up
TICKET_TOKEN_BUDGET = 150_000       # total tokens across all turns on one ticket
TURN_LIMITS = UsageLimits(          # one agent turn
    request_limit=10,
    tool_calls_limit=8,
    total_tokens_limit=40_000,
)
MAX_LOGGED_RESULT_CHARS = 2000


def append_audit(entry: AuditEntry) -> None:
    """Append one entry. Never truncates: if the file can't be read as a list,
    stop instead of overwriting it."""
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    entries = []
    if AUDIT_PATH.exists() and AUDIT_PATH.stat().st_size > 0:
        entries = json.loads(AUDIT_PATH.read_text())
        if not isinstance(entries, list):
            raise RuntimeError(f"{AUDIT_PATH} is not a JSON list; refusing to overwrite it.")
    entries.append(entry.model_dump(mode="json"))
    tmp = AUDIT_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(entries, indent=2))
    os.replace(tmp, AUDIT_PATH)


def tool_calls_from(messages) -> list[ToolCallRecord]:
    calls: dict[str, ToolCallRecord] = {}
    for msg in messages:
        for part in msg.parts:
            if isinstance(part, ToolCallPart) and part.tool_name != "final_result":
                calls[part.tool_call_id] = ToolCallRecord(tool=part.tool_name, args=part.args)
            elif isinstance(part, ToolReturnPart) and part.tool_call_id in calls:
                text = part.content if isinstance(part.content, str) else json.dumps(part.content, default=str)
                calls[part.tool_call_id].result = text[:MAX_LOGGED_RESULT_CHARS]
    return list(calls.values())


def build_prompt(ticket_id: int, sender: AgentName | None, message: str | None,
                 history: list[str]) -> str:
    lines = [f"Ticket {ticket_id}."]
    if sender:
        lines.append(f"Handed to you by {sender}: {message or '(no message)'}")
    else:
        lines.append("A new ticket has arrived. Read it and delegate.")
    if history:
        lines.append("Steps so far:\n" + "\n".join(history[-6:]))
    return "\n".join(lines)


async def run_ticket(agents, ticket_id: int) -> TicketResult:
    run_id = uuid.uuid4().hex[:8]
    current: AgentName = "boss"
    sender: AgentName | None = None
    message: str | None = None
    history: list[str] = []
    total_tokens = 0
    status = "step_limit"
    summary = ""

    for step in range(1, MAX_STEPS_PER_TICKET + 1):
        if total_tokens >= TICKET_TOKEN_BUDGET:
            status = "token_limit"
            break
        prompt = build_prompt(ticket_id, sender, message, history)
        output: AgentStep | None = None
        error = None
        messages, usage = [], None
        try:
            result = await agents[current].run(prompt, usage_limits=TURN_LIMITS)
            output, messages, usage = result.output, result.new_messages(), result.usage
        except UsageLimitExceeded as exc:
            error = f"turn token/call limit: {exc}"
        except Exception as exc:  # log and stop rather than crash mid-ticket
            error = f"{type(exc).__name__}: {exc}"

        in_tok = usage.input_tokens if usage else 0
        out_tok = usage.output_tokens if usage else 0
        total_tokens += in_tok + out_tok
        append_audit(AuditEntry(
            timestamp=datetime.now().astimezone().isoformat(timespec="seconds"),
            run_id=run_id, ticket_id=ticket_id, step=step, agent=current, prompt=prompt,
            tool_calls=tool_calls_from(messages), output=output, error=error,
            input_tokens=in_tok, output_tokens=out_tok, requests=usage.requests if usage else 0,
        ))
        print(f"  [{ticket_id}] step {step} {current}: "
              f"{error or f'{output.next_action} -> {output.handoff_to or "-"}'}")

        if error:
            status = "token_limit" if "limit" in error else "error"
            summary = error
            break
        summary = output.summary
        history.append(f"- {current}: {output.summary}")
        if output.next_action in ("done", "needs_human"):
            status = output.next_action
            break
        # Handoff. A missing or self target goes back to Boss.
        target = output.handoff_to if output.handoff_to and output.handoff_to != current else "boss"
        sender, message, current = current, output.handoff_message, target

    return TicketResult(run_id=run_id, ticket_id=ticket_id, final_status=status,
                        steps=step, total_tokens=total_tokens, last_summary=summary)


async def main(ticket_ids: list[int]) -> None:
    shop = make_mcp_toolset()
    async with shop:
        if not ticket_ids:
            open_tickets = await shop.direct_call_tool("list_open_tickets", {})
            ticket_ids = [t["id"] for t in open_tickets]
        agents = build_agents(shop)
        print(f"Model: {MODEL_NAME}. Tickets: {ticket_ids}")
        for tid in ticket_ids:
            res = await run_ticket(agents, tid)
            print(f"Ticket {tid}: {res.final_status} after {res.steps} steps, "
                  f"{res.total_tokens} tokens\n  {res.last_summary}\n")


if __name__ == "__main__":
    asyncio.run(main([int(a) for a in sys.argv[1:]]))
