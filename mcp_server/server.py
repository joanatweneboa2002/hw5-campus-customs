"""Campus Customs MCP server.

Tools over data/campus_customs_new.db. Read tools open the database read-only.
Every value returned comes straight from the database. Anything missing is
returned as None or reported as an error, never filled in or guessed.

Write tools never move money or contact a customer. They only record notes,
drafts, and payment requests that a human has to approve, and they pull every
amount from the database instead of trusting the agent.
"""

import sqlite3
from datetime import date, datetime
from pathlib import Path

from mcp.server.fastmcp import FastMCP

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "campus_customs_new.db"

AGENTS = {"boss", "inventory", "accounting", "facilities", "customer_service"}

# Shop policy: agents may draft a discount up to this much on their own.
# Anything bigger is saved as needing the owner's approval. Change as needed.
MAX_AUTO_DISCOUNT_PCT = 15.0

mcp = FastMCP("campus-customs", log_level="WARNING")


def _connect() -> sqlite3.Connection:
    # Open read-only so read tools can't change the database.
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_rw() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_agent_tables() -> None:
    """Tables the agents write to. Created once; existing shop tables are untouched."""
    conn = _connect_rw()
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS ticket_notes (
                id INTEGER PRIMARY KEY,
                ticket_id INTEGER NOT NULL REFERENCES tickets(id),
                agent TEXT NOT NULL,
                note TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS drafts (
                id INTEGER PRIMARY KEY,
                ticket_id INTEGER NOT NULL REFERENCES tickets(id),
                kind TEXT NOT NULL,
                agent TEXT NOT NULL,
                recipient TEXT NOT NULL,
                body TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS payment_requests (
                id INTEGER PRIMARY KEY,
                ticket_id INTEGER NOT NULL REFERENCES tickets(id),
                kind TEXT NOT NULL,
                ref_id INTEGER NOT NULL,
                payee TEXT NOT NULL,
                amount REAL NOT NULL,
                account TEXT NOT NULL,
                requested_by TEXT NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
    conn.close()


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _check_agent(agent: str) -> None:
    if agent not in AGENTS:
        raise ValueError(f"Unknown agent '{agent}'. Use one of: {sorted(AGENTS)}.")


def _one(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> dict | None:
    row = conn.execute(sql, params).fetchone()
    return dict(row) if row else None


def _all(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> list[dict]:
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def _shop_today(conn: sqlite3.Connection) -> str | None:
    row = _one(conn, "SELECT date_today FROM desk LIMIT 1")
    return row["date_today"] if row else None


def _days_between(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def _get_ticket(conn: sqlite3.Connection, ticket_id: int, expected_type: str) -> dict:
    ticket = _one(conn, "SELECT * FROM tickets WHERE id = ?", (ticket_id,))
    if ticket is None:
        raise ValueError(f"No ticket with id {ticket_id}.")
    if ticket["type"] != expected_type:
        raise ValueError(
            f"Ticket {ticket_id} is type '{ticket['type']}', not '{expected_type}'."
        )
    return ticket


@mcp.tool()
def check_order_fulfillment(ticket_id: int) -> dict:
    """For a customer_order ticket (e.g. 101): can we fill it from stock?

    Returns the ticket, the matching inventory row (sku + size), the list price,
    and the linked vendor invoice with its vendor and lead time, plus whether
    that invoice is overdue as of the shop's date.
    """
    with _connect() as conn:
        ticket = _get_ticket(conn, ticket_id, "customer_order")
        today = _shop_today(conn)

        stock = _one(
            conn,
            "SELECT sku, name, size, qty, location FROM inventory WHERE sku = ? AND size = ?",
            (ticket["sku"], ticket["size"]),
        )
        price = _one(
            conn, "SELECT list_price FROM pricing WHERE sku = ?", (ticket["sku"],)
        )

        invoice = None
        if ticket["invoice_id"] is not None:
            invoice = _one(
                conn,
                """SELECT i.id, i.amount, i.due_date, i.status, i.description,
                          v.id AS vendor_id, v.name AS vendor_name,
                          v.specialty AS vendor_specialty, v.lead_days
                   FROM invoices i JOIN vendors v ON v.id = i.vendor_id
                   WHERE i.id = ?""",
                (ticket["invoice_id"],),
            )
            if invoice and today:
                invoice["days_overdue"] = max(0, _days_between(invoice["due_date"], today))

        in_stock = stock["qty"] if stock else None
        return {
            "shop_date": today,
            "ticket": ticket,
            "inventory": stock,
            "list_price": price["list_price"] if price else None,
            "can_fill_from_stock": (
                in_stock >= ticket["qty"] if in_stock is not None and ticket["qty"] else None
            ),
            "linked_invoice": invoice,
        }


@mcp.tool()
def check_rent_payment(ticket_id: int) -> dict:
    """For a rent_notice ticket (e.g. 102): is the rent real and can we pay it?

    Returns the ticket, the linked lease, whether the requester matches the
    landlord on file, days until rent is due, cash balances, other open
    invoices competing for the same cash, and any rent already paid.
    """
    with _connect() as conn:
        ticket = _get_ticket(conn, ticket_id, "rent_notice")
        today = _shop_today(conn)

        lease = None
        if ticket["lease_id"] is not None:
            lease = _one(conn, "SELECT * FROM leases WHERE id = ?", (ticket["lease_id"],))
        if lease is None:
            return {"shop_date": today, "ticket": ticket, "lease": None,
                    "error": "Ticket is not linked to a lease on file."}

        cash = _all(conn, "SELECT name, balance, date FROM cash_accounts")
        open_invoices = _all(
            conn,
            """SELECT i.id, i.amount, i.due_date, i.description, v.name AS vendor_name
               FROM invoices i JOIN vendors v ON v.id = i.vendor_id
               WHERE i.status = 'open' ORDER BY i.due_date""",
        )
        rent_payments = _all(
            conn,
            "SELECT * FROM payments WHERE kind = 'rent' AND ref_id = ? ORDER BY paid_at",
            (lease["id"],),
        )

        total_cash = sum(a["balance"] for a in cash)
        total_open_invoices = sum(i["amount"] for i in open_invoices)
        return {
            "shop_date": today,
            "ticket": ticket,
            "lease": lease,
            "requester_matches_landlord": ticket["requester"] == lease["landlord"],
            "days_until_due": _days_between(today, lease["next_due"]) if today else None,
            "cash_accounts": cash,
            "total_cash": total_cash,
            "open_invoices": open_invoices,
            "total_open_invoices": total_open_invoices,
            "cash_left_after_rent": total_cash - lease["monthly_rent"],
            "cash_left_after_rent_and_invoices": total_cash - lease["monthly_rent"] - total_open_invoices,
            "rent_payments_on_file": rent_payments,
        }


@mcp.tool()
def check_bulk_discount(ticket_id: int) -> dict:
    """For a price_override ticket (e.g. 103): what are the facts behind a discount?

    Returns the ticket, stock for the requested size and every other size of
    the same product, unit cost and list price, the shortfall in the requested
    size, and the totals at list price and at cost. It does not choose a
    discount; cost is the floor below which the shop loses money.
    """
    with _connect() as conn:
        ticket = _get_ticket(conn, ticket_id, "price_override")

        sizes = _all(
            conn,
            "SELECT size, qty, location FROM inventory WHERE sku = ? ORDER BY rowid",
            (ticket["sku"],),
        )
        price = _one(conn, "SELECT unit_cost, list_price FROM pricing WHERE sku = ?",
                     (ticket["sku"],))
        name = _one(conn, "SELECT name FROM inventory WHERE sku = ? LIMIT 1", (ticket["sku"],))

        requested = next((s for s in sizes if s["size"] == ticket["size"]), None)
        qty = ticket["qty"]
        result = {
            "shop_date": _shop_today(conn),
            "ticket": ticket,
            "product_name": name["name"] if name else None,
            "requested_size_stock": requested,
            "all_sizes_stock": sizes,
            "shortfall_in_requested_size": (
                max(0, qty - requested["qty"]) if requested and qty else None
            ),
            "pricing": price,
        }
        if price and qty:
            result["total_at_list_price"] = price["list_price"] * qty
            result["total_at_cost"] = price["unit_cost"] * qty
            result["max_discount_before_loss_pct"] = round(
                100 * (1 - price["unit_cost"] / price["list_price"]), 1
            )
        return result


# ---------------------------------------------------------------------------
# Ticket tools (any agent)
# ---------------------------------------------------------------------------


@mcp.tool()
def list_open_tickets() -> list[dict]:
    """List every ticket that isn't closed: id, type, requester, subject, created_at."""
    with _connect() as conn:
        return _all(
            conn,
            """SELECT id, type, requester, subject, status, created_at FROM tickets
               WHERE status != 'closed' ORDER BY created_at""",
        )


@mcp.tool()
def get_ticket(ticket_id: int) -> dict:
    """Read one ticket in full, plus the shop's date and every note, draft, and
    payment request agents have already recorded on it."""
    with _connect() as conn:
        ticket = _one(conn, "SELECT * FROM tickets WHERE id = ?", (ticket_id,))
        if ticket is None:
            raise ValueError(f"No ticket with id {ticket_id}.")
        has_agent_tables = _one(
            conn, "SELECT 1 FROM sqlite_master WHERE type='table' AND name='ticket_notes'"
        )
        history = {}
        if has_agent_tables:
            for table in ("ticket_notes", "drafts", "payment_requests"):
                history[table] = _all(
                    conn, f"SELECT * FROM {table} WHERE ticket_id = ? ORDER BY id", (ticket_id,)
                )
        return {"shop_date": _shop_today(conn), "ticket": ticket, **history}


@mcp.tool()
def add_ticket_note(ticket_id: int, agent: str, note: str) -> dict:
    """Record a finding or decision on a ticket so the next agent can see it.
    `agent` is your own name (boss, inventory, accounting, facilities, customer_service)."""
    _check_agent(agent)
    conn = _connect_rw()
    with conn:
        if not _one(conn, "SELECT 1 FROM tickets WHERE id = ?", (ticket_id,)):
            raise ValueError(f"No ticket with id {ticket_id}.")
        cur = conn.execute(
            "INSERT INTO ticket_notes (ticket_id, agent, note, created_at) VALUES (?, ?, ?, ?)",
            (ticket_id, agent, note, _now()),
        )
    conn.close()
    return {"note_id": cur.lastrowid, "ticket_id": ticket_id, "saved": True}


@mcp.tool()
def close_ticket(ticket_id: int, agent: str, resolution: str) -> dict:
    """Mark a ticket closed with a one-line resolution. Refuses if no agent has
    recorded a note or draft on it yet, so a ticket can't be closed blind."""
    _check_agent(agent)
    conn = _connect_rw()
    with conn:
        ticket = _one(conn, "SELECT status FROM tickets WHERE id = ?", (ticket_id,))
        if ticket is None:
            raise ValueError(f"No ticket with id {ticket_id}.")
        if ticket["status"] == "closed":
            raise ValueError(f"Ticket {ticket_id} is already closed.")
        work = _one(
            conn,
            """SELECT (SELECT COUNT(*) FROM ticket_notes WHERE ticket_id = ?)
                    + (SELECT COUNT(*) FROM drafts WHERE ticket_id = ?) AS n""",
            (ticket_id, ticket_id),
        )
        if work["n"] == 0:
            raise ValueError("Record a note or draft on this ticket before closing it.")
        conn.execute("UPDATE tickets SET status = 'closed' WHERE id = ?", (ticket_id,))
        conn.execute(
            "INSERT INTO ticket_notes (ticket_id, agent, note, created_at) VALUES (?, ?, ?, ?)",
            (ticket_id, agent, f"CLOSED: {resolution}", _now()),
        )
    conn.close()
    return {"ticket_id": ticket_id, "status": "closed", "resolution": resolution}


# ---------------------------------------------------------------------------
# Customer Service tools
# ---------------------------------------------------------------------------


@mcp.tool()
def draft_customer_reply(ticket_id: int, agent: str, message: str) -> dict:
    """Save a reply to the ticket's requester as a DRAFT. Nothing is sent; a
    human reviews and sends it. Only state facts a tool returned."""
    _check_agent(agent)
    conn = _connect_rw()
    with conn:
        ticket = _one(conn, "SELECT requester FROM tickets WHERE id = ?", (ticket_id,))
        if ticket is None:
            raise ValueError(f"No ticket with id {ticket_id}.")
        cur = conn.execute(
            """INSERT INTO drafts (ticket_id, kind, agent, recipient, body, status, created_at)
               VALUES (?, 'customer_reply', ?, ?, ?, 'needs_human_review', ?)""",
            (ticket_id, agent, ticket["requester"], message, _now()),
        )
    conn.close()
    return {"draft_id": cur.lastrowid, "recipient": ticket["requester"],
            "status": "needs_human_review", "sent": False}


# ---------------------------------------------------------------------------
# Pricing tool (bulk quotes)
# ---------------------------------------------------------------------------


@mcp.tool()
def draft_bulk_quote(ticket_id: int, agent: str, discount_pct: float, qty: int) -> dict:
    """Price a bulk order for a price_override ticket and save it as a draft quote.

    The server works out every number from pricing and inventory. It refuses a
    price below unit cost or more units than are in stock in the requested size.
    Discounts above the shop's auto-approve limit are saved as needing the
    owner's approval. Nothing is sent to the customer.
    """
    _check_agent(agent)
    if discount_pct < 0:
        raise ValueError("discount_pct can't be negative.")
    if qty <= 0:
        raise ValueError("qty must be at least 1.")
    conn = _connect_rw()
    with conn:
        ticket = _get_ticket(conn, ticket_id, "price_override")
        price = _one(conn, "SELECT unit_cost, list_price FROM pricing WHERE sku = ?",
                     (ticket["sku"],))
        stock = _one(conn, "SELECT name, qty FROM inventory WHERE sku = ? AND size = ?",
                     (ticket["sku"], ticket["size"]))
        if price is None or stock is None:
            raise ValueError(f"No pricing or stock on file for {ticket['sku']} {ticket['size']}.")
        if qty > stock["qty"]:
            raise ValueError(
                f"Only {stock['qty']} in stock in size {ticket['size']}; can't quote {qty}."
            )
        unit_price = round(price["list_price"] * (1 - discount_pct / 100), 2)
        if unit_price < price["unit_cost"]:
            raise ValueError(
                f"${unit_price} per unit is below cost (${price['unit_cost']}). Lower the discount."
            )
        status = ("draft" if discount_pct <= MAX_AUTO_DISCOUNT_PCT
                  else "needs_owner_approval")
        quote = {
            "sku": ticket["sku"], "product": stock["name"], "size": ticket["size"],
            "qty": qty, "requested_qty": ticket["qty"], "list_price": price["list_price"],
            "discount_pct": discount_pct, "unit_price": unit_price,
            "total": round(unit_price * qty, 2),
            "margin_per_unit": round(unit_price - price["unit_cost"], 2),
            "auto_approve_limit_pct": MAX_AUTO_DISCOUNT_PCT, "status": status,
        }
        body = (f"{qty} x {stock['name']} ({ticket['size']}) at ${unit_price} each "
                f"({discount_pct}% off ${price['list_price']}) = ${quote['total']}")
        cur = conn.execute(
            """INSERT INTO drafts (ticket_id, kind, agent, recipient, body, status, created_at)
               VALUES (?, 'quote', ?, ?, ?, ?, ?)""",
            (ticket_id, agent, ticket["requester"], body, status, _now()),
        )
    conn.close()
    return {"draft_id": cur.lastrowid, **quote, "sent": False}


# ---------------------------------------------------------------------------
# Accounting tool (money never moves; a human approves)
# ---------------------------------------------------------------------------


@mcp.tool()
def request_payment_approval(ticket_id: int, agent: str, kind: str, ref_id: int,
                             reason: str, account: str = "checking") -> dict:
    """Ask a human to approve paying a lease's rent (kind='rent', ref_id=lease id)
    or a vendor invoice (kind='invoice', ref_id=invoice id).

    The amount and payee come from the database, not from the agent. Refuses if
    the bill is already paid or already requested, or if the account can't cover
    it. No money moves and nothing is written to `payments`.
    """
    _check_agent(agent)
    conn = _connect_rw()
    with conn:
        if not _one(conn, "SELECT 1 FROM tickets WHERE id = ?", (ticket_id,)):
            raise ValueError(f"No ticket with id {ticket_id}.")
        if kind == "rent":
            bill = _one(conn, "SELECT landlord AS payee, monthly_rent AS amount FROM leases WHERE id = ?",
                        (ref_id,))
        elif kind == "invoice":
            bill = _one(
                conn,
                """SELECT v.name AS payee, i.amount, i.status FROM invoices i
                   JOIN vendors v ON v.id = i.vendor_id WHERE i.id = ?""",
                (ref_id,),
            )
            if bill and bill["status"] != "open":
                raise ValueError(f"Invoice {ref_id} is '{bill['status']}', not open.")
        else:
            raise ValueError("kind must be 'rent' or 'invoice'.")
        if bill is None:
            raise ValueError(f"No {kind} with id {ref_id}.")

        paid = _one(conn, "SELECT id FROM payments WHERE kind = ? AND ref_id = ?", (kind, ref_id))
        if kind == "invoice" and paid:
            raise ValueError(f"Invoice {ref_id} already has payment #{paid['id']}.")
        dupe = _one(
            conn,
            "SELECT id FROM payment_requests WHERE kind = ? AND ref_id = ? AND status = 'pending'",
            (kind, ref_id),
        )
        if dupe:
            raise ValueError(f"A pending request (#{dupe['id']}) already exists for this {kind}.")

        acct = _one(conn, "SELECT balance FROM cash_accounts WHERE name = ?", (account,))
        if acct is None:
            raise ValueError(f"No cash account named '{account}'.")
        already_pending = _one(
            conn,
            "SELECT COALESCE(SUM(amount), 0) AS s FROM payment_requests WHERE account = ? AND status = 'pending'",
            (account,),
        )["s"]
        available = acct["balance"] - already_pending
        if bill["amount"] > available:
            raise ValueError(
                f"{account} has ${available} after pending requests; can't cover ${bill['amount']}."
            )
        cur = conn.execute(
            """INSERT INTO payment_requests
               (ticket_id, kind, ref_id, payee, amount, account, requested_by, reason, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (ticket_id, kind, ref_id, bill["payee"], bill["amount"], account, agent, reason, _now()),
        )
    conn.close()
    return {
        "request_id": cur.lastrowid, "kind": kind, "ref_id": ref_id, "payee": bill["payee"],
        "amount": bill["amount"], "account": account, "status": "pending",
        "account_left_if_all_pending_approved": available - bill["amount"],
        "money_moved": False,
    }


_init_agent_tables()

if __name__ == "__main__":
    mcp.run()
