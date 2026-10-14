# HW5 · Campus Customs Agent Desk

Five PydanticAI agents (Boss, Inventory, Accounting, Facilities, Customer Service) work the Campus Customs ticket queue. Every shop fact comes from an MCP server over a SQLite database. A FastAPI backend runs the agents, and a React board lets a human watch them and approve payments. Agents can only *prepare* payments; money moves only when a person clicks **Approve & pay**.

## Folder layout

```
HW 5/
├── AI_prompts.md            prompt log for Problems 1–11
├── README.md
├── requirements.txt         Python deps (MCP server + backend)
├── .env.example             copy to .env and add your keys
├── .mcp.json                registers the MCP server (paths relative to this folder)
├── data/
│   ├── campus_customs.db    original, never modified
│   └── campus_customs_new.db  working copy the agents use
├── mcp_server/              FastMCP server: 10 tools (server.py, README.md)
├── backend/                 FastAPI routes (main.py), agents (agents.py), loop (run.py),
│   └── prompts/             data types (models.py), one prompt per agent
├── frontend/                React + Vite + TypeScript board
└── output/
    ├── harness.md           tables, tools, agents, routes, dashboard, safety
    ├── mcp_smoke.json       MCP tool tests checked against the db
    ├── audit_trail.json     every agent step, append-only
    ├── design.md            board design notes
    ├── desk_tickets.html    Expected vs Actual per ticket, Cash, Reflection
    ├── resolved_tickets.json
    ├── resolved_board.html  screenshot of each resolved ticket
    ├── screenshots/
    └── github_url.txt
```

## Setup (once)

Needs Python 3.12+ and Node 20+.

```bash
cd "HW 5"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then put your real keys in .env
```

The agents call `gpt-6-luna` through **Portkey** (`https://api.portkey.ai/v1`), using `PORTKEY_API_KEY` from `.env`. The key in `.env` wins over any `PORTKEY_API_KEY` already exported in your shell. Set `CAMPUS_MODEL` in `.env` to use a different model.

## 1. Copy the database

The agents only ever touch the working copy. Make it from the original:

```bash
cp data/campus_customs.db data/campus_customs_new.db
```

## 2. Start the MCP server

```bash
source .venv/bin/activate
python mcp_server/server.py
```

It runs over stdio, so it just waits for a client; press Ctrl+C to stop it. Running it by hand is only a check that it starts. The backend starts its own copy for each agent run from `.mcp.json`, and Claude Code loads it from the same file.

## 3. Start the backend

In a new terminal:

```bash
cd "HW 5/backend"
source ../.venv/bin/activate
uvicorn main:app --reload --port 8000
```

Check it at http://localhost:8000/tickets.

## 4. Start the React board

In another terminal:

```bash
cd "HW 5/frontend"
npm install
npm run dev
```

Open http://localhost:5173.

## 5. Reset, then do a full 3-ticket run

The working db in this repo is the state *after* the run, with all 3 tickets resolved. Reset it before running again:

- click **Reset shop** on the board, or
- `curl -X POST http://localhost:8000/reset`, or
- with the backend stopped, `cp data/campus_customs.db data/campus_customs_new.db`.

The reset copies the original db over the working copy. The audit trail is kept. Checking goes back to $3,400 and tickets 101, 102 and 103 reopen.

Then on the board:

1. Click **Run agents** on **101**, **102** and **103**, one at a time. Each agent's messages appear live.
2. Payments the agents prepare show up under **Needs your sign-off**. Type your name in **Approving as** and click **Approve & pay** (or **Reject**). Ticket 101 asks for the $840 reprint invoice and 102 asks for the $2,400 rent.
3. Watch the checking balance in the header drop as you approve.

You can also run the agents without the board: `python -m backend.run` from `HW 5`, or `python -m backend.run 101` for one ticket.

## Results from my run

| Ticket | Result |
|---|---|
| 101 Bulldog tee | Size S out of stock. Reply drafted. $840 invoice #501 approved and paid. |
| 102 Rent due | Notice verified against lease 1. $2,400 rent request still pending. |
| 103 Bulk hoodie discount | Quote for the 8 in stock at $52.20 each ($417.60). Reply drafted. |

Checking: $3,400.00 − $840.00 = **$2,560.00**. Full details are in `output/desk_tickets.html` and `output/resolved_tickets.json`.
