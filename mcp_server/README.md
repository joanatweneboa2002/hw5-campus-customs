# Campus Customs MCP Server

An MCP server that gives the Campus Customs agent team, and any MCP client, the shop's data.

- **Facts:** it never makes up values. If something isn't in the database, it comes back as `null` or as an error.
- **Writes:** it never moves money or contacts a customer. Write tools only save notes, drafts and payment requests for a human to approve. They take every amount from the database, not from the agent.

**Database:** `data/campus_customs_new.db` (the working copy; the original `data/campus_customs.db` isn't touched). On first start the server adds three tables for agent work: `ticket_notes`, `drafts`, `payment_requests`.

## Tools

### Read (database opened read-only)
| Tool | What it returns |
|---|---|
| `list_open_tickets()` | Every ticket that isn't closed. |
| `get_ticket(ticket_id)` | The ticket, the shop date, and all notes, drafts and payment requests on it. |
| `check_order_fulfillment(ticket_id)` | Ticket 101 and other customer orders: stock for the SKU and size, list price, linked vendor invoice with lead time and days overdue. |
| `check_rent_payment(ticket_id)` | Ticket 102 and other rent notices: the lease, whether the requester matches the landlord, days until due, cash, open invoices, cash left after paying. |
| `check_bulk_discount(ticket_id)` | Ticket 103 and other price overrides: stock for every size, shortfall, cost vs. list price, biggest discount before a loss. |

### Write (record only)
| Tool | What it does | Guardrail |
|---|---|---|
| `add_ticket_note(ticket_id, agent, note)` | Saves a finding on the ticket. | `agent` must be one of the five agents. |
| `draft_customer_reply(ticket_id, agent, message)` | Saves a reply to the requester. | Status `needs_human_review`. Never sent. |
| `draft_bulk_quote(ticket_id, agent, discount_pct, qty)` | Prices a bulk order and saves the quote. | Refuses prices below cost and more units than in stock. Discounts above 15% need owner approval. |
| `request_payment_approval(ticket_id, agent, kind, ref_id, reason, account)` | Asks a human to pay rent or an invoice. | Amount and payee come from the db. Refuses double payments and overdrafts. Never writes to `payments`. |
| `close_ticket(ticket_id, agent, resolution)` | Closes a ticket. | Only if work was recorded on it. |

## Run it

From the `HW 5` folder:

```bash
source .venv/bin/activate
pip install -r mcp_server/requirements.txt
python mcp_server/server.py
```

It runs over stdio. Claude Code loads it from `.mcp.json`, Codex loads it from `~/.codex/config.toml`, and the agent team in `backend/` starts it from the same `.mcp.json`.
