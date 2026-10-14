# Campus Customs Agent Harness

Working database: `data/campus_customs_new.db` (a copy; the original `data/campus_customs.db` stays untouched).

---

## Tables

### desk
The shop's "today" and general notes.

| Field | Why the agents need it |
|---|---|
| date_today | The shop's current date (2026-08-31). Agents judge "overdue" and "due soon" against it, not the real clock. |
| notes | Free-text notes for the shift that any agent can read. |

### tickets
The work queue. Every request starts here.

| Field | Why the agents need it |
|---|---|
| id | Lets an agent refer to and update one specific request. |
| type | Decides which agent handles it (customer_order, rent_notice, price_override). |
| requester | Who's asking, so the reply goes to the right person. |
| subject | A short summary of the request. |
| sku | Links to inventory and pricing when the ticket is about a product. |
| size | Together with sku, picks out the exact inventory row. |
| qty | How many units are wanted, to check against stock. |
| lease_id | Links to leases when the ticket is about rent. |
| invoice_id | Links to invoices when the ticket depends on a vendor bill. |
| status | Shows whether the ticket is open or closed, so agents don't redo finished work. |
| notes | The original message, with details the structured fields miss. |
| created_at | When it came in, for handling oldest first. |

### inventory
What's on the shelves.

| Field | Why the agents need it |
|---|---|
| sku | Product ID that links to pricing and tickets. |
| name | The readable product name to use in replies. |
| size | Stock is tracked per size, so an order needs sku plus size. |
| qty | Units in stock. Shows whether an order can be filled now. |
| location | Where to pick the item from (aisle). |

### pricing
Cost and price for each product.

| Field | Why the agents need it |
|---|---|
| sku | Links to inventory and tickets. |
| unit_cost | What the shop pays for one unit. Sets the lowest price a discount can go without losing money. |
| list_price | The normal selling price. The starting point for quotes and discounts. |

### vendors
Suppliers the shop can call on.

| Field | Why the agents need it |
|---|---|
| id | Links to invoices. |
| name | Who to contact. |
| specialty | What they supply, for picking the right vendor to restock or reprint. |
| lead_days | How long they take to deliver. Lets agents give customers a realistic date. |

### invoices
Bills the shop owes to vendors.

| Field | Why the agents need it |
|---|---|
| id | Lets tickets and payments point at a specific bill. |
| vendor_id | Which vendor sent the bill. |
| amount | How much is owed. Needed to check cash before paying. |
| due_date | When it must be paid, compared against desk.date_today. |
| status | Shows whether the bill is open or paid, to avoid paying it twice. |
| description | What the bill is for, to connect it to a product or order. |

### leases
The shop's rented space.

| Field | Why the agents need it |
|---|---|
| id | Links to rent tickets. |
| space_name | Which space the rent is for. |
| landlord | Who gets paid. Should match the ticket's requester. |
| monthly_rent | How much rent is due. |
| next_due | When rent is due next. |
| notes | Extra lease terms or reminders. |

### cash_accounts
Money the shop has on hand.

| Field | Why the agents need it |
|---|---|
| name | Which account (checking) to pay from. |
| balance | Available cash. Agents must check it before approving any payment. |
| date | When the balance was last updated. |

### payments
A log of money paid out. Empty at the start. After the ticket runs it has 1 row: $840 for invoice 501, approved by Joana.

| Field | Why the agents need it |
|---|---|
| id | Gives each payment a unique record. |
| kind | What was paid (rent, invoice, ...). |
| ref_id | The lease or invoice the payment covers. |
| amount | How much was paid. |
| account | Which cash account it came from. |
| paid_at | When it was paid. |
| approved_by | Who approved it. A paper trail so no payment happens without sign-off. |

---

## Open tickets and what they connect to

| Ticket | Request | Connects to |
|---|---|---|
| 101 customer_order | Tauhid Zaman wants 1 Classic Bulldog Tee, size S | **inventory** (CC-TEE-WHITE S: 0 in stock), **pricing** ($28 list), **invoices** #501 → **vendors** #1 Bulldog Print Co |
| 102 rent_notice | Elm City Properties: rent due in 2 days | **leases** #1 (Chapel Street shop, $2,400, due 2026-09-02), **cash_accounts**, **payments** |
| 103 price_override | Yale AI Club wants 20 navy hoodies, size M, at a bulk discount | **inventory** (CC-HOOD-NAVY M: only 8 in stock), **pricing** ($22 cost / $58 list) |

---

## Agent-written tables

The MCP server creates these in the working copy the first time it starts. The original shop tables keep their structure. Agents can only change `tickets.status`, and only through `close_ticket`.

| Table | Fields | Why the agents need it |
|---|---|---|
| ticket_notes | id, ticket_id, agent, note, created_at | Shared case file, so each agent sees what the last one found and doesn't redo it. |
| drafts | id, ticket_id, kind, agent, recipient, body, status, created_at | Customer replies and quotes wait here for a human. Nothing is sent. |
| payment_requests | id, ticket_id, kind, ref_id, payee, amount, account, requested_by, reason, status, created_at | Payments wait here for human approval. Agents never write to `payments`. |

---

## Agents

Five PydanticAI agents on `gpt-6-luna`, called through the Portkey gateway (`base_url` `https://api.portkey.ai/v1`) with `PORTKEY_API_KEY` from `.env`. Code is in `backend/`, prompts are in `backend/prompts/<agent>.md`, and data types are in `backend/models.py`. Every shop fact comes from the MCP server. There's no separate tools layer.

| Agent | Job | MCP tools it may call |
|---|---|---|
| **Boss** | Reads each new ticket, delegates, and closes it once the work is done. | get_ticket, list_open_tickets, add_ticket_note, close_ticket |
| **Inventory** | Stock by SKU and size, shortfalls, restock and reprint status. | get_ticket, add_ticket_note, check_order_fulfillment, check_bulk_discount |
| **Accounting** | Cash, vendor invoices, rent payments, discounts and quotes. | get_ticket, add_ticket_note, check_rent_payment, check_order_fulfillment, check_bulk_discount, draft_bulk_quote, request_payment_approval |
| **Facilities** | The lease and landlord. Checks that rent notices are genuine. | get_ticket, add_ticket_note, check_rent_payment |
| **Customer Service** | Drafts replies to customers and student groups. | get_ticket, add_ticket_note, check_order_fulfillment, check_bulk_discount, draft_customer_reply |

**Handoffs:** each turn ends with an `AgentStep`:
- `handoff` passes the ticket to any of the five agents.
- `done` means the ticket was closed.
- `needs_human` stops the loop for a person.

Boss always goes first. A handoff with no target, or back to the same agent, goes to Boss.

**Run it:** from `HW 5`, run `python -m backend.run`, or `python -m backend.run 101` for one ticket.

**Audit:** every agent turn appends one entry to `output/audit_trail.json`. Each entry records the time, run id, ticket, step, agent, prompt, each tool call with its args and result, the `AgentStep`, any error, and token counts. The file is only ever added to. If it isn't a valid JSON list, the run stops instead of overwriting it.

---

## MCP tools

Server: `mcp_server/server.py` (FastMCP) on `data/campus_customs_new.db`. Read tools open the database read-only. Write tools only record notes, drafts and requests.

| Tool | Tables | Reads / writes | Ticket | Why |
|---|---|---|---|---|
| `list_open_tickets` | tickets | read | all | Gives the loop and Boss the work queue without guessing ticket ids. |
| `get_ticket` | tickets, desk, ticket_notes, drafts, payment_requests | read | all | Shows every agent the ticket plus what's already been done, so work isn't repeated or contradicted. |
| `check_order_fulfillment` | tickets, desk, inventory, pricing, invoices, vendors | read | 101 | Shows the tee in size S is out of stock and that the reprint covering it (invoice #501, Bulldog Print Co, 5-day lead) is still unpaid and overdue, so the agent can give the customer an honest answer. |
| `check_rent_payment` | tickets, desk, leases, cash_accounts, invoices, vendors, payments | read | 102 | Confirms the notice matches the lease and landlord on file, shows days until due, and shows what's left in cash after rent and other open bills, so the agent doesn't pay a fake notice or overdraw the account. |
| `check_bulk_discount` | tickets, desk, inventory, pricing | read | 103 | Gives stock for every hoodie size, the shortfall in M, and the cost floor for any discount, so the agent can make an offer without losing money or promising stock the shop doesn't have. |
| `add_ticket_note` | tickets → ticket_notes | write | all | Lets one agent leave findings for the next, which is how handoffs carry context. |
| `draft_customer_reply` | tickets → drafts | write | 101, 103 | Saves the customer reply for a human to check and send, so no AI text reaches a real customer unreviewed. |
| `draft_bulk_quote` | tickets, pricing, inventory → drafts | write | 103 | The server does all the price math and refuses prices below cost or quantities above stock, so a quote can't lose money or promise hoodies the shop doesn't have. |
| `request_payment_approval` | leases / invoices, vendors, payments, cash_accounts → payment_requests | write | 101, 102 | Takes the amount and payee from the db, blocks double payments and overdrafts, and leaves the actual payment to a human. |
| `close_ticket` | tickets, ticket_notes, drafts → tickets.status, ticket_notes | write | all | Closes only tickets with recorded work and logs the resolution. |

---

## Backend routes

FastAPI app in `backend/main.py` for the React board. Run it from `backend/` with `uvicorn main:app --reload --port 8000`. It allows requests from the Vite dev server at `localhost:5173`.

- `GET /tickets`: lists every ticket with its type, requester, subject, and `state` (`open`, or `resolved` once closed).
- `POST /tickets/{id}/run`: runs the agent team on one ticket and returns the result. Refuses resolved tickets and runs that overlap.
- `GET /events?limit=30&ticket_id=`: recent agent steps from `output/audit_trail.json`, newest first: what each agent said, who it handed to, which tools it used, and tokens.
- `GET /approvals?status=pending`: payment requests the agents prepared, waiting for a human.
- `POST /approvals/{id}/approve`: a human clicked approve (body `{"approved_by": "name"}`). In one transaction it re-checks the bill and the balance, writes to `payments`, takes the amount out of `cash_accounts`, and marks the invoice paid. **This is the only code that touches cash.**
- `POST /approvals/{id}/reject`: a human clicked reject. Marks the request rejected and doesn't move any money.
- `GET /cash`: the checking balance from `cash_accounts`.
- `POST /reset`: copies the untouched `data/campus_customs.db` over the working copy. The audit trail is kept.

---

## Dashboard

React + Vite + TypeScript app in `frontend/`. It calls the backend at `localhost:8000`. Run it from `frontend/` with `npm run dev` and open `http://localhost:5173`. Full layout and styling notes are in `output/design.md`.

| Area | What it shows | Backend route |
|---|---|---|
| Header: checking card | Live balance, the drop this session, a sparkline, and the amount awaiting approval | `GET /cash`, `GET /approvals` |
| Header: Reset shop | Restores the original db | `POST /reset` |
| Left: Tickets | The 3 tickets with Open / ✓ Resolved and a **Run agents** button | `GET /tickets`, `POST /tickets/{id}/run` |
| Center: Live feed | Each agent's message as it finishes (polled every 1.2s), its tools, and who it hands to | `GET /events?ticket_id=` |
| Right: Needs your sign-off | Pending payments with **Approve & pay** (needs a name) and **Reject** | `POST /approvals/{id}/approve`, `/reject` |
| Right: Who did what | One short summary card per agent | `GET /events` |

| File | What it holds |
|---|---|
| `src/App.tsx` | The page, the polling, and the run and approve actions |
| `src/api.ts` | Typed calls to every backend route |
| `src/agents.tsx` | Each agent's color, icon and label |
| `src/index.css` | The plain theme: white, gray and agent-colored accents |

Each agent has its own color and icon (Boss slate/compass, Inventory amber/crate, Accounting green/coins, Facilities blue/storefront, Customer Service purple/speech bubble). Red only appears for warnings.

**Safety in the UI:** the dashboard can't move money by itself. **Approve & pay** stays disabled until someone types a name, and the backend re-checks the bill and balance before paying.

---

## Safety

### Real customers
- **Nothing is sent.** Replies and quotes go to `drafts` with status `needs_human_review` or `needs_owner_approval`. A person sends them.
- **Facts only from tools.** Every prompt says not to make up numbers, dates, names or stock. When something is unknown, agents say so.
- **No internal details in customer replies.** Customer Service is told never to mention cash, costs or unpaid invoices.
- **No promised delivery dates.** Replies may give the vendor lead time but never a date.
- **Least privilege.** Each agent only sees its own tools. For example, Customer Service can't request payments and Facilities can't draft quotes.

### Money
- **Agents can't pay anything.** No MCP tool writes to `payments` or `cash_accounts`. `request_payment_approval` only creates a `pending` request. Money only moves through `POST /approvals/{id}/approve`, after a person clicks approve. That route re-checks the bill and balance first and records who approved it.
- **Amounts come from the db.** The tool looks up the rent or invoice amount and payee itself, so an agent can't pay the wrong amount or person.
- **No double payments or overdrafts.** The tool refuses:
  - invoices that aren't open or are already paid,
  - a second pending request for the same bill,
  - any request that would take the account below zero once all pending requests are counted.
- **Fake rent notices go to a person.** Facilities checks the requester against the landlord on the lease. A mismatch goes to `needs_human` and is never passed to Accounting.
- **Discount limits.**
  - `draft_bulk_quote` refuses any price below unit cost.
  - Discounts above `MAX_AUTO_DISCOUNT_PCT` (15%, set in `server.py`) are marked `needs_owner_approval`.
  - It won't quote more units than are in stock.
- **Read-only reads.** Read tools open SQLite in read-only mode.
- **Working copy only.** Agents only touch `campus_customs_new.db`. `campus_customs.db` is the untouched original, and `campus_customs_new.before_agents.db` is a reset point.

### Token limits
| Limit | Value | Where |
|---|---|---|
| Max output tokens per model response | 2,000 | `backend/agents.py` (`MODEL_SETTINGS`) |
| Reasoning effort | low | `backend/agents.py` |
| Per agent turn | 10 requests, 8 tool calls, 40,000 total tokens | `backend/run.py` (`TURN_LIMITS`) |
| Per ticket | 10 agent turns, 150,000 total tokens | `backend/run.py` |
| Tool result size in the audit log | 2,000 characters | `backend/run.py` |

If a limit is hit, the loop logs it in the audit trail and stops that ticket instead of looping.

### First full run (2026-10-11)
| Ticket | Path | Result | Tokens |
|---|---|---|---|
| 101 | Boss → Inventory → Accounting → Boss → Customer Service → Boss | Closed. Reply drafted (out of stock, no date promised). $840 invoice #501 payment pending approval. | 42,132 |
| 102 | Boss → Facilities → Accounting → Boss | Closed. Notice checked as genuine. $2,400 rent payment pending approval. | 24,568 |
| 103 | Boss → Inventory → Accounting → Customer Service → Boss | Closed. Quote for 8 hoodies (the stock on hand) at 10% off ($52.20 each, $417.60 total). Reply drafted. | 33,504 |

### Resolved run from the board (2026-10-12)
These are the runs behind the current db, after a reset. Details are in `output/resolved_tickets.json` and the Actual tabs of `output/desk_tickets.html`. Screenshots are in `output/resolved_board.html`.

| Ticket | Path | Result | Tokens |
|---|---|---|---|
| 101 | Boss → Inventory → Customer Service → Boss → Accounting → Boss | Resolved. Reply drafted. $840 invoice #501 requested, then **approved by Joana and paid**. | 43,706 |
| 102 | Boss → Facilities → Accounting → Boss ⇄ Accounting (10-step limit), then a rerun where Boss closed it | Resolved. Notice verified. $2,400 rent request **still pending**. | 60,987 |
| 103 | Boss → Inventory → Accounting → Customer Service → Boss | Resolved. Quote for 8 hoodies at $52.20 ($417.60). Reply drafted. | 34,335 |

**Known issue:** on 102, Boss treated "waiting for a human to approve" as unfinished work and looped with Accounting until `MAX_STEPS_PER_TICKET` (10) stopped it. The step limit worked as a safety net, but steps 4–10 used 36,273 tokens. The fix is to have Boss close as soon as a payment request is pending.

### Cash check
| | Amount |
|---|---|
| Starting balance (original db) | $3,400.00 |
| Paid: invoice 501 (ticket 101) | −$840.00 |
| **Ending balance** | **$2,560.00**, which matches `cash_accounts` |
| Pending: rent (ticket 102) | $2,400.00, which would leave $160.00 if approved |
