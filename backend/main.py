"""FastAPI backend for the Campus Customs React board.

Run from backend/:
    uvicorn main:app --reload --port 8000

Agents can only prepare payments (payment_requests). The approve route is the
only code anywhere that writes to payments or cash_accounts.
"""

import asyncio
import json
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Let `uvicorn main:app` (run from backend/) import the backend package.
HW_DIR = Path(__file__).resolve().parent.parent
if str(HW_DIR) not in sys.path:
    sys.path.insert(0, str(HW_DIR))

from backend.agents import build_agents, make_mcp_toolset  # noqa: E402
from backend.models import TicketResult  # noqa: E402
from backend.run import AUDIT_PATH, run_ticket  # noqa: E402

DB_PATH = HW_DIR / "data" / "campus_customs_new.db"
ORIGINAL_DB = HW_DIR / "data" / "campus_customs.db"

app = FastAPI(title="Campus Customs Desk API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# One agent run, approval, or reset at a time, so they can't trip over each other.
db_lock = asyncio.Lock()


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def table_exists(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


class ApproveBody(BaseModel):
    approved_by: str = Field(min_length=1, description="Name of the person approving.")


# ---------------------------------------------------------------------------
# Tickets
# ---------------------------------------------------------------------------


@app.get("/tickets")
def list_tickets() -> list[dict]:
    conn = connect()
    rows = conn.execute(
        "SELECT id, type, requester, subject, sku, size, qty, status, created_at "
        "FROM tickets ORDER BY id"
    ).fetchall()
    conn.close()
    return [
        {**dict(r), "state": "resolved" if r["status"] == "closed" else "open"} for r in rows
    ]


@app.post("/tickets/{ticket_id}/run")
async def run_agents(ticket_id: int) -> TicketResult:
    conn = connect()
    row = conn.execute("SELECT status FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(404, f"No ticket {ticket_id}.")
    if row["status"] == "closed":
        raise HTTPException(409, f"Ticket {ticket_id} is already resolved. Reset the db to rerun it.")
    if db_lock.locked():
        raise HTTPException(409, "Another agent run, approval, or reset is in progress.")
    async with db_lock:
        shop = make_mcp_toolset()
        async with shop:
            return await run_ticket(build_agents(shop), ticket_id)


# ---------------------------------------------------------------------------
# Agent events
# ---------------------------------------------------------------------------


@app.get("/events")
def recent_events(limit: int = 30, ticket_id: int | None = None) -> list[dict]:
    if not AUDIT_PATH.exists() or AUDIT_PATH.stat().st_size == 0:
        return []
    entries = json.loads(AUDIT_PATH.read_text())
    if ticket_id is not None:
        entries = [e for e in entries if e["ticket_id"] == ticket_id]
    events = []
    for e in entries[-limit:][::-1]:  # newest first
        out = e.get("output") or {}
        events.append({
            "timestamp": e["timestamp"],
            "run_id": e["run_id"],
            "ticket_id": e["ticket_id"],
            "step": e["step"],
            "agent": e["agent"],
            "said": out.get("summary") or e.get("error"),
            "next_action": out.get("next_action"),
            "handoff_to": out.get("handoff_to"),
            "handoff_message": out.get("handoff_message"),
            "tools": [c["tool"] for c in e["tool_calls"]],
            "tokens": e["input_tokens"] + e["output_tokens"],
            "error": e.get("error"),
        })
    return events


# ---------------------------------------------------------------------------
# Approvals: the only place money moves
# ---------------------------------------------------------------------------


@app.get("/approvals")
def list_approvals(status: str = "pending") -> list[dict]:
    conn = connect()
    if not table_exists(conn, "payment_requests"):
        conn.close()
        return []
    rows = conn.execute(
        "SELECT * FROM payment_requests WHERE status = ? ORDER BY id", (status,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/approvals/{request_id}/approve")
async def approve_payment(request_id: int, body: ApproveBody) -> dict:
    """A human clicked approve: pay the request from cash and record it."""
    async with db_lock:
        conn = connect()
        try:
            with conn:  # one transaction: all of it happens or none of it does
                if not table_exists(conn, "payment_requests"):
                    raise HTTPException(404, "No payment requests yet.")
                req = conn.execute(
                    "SELECT * FROM payment_requests WHERE id = ?", (request_id,)
                ).fetchone()
                if req is None:
                    raise HTTPException(404, f"No payment request {request_id}.")
                if req["status"] != "pending":
                    raise HTTPException(409, f"Request {request_id} is already {req['status']}.")

                # Re-check the bill now, in case it changed since the agent asked.
                if req["kind"] == "invoice":
                    inv = conn.execute(
                        "SELECT amount, status FROM invoices WHERE id = ?", (req["ref_id"],)
                    ).fetchone()
                    if inv is None or inv["status"] != "open":
                        raise HTTPException(409, f"Invoice {req['ref_id']} is no longer open.")
                    if inv["amount"] != req["amount"]:
                        raise HTTPException(409, "Invoice amount changed since the request.")
                elif req["kind"] == "rent":
                    lease = conn.execute(
                        "SELECT monthly_rent FROM leases WHERE id = ?", (req["ref_id"],)
                    ).fetchone()
                    if lease is None or lease["monthly_rent"] != req["amount"]:
                        raise HTTPException(409, "Lease rent changed since the request.")

                acct = conn.execute(
                    "SELECT balance FROM cash_accounts WHERE name = ?", (req["account"],)
                ).fetchone()
                if acct is None:
                    raise HTTPException(409, f"No cash account '{req['account']}'.")
                if acct["balance"] < req["amount"]:
                    raise HTTPException(
                        409, f"{req['account']} has ${acct['balance']}, not enough for ${req['amount']}."
                    )

                paid_at = datetime.now().astimezone().isoformat(timespec="seconds")
                new_balance = acct["balance"] - req["amount"]
                cur = conn.execute(
                    """INSERT INTO payments (kind, ref_id, amount, account, paid_at, approved_by)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (req["kind"], req["ref_id"], req["amount"], req["account"], paid_at,
                     body.approved_by),
                )
                conn.execute(
                    "UPDATE cash_accounts SET balance = ? WHERE name = ?",
                    (new_balance, req["account"]),
                )
                if req["kind"] == "invoice":
                    conn.execute("UPDATE invoices SET status = 'paid' WHERE id = ?", (req["ref_id"],))
                conn.execute(
                    "UPDATE payment_requests SET status = 'approved' WHERE id = ?", (request_id,)
                )
        finally:
            conn.close()
    return {
        "request_id": request_id, "payment_id": cur.lastrowid, "status": "approved",
        "paid_to": req["payee"], "amount": req["amount"], "account": req["account"],
        "new_balance": new_balance, "approved_by": body.approved_by, "paid_at": paid_at,
    }


@app.post("/approvals/{request_id}/reject")
async def reject_payment(request_id: int, body: ApproveBody) -> dict:
    """A human clicked reject. No money moves."""
    async with db_lock:
        conn = connect()
        try:
            with conn:
                req = conn.execute(
                    "SELECT status FROM payment_requests WHERE id = ?", (request_id,)
                ).fetchone() if table_exists(conn, "payment_requests") else None
                if req is None:
                    raise HTTPException(404, f"No payment request {request_id}.")
                if req["status"] != "pending":
                    raise HTTPException(409, f"Request {request_id} is already {req['status']}.")
                conn.execute(
                    "UPDATE payment_requests SET status = 'rejected' WHERE id = ?", (request_id,)
                )
        finally:
            conn.close()
    return {"request_id": request_id, "status": "rejected", "rejected_by": body.approved_by}


# ---------------------------------------------------------------------------
# Cash and reset
# ---------------------------------------------------------------------------


@app.get("/cash")
def checking_balance() -> dict:
    conn = connect()
    row = conn.execute(
        "SELECT name, balance, date FROM cash_accounts WHERE name = 'checking'"
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(404, "No checking account on file.")
    return dict(row)


@app.post("/reset")
async def reset_db() -> dict:
    """Copy the untouched original over the working db. The audit trail is kept."""
    if db_lock.locked():
        raise HTTPException(409, "Wait for the current agent run or approval to finish.")
    async with db_lock:
        shutil.copyfile(ORIGINAL_DB, DB_PATH)
    return {"reset": True, "database": "data/campus_customs_new.db",
            "copied_from": "data/campus_customs.db", "audit_trail_kept": True}
