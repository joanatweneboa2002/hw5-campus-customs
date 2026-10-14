# AI Prompts Log: Homework 5

A record of the prompts I used with Claude Code for each Homework 5 problem.

---

## Problem 1: Vibe coder prompts

**Prompt:**

> Ok we are ready to roll! P1. make me an AI_prompts.md in the project root with a section for each of the 11 HW5 problems. each section needs the problem number and title, a spot for my prompt, a spot for a follow up, and a line for what was missing the first time. leave them blank, I'll fill them in as I go

**What the first prompt was missing:**

The problem titles. I didn't give Claude the assignment.

---

## Problem 2: Study the database

**Prompt:**

> hey, open data/campus_customs.db and walk me through every table and its columns. then copy it to data/campus_customs_new.db, we'll only work on the copy from now on. look at the 3 open tickets (101, 102, 103) and show me which other tables each one connects to. then start output/harness.md: every table, its fields, and one short line on why the agents would need it

**Follow-up prompt:**

> P2:Study the database... THATS THE TITLE FOR THE PREVIOUS PROMPT. Update it in prompts log

**What the first prompt was missing:**

The problem number and title for the log.

---

## Problem 3: Build the MCP server

**Prompt:**

> Problem 3: MCP servers: now build an MCP server in mcp_server/server.py using FastMCP, pointed at data/campus_customs_new.db. I want 3 tools, one for each open ticket, built around what that ticket actually needs from the db. clear names, and never invent data. add a section to harness.md listing each tool, the table it reads, the ticket it helps with, and one sentence on why. then write a short mcp_server/README.md: what it's for, which db it uses, the 3 tools

**Follow-up prompt:**

> I put my 3 board screenshots in the folder.  can you see them? make output/resolved_board.html, a simple page I can double click to open that shows each screenshot with its ticket number above it. use relative paths so it still works after I push to GitHub, then open it and check that all 3 images actually load

> This is not problem 9 yet. I will prompt you when problem 9. Can you see the screenshots now? arethey are the three items?

> so what is the problem? What should i do?

> This is 103. can you see them? save them as a folder in outputs for future records, and work with them for the prompts i gave.

**What the first prompt was missing:**

A package version (`mcp` 2.x renamed FastMCP, so it pinned `mcp<2`). For the screenshot page: one saved file per ticket. My first 3 all showed ticket 101.

---

## Problem 4: Add the MCP server to vibe coder and test each tool

**Prompt:**

> P4: Connect and test the tools connect my MCP server to you so you can call its tools. save the config as .mcp.json in the project root, and also add it wherever Codex needs it to actually load

**Follow-up prompt:**

> I dot understand??? i mentioned that everything we are doing SHOULD BE in Hw5 folder, so wym by it wont pick up HW5?

> so basically i should close the opened app and reopen it? and then open the HW5 folder?

> did it work?

> save those 3 tests in output/mcp_smoke.json: my prompt, the tool name, and the exact output for each. then query the db directly and confirm the outputs match

**What the first prompt was missing:**

That Claude Code was open on the parent folder and needed a reload to load the server, and that the tests should be saved and checked against the db.

---

## Problem 5: Agent team

**Prompt:**

> P5: Agent team. uild 5 PydanticAI agents: Boss, Inventory, Accounting, Facilities, and Customer Service. all use gpt-6-luna through Portkey with my OPEN AI KEY from .env. Boss reads the ticket and delegates, and any agent can hand off to any other. shop facts only come from my MCP server, no separate tools layer. if agents need more tools to close the tickets, add them to the MCP server. one prompt file per agent in backend/prompts/, data types in backend/models.py. every agent loop step appends to output/audit_trail.json and never wipes it. update harness.md with every agent, every tool and its table, a safety section (guardrails for real customers and money, plus token limits), and update the MCP README

**What the first prompt was missing:**

A check that the agents really went through Portkey. They called OpenAI directly until the Problem 11 fix.

---

## Problem 6: Plan the tickets

**Prompt:**

> P6. Plan the tickets make output/desk_tickets.html, one page with tabs for Ticket 101, 102, 103, plus Cash and Reflection tabs that say coming later. each ticket tab gets an Expected section and an empty Actual section. here's my plan: 101: Boss calls [agent] first because [why], then [handoffs], using [tools]. 102: ... 103: ...

**What the first prompt was missing:**

My actual plan. I left `[agent]`, `[why]`, `[handoffs]` and `[tools]` blank.

---

## Problem 7: Backend routes

**Prompt:**

> P7. Backend routes Build a FastAPI backend in backend/main.py for my React board. routes: list the 3 tickets and whether each is open or resolved, run the agent team on a ticket by id, return recent agent events (what each agent said and which tools it used), approve a payment or purchase after a human clicks approve, get the checking balance from cash_accounts, and reset the db. agents can only prepare payments, the approve route is the only thing that touches cash. it should run with uvicorn main:app --reload --port 8000 from backend/. add each route to harness.md on one line with its URL and what it does

**What the first prompt was missing:**

That an old server was already on port 8000, so every route returned 404 until it was stopped.

---

## Problem 8: Dashboard

**Prompt:**

> P8. Dashboard build a React + Vite + TypeScript dashboard in frontend/ that calls my backend at localhost:8000 (add CORS for localhost:5173). list the 3 tickets, let me pick one and run the agents, show each agent's messages live, mark the ticket resolved when done, show a short summary of what each agent did, give me an approve button when a payment needs sign off, and show the checking balance so I can watch it drop. make it look like earthy rusty theme. each agent with its own color and icon, nothing like the default Vite page. then write output/design.md on the layout, how agents look different, how resolved tickets and cash show up, and why

**Follow-up prompt:**

> I dont like the colors, they are too dark and hurting my eyes.Ok, lets do pink intead, light shades of pink only.

> I still do not like it. Ok, lets do plain colors... this is hurting my eyes

> This is what i am thinking for the design in P8. https://www.pinterest.com/pin/1123788913274357287/ CAN YOU SEE IT? REDESIGN MY PAGE WITH THESE COLORS AND LET THEM look this cool

> Come on! the actual template is waaay cooler. Cant we do smth cbetter? act like a web page designer

> Looks better, one final stretch. give me your best work so far, I know you can do it i BELIEVE IN YOU

**What the first prompt was missing:**

A design reference. Earthy, pink and plain all missed. The Pinterest template finally gave it a target.

---

## Problem 9: Resolve the tickets

**Prompt:**

> ok I ran all 3 tickets and my screenshots are in output/screenshots/ (ticket_101.png, ticket_102.png, ticket_103.png). use audit_trail.json and the db to fill in the Actual section for each ticket in desk_tickets.html right next to my Expected (which agents worked, who handed off to who, which tools). fill the Cash tab with the starting balance, every payment per ticket with what it was for and how much, and the ending balance, and make sure it matches cash_accounts. then make output/resolved_tickets.json (id, status, outcome, what each agent did, any approvals) and output/resolved_board.html, a page I can double click that shows my 3 screenshots with the ticket number above each one, using relative paths. finish harness.md so it covers tables, tools, agents, routes, dashboard and safety. at the end, double check the cash math and show me the numbers

---

## Problem 10: Reflection

**Prompt:**

> let's do the reflection. go through audit_trail.json, my ticket tabs, and the Cash tab and pull the facts for each ticket: what actually happened vs my Expected plan, which agents and tools were used, and the dollar amounts. then fill in the Reflection tab in desk_tickets.html with these 5 answers: how I'd judge the agents on each ticket and why, how Actual compared to Expected for 101, 102 and 103, what would've been simpler with just one agent and tools, 3 new problems Campus Customs could have that this team could handle with the tools we built, and 3 it couldn't handle, plus what tools and agents we'd need for each. keep it specific to this app with ticket ids and dollar amounts, nothing generic, and write it casual like me, not like an essay. no separate markdown file, it all goes in the Reflection tab

---

## Problem 11: Submit to GitHub

**Prompt:**

> last one, let's get this ready to submit. delete joke.txt and the extra screenshots/ folder in the root since the real ones are in output/screenshots/. make a .gitignore that leaves out .env, .venv, node_modules, and .DS_Store, and add a .env.example with no real keys. add a requirements.txt and check the folder layout matches the HW5 expected layout. write a README that explains how to copy campus_customs.db to campus_customs_new.db, start the MCP server, start the backend, start the React board, and reset the db before a full 3 ticket run. search the whole project to make sure my Portkey key isn't anywhere. then push it to a new public GitHub repo, save the URL in output/github_url.txt, and make hw5.zip with the same files

**Follow-up prompt:**

> found a couple things before I submit. P5 says the agents have to use gpt-6-luna through Portkey with my PORTKEY_API_KEY, but backend/agents.py uses OPENAI_API_KEY and doesn't go through Portkey. switch it to use PORTKEY_API_KEY with base_url https://api.portkey.ai/v1, and update .env.example, the README and harness.md so they say Portkey too. then run one quick ticket to make sure it still works, but don't touch my desk_tickets.html, audit results or the cash numbers. also fix the titles in AI_prompts.md: Problem 1 should be "Vibe coder prompts", Problem 3 "Build the MCP server", Problem 4 "Add the MCP server to vibe coder and test each tool". then commit, push to GitHub, and rebuild hw5.zip so it matches, log this as a follow up after prompt 11.

**What the first prompt was missing:**

A "wait for my review before pushing" step, and a check that the agents used Portkey. They used `OPENAI_API_KEY`, and an old key in `~/.zshrc` overrode `.env`.
