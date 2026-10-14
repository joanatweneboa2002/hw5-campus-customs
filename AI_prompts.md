# AI Prompts Log: Homework 5

A record of the prompts I used with Claude Code for each Homework 5 problem.

---

## Problem 1: 

**Prompt:**

> Ok we are ready to roll! P1. make me an AI_prompts.md in the project root with a section for each of the 11 HW5 problems. each section needs the problem number and title, a spot for my prompt, a spot for a follow up, and a line for what was missing the first time. leave them blank, I'll fill them in as I go

**Follow-up prompt:**

> None.

**What the first prompt was missing:**

The problem titles. I didn't give Claude the HW5 assignment, so it couldn't fill in the section headers.

---

## Problem 2: Study the database

**Prompt:**

> hey, open data/campus_customs.db and walk me through every table and its columns. then copy it to data/campus_customs_new.db, we'll only work on the copy from now on. look at the 3 open tickets (101, 102, 103) and show me which other tables each one connects to. then start output/harness.md: every table, its fields, and one short line on why the agents would need it

**Follow-up prompt:**

> P2:Study the database... THATS THE TITLE FOR THE PREVIOUS PROMPT. Update it in prompts log

**What the first prompt was missing:**

The problem number and title, so the prompt log could be labeled. The database work itself was done in one pass.

---

## Problem 3: MCP servers

**Prompt:**

> Problem 3: MCP servers: now build an MCP server in mcp_server/server.py using FastMCP, pointed at data/campus_customs_new.db. I want 3 tools, one for each open ticket, built around what that ticket actually needs from the db. clear names, and never invent data. add a section to harness.md listing each tool, the table it reads, the ticket it helps with, and one sentence on why. then write a short mcp_server/README.md: what it's for, which db it uses, the 3 tools

**Follow-up prompt:**

> I put my 3 board screenshots in the folder.  can you see them? make output/resolved_board.html, a simple page I can double click to open that shows each screenshot with its ticket number above it. use relative paths so it still works after I push to GitHub, then open it and check that all 3 images actually load

> This is not problem 9 yet. I will prompt you when problem 9. Can you see the screenshots now? arethey are the three items?

> so what is the problem? What should i do?

> This is 103. can you see them? save them as a folder in outputs for future records, and work with them for the prompts i gave.

**What the first prompt was missing:**

A package version. The newest `mcp` release renamed FastMCP, so Claude had to pin `mcp<2` to keep the API I asked for.

For the screenshot page: one screenshot per ticket, saved as files in the folder. My first 3 screenshots all showed ticket 101, and pasting new ones into the chat didn't save them as files the page could link to.

---

## Problem 4: Connect and test the tools

**Prompt:**

> P4: Connect and test the tools connect my MCP server to you so you can call its tools. save the config as .mcp.json in the project root, and also add it wherever Codex needs it to actually load

**Follow-up prompt:**

> I dot understand??? i mentioned that everything we are doing SHOULD BE in Hw5 folder, so wym by it wont pick up HW5?

> so basically i should close the opened app and reopen it? and then open the HW5 folder?

> did it work?

> save those 3 tests in output/mcp_smoke.json: my prompt, the tool name, and the exact output for each. then query the db directly and confirm the outputs match

**What the first prompt was missing:**

That Claude Code was opened on the parent `AI Found` folder, not `HW 5`, so it never read the HW5 `.mcp.json`. It also didn't mention that the window had to be reloaded before the tools would load. And it didn't ask for the tests to be saved and checked against the db.

---

## Problem 5: Agent team

**Prompt:**

> P5: Agent team. uild 5 PydanticAI agents: Boss, Inventory, Accounting, Facilities, and Customer Service. all use gpt-6-luna through Portkey with my OPEN AI KEY from .env. Boss reads the ticket and delegates, and any agent can hand off to any other. shop facts only come from my MCP server, no separate tools layer. if agents need more tools to close the tickets, add them to the MCP server. one prompt file per agent in backend/prompts/, data types in backend/models.py. every agent loop step appends to output/audit_trail.json and never wipes it. update harness.md with every agent, every tool and its table, a safety section (guardrails for real customers and money, plus token limits), and update the MCP README

**Follow-up prompt:**

> None.

**What the first prompt was missing:**

The correct model name. I wrote `gpt-6-luna`, but the project model is `gpt-5.6-luna`.

---

## Problem 6: Plan the tickets

**Prompt:**

> P6. Plan the tickets make output/desk_tickets.html, one page with tabs for Ticket 101, 102, 103, plus Cash and Reflection tabs that say coming later. each ticket tab gets an Expected section and an empty Actual section. here's my plan: 101: Boss calls [agent] first because [why], then [handoffs], using [tools]. 102: ... 103: ...

**Follow-up prompt:**

> None.

**What the first prompt was missing:**

My actual plan. I pasted the template without filling in `[agent]`, `[why]`, `[handoffs]` and `[tools]` for each ticket, so the Expected sections didn't have my reasoning.

---

## Problem 7: Backend routes

**Prompt:**

> P7. Backend routes Build a FastAPI backend in backend/main.py for my React board. routes: list the 3 tickets and whether each is open or resolved, run the agent team on a ticket by id, return recent agent events (what each agent said and which tools it used), approve a payment or purchase after a human clicks approve, get the checking balance from cash_accounts, and reset the db. agents can only prepare payments, the approve route is the only thing that touches cash. it should run with uvicorn main:app --reload --port 8000 from backend/. add each route to harness.md on one line with its URL and what it does

**Follow-up prompt:**

> None.

**What the first prompt was missing:**

That another app was already running on port 8000. Every route returned 404 until that old server was stopped.

---

## Problem 8: Dashboard

**Prompt:**

> P8. Dashboard build a React + Vite + TypeScript dashboard in frontend/ that calls my backend at localhost:8000 (add CORS for localhost:5173). list the 3 tickets, let me pick one and run the agents, show each agent's messages live, mark the ticket resolved when done, show a short summary of what each agent did, give me an approve button when a payment needs sign off, and show the checking balance so I can watch it drop. make it look like earthy rusty theme. each agent with its own color and icon, nothing like the default Vite page. then write output/design.md on the layout, how agents look different, how resolved tickets and cash show up, and why

**Follow-up prompt:**

> I dont like the colors, they are too dark and hurting my eyes.Ok, lets do pink intead, light shades of pink only.

> I still do not like it. Ok, lets do plain colors... this is hurting my eyes

**What the first prompt was missing:**

A theme that was easy on the eyes. The earthy rusty theme was too dark and the all-pink one was too much. Asking for a plain, light look from the start would have saved two rounds.

---

## Problem 9: Resolve the tickets

**Prompt:**

> ok I ran all 3 tickets and my screenshots are in output/screenshots/ (ticket_101.png, ticket_102.png, ticket_103.png). use audit_trail.json and the db to fill in the Actual section for each ticket in desk_tickets.html right next to my Expected (which agents worked, who handed off to who, which tools). fill the Cash tab with the starting balance, every payment per ticket with what it was for and how much, and the ending balance, and make sure it matches cash_accounts. then make output/resolved_tickets.json (id, status, outcome, what each agent did, any approvals) and output/resolved_board.html, a page I can double click that shows my 3 screenshots with the ticket number above each one, using relative paths. finish harness.md so it covers tables, tools, agents, routes, dashboard and safety. at the end, double check the cash math and show me the numbers

**Follow-up prompt:**

> 

**What the first prompt was missing:**



---

## Problem 10: Reflection

**Prompt:**

> let's do the reflection. go through audit_trail.json, my ticket tabs, and the Cash tab and pull the facts for each ticket: what actually happened vs my Expected plan, which agents and tools were used, and the dollar amounts. then fill in the Reflection tab in desk_tickets.html with these 5 answers: how I'd judge the agents on each ticket and why, how Actual compared to Expected for 101, 102 and 103, what would've been simpler with just one agent and tools, 3 new problems Campus Customs could have that this team could handle with the tools we built, and 3 it couldn't handle, plus what tools and agents we'd need for each. keep it specific to this app with ticket ids and dollar amounts, nothing generic, and write it casual like me, not like an essay. no separate markdown file, it all goes in the Reflection tab

**Follow-up prompt:**

> 

**What the first prompt was missing:**



---

## Problem 11: Submit to GitHub

**Prompt:**

> last one, let's get this ready to submit. delete joke.txt and the extra screenshots/ folder in the root since the real ones are in output/screenshots/. make a .gitignore that leaves out .env, .venv, node_modules, and .DS_Store, and add a .env.example with no real keys. add a requirements.txt and check the folder layout matches the HW5 expected layout. write a README that explains how to copy campus_customs.db to campus_customs_new.db, start the MCP server, start the backend, start the React board, and reset the db before a full 3 ticket run. search the whole project to make sure my Portkey key isn't anywhere. then push it to a new public GitHub repo, save the URL in output/github_url.txt, and make hw5.zip with the same files

**Follow-up prompt:**

> 

**What the first prompt was missing:**


