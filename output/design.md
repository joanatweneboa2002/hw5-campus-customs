# Campus Customs Agent Desk: Design

The React + Vite + TypeScript dashboard in `frontend/` lets the shop owner run the agent team on a ticket, watch the agents work, sign off on payments, and see the checking balance change. It calls the FastAPI backend at `localhost:8000`, which allows requests from `localhost:5173`.

## Theme: "Process" (from a Pinterest reference)

The look is based on the Alecta "Process" template the user picked on Pinterest: a full-width hero image with a dark tint and a huge white title, then four steps shown as giant numbers (01–04) filled with photos and illustrations, each next to a bold heading with a short gold underline, and a navy footer. Here each **agent step** is one of those process steps.

| Role | Color |
|---|---|
| Page | White `#ffffff`, with warm off-white `#f7f6f2` for handoff boxes |
| Hero, payment cards and footer | Deep navy `#0e0f24` |
| Heading underline, selected ticket bar | Gold `#c9a227` |
| Accents (in the illustrations, nav badge, Approve button, back-to-top) | Sunny yellow `#f2c94c`, coral `#ec5b5b`, teal `#3aa597` |
| Text | Near-black `#111114`, gray `#6f6f78` for secondary text |
| "Done" | Teal `#1f8274` |
| Warnings only | Dark red `#b42318` |

- **Fonts:** Montserrat (700–900) for headings and the giant numbers, Raleway for body text with even, full-height numbers.
- **Illustrations instead of photos:** the giant numbers and the hero are filled with hand-drawn SVG scenes (`frontend/src/art.ts`), so there are no image files and it works offline. The scenes avoid pure white so every digit keeps its shape on the white page.
- **Spacing:** wide margins, 56px between steps, thin light-gray dividers, a 48px gold dash under every heading.
- **Buttons:** rounded pills. Navy turns coral on hover. Approve & pay is coral on the navy payment card.

**History:** four earlier versions were dropped. Earthy and rusty, then light pinks (both hurt the user's eyes), then plain white and gray (easy to read but flat), then a first pass at this theme that only borrowed the colors. This version takes the template's structure too: the hero, the wide alternating steps, and picture-filled numbers. The reading areas stay white with dark text, so long AI text is still easy on the eyes.

## Layout

| Area | What's there | Why |
|---|---|---|
| **Nav** | "Campus Customs" with a yellow dot (like the Alecta logo), links to Tickets, Process, Sign-off (with a coral count of waiting payments) and Team, and Reset shop. | Jump straight to any part of a long page. The count tells the owner something needs them. |
| **Hero** | A top-down illustrated desk (laptop, plant, coffee, notebook, folded tees) under a navy tint. Over it: **Let's run the shop** in huge white type, a one-line explanation, three stats (tickets done, payments waiting, agents on shift) and a frosted **checking balance** card. | The first screen answers the owner's two questions: how much cash is there, and is anything waiting for me? |
| **Pick a ticket** | Three big cards side by side: ticket type, state, the ticket number painted with an illustration, subject and requester, and **Run agents**. The selected card lifts and gets a gold bar along the bottom. | Choosing work comes first. Big painted numbers make the three tickets instantly different. |
| **The process (wide)** | The selected ticket's title, then one row per agent step: a giant illustrated **01, 02, 03…** on one side and the agent's name, message, tools and handoff on the other. Sides alternate like the template. | The run is the main story, so it gets most of the width, and the giant numbers make the order of the handoffs impossible to miss. |
| **Sidebar (sticky)** | "Waiting on you": navy payment cards with **Approve & pay** and **Reject**. Below that, "Who did what": one numbered line per agent. | Stays in view while you scroll the steps, so you can read why and then approve. |
| **Footer (navy)** | Shop line ("nothing moves until a person approves it") and **The team**: all five agents in columns. A round coral ↑ button jumps back to the top. | Mirrors the template's footer. |

Below 1100px wide, everything stacks in the same order.

## How agents look different

Every agent has its own **text color**, an **illustrated scene** painted inside its giant step numbers, and a **line icon** in a round tinted badge.

| Agent | Text color | Scene inside its numbers | Icon |
|---|---|---|---|
| Boss | Navy `#14163a` | Navy desk with a gold compass, a dashed route and a note card | Compass |
| Inventory | Mustard `#a86f12` | Yellow stationery with folded coral, teal and navy tees and a box, like the template's "03" | Crate |
| Accounting | Teal `#1f8274` | Teal with stacked gold coins, a receipt and a dollar sign | Coin stack |
| Facilities | Slate `#565663` | Blueprint floor plan with walls, doors, windows and a plant, like the template's sketch "02" | Storefront |
| Customer Service | Coral `#cf3f3f` | Coral with navy and yellow speech bubbles and hearts, like the doodle "04" | Speech bubble |

The text colors are dark enough to read on white. The bright colors only appear inside the illustrations.

- **Handoffs:** a warm off-white box says "PASSES TO" plus the next agent's badge, name and exact handoff message.
- **Tools:** each tool the agent called is a small outlined pill, for example `check_order_fulfillment`.
- **While a run is going:** the next step number appears in the next agent's scene and pulses, with "Inventory is working" and three blinking gold dots.

Ticket numbers use the scene of the agent that owns that kind of work: customer orders get Inventory's (101), rent notices get Facilities' blueprint (102), and price overrides get Accounting's coins (103).

## Story, route map and motion

- **Three steps.** The page reads in the order the owner works, each with a gold outlined number like the template's steps: **01 Pick a ticket**, **02 Watch the team work**, **03 Waiting on you**.
- **Who touched it.** Above the steps, a line of agent badges shows the whole handoff path for the run on screen (for example Boss → Inventory → Accounting → Customer Service → Boss on 103), with step count and tokens. Clicking a badge jumps to that step. While a run is going, the next agent's badge pings at the end of the line. It shows the latest run for the selected ticket, the same run as the steps below.
- **Richer steps.** Each step has a gold eyebrow ("STEP 02 · STOCK & SIZES"), and each handoff is an arrow in the next agent's color pointing at its badge and name.
- **Motion.**
  - The hero art slowly zooms and drifts (a 28-second "Ken Burns" loop), and the title, text, stats and cash card rise in one after another on load.
  - Ticket cards fade up in sequence. Each step's giant number slides in from its own side while the text rises, as it scrolls into view.
  - Hovering a giant number tilts and enlarges it slightly. Hovering a ticket card lifts it.
  - **Reduced motion:** if the computer is set to reduce motion, all animation is turned off and everything is simply shown.
- **Footer wordmark.** A huge outlined "Campus Customs" in faint gold runs along the bottom of the navy footer.

**Why:** the template feels alive because things move and the story is numbered. The three steps tell a first-time user what to do in order, and the route map gives the whole run at a glance before reading the details.

## Live messages

Pressing **Run agents** calls `POST /tickets/{id}/run`. While that request is open, the page polls `GET /events?ticket_id=` every 1.2 seconds and shows only steps from the current run. Every agent turn is appended to the audit trail as it finishes, so each step appears seconds after the agent says it.

Afterwards, the feed shows that ticket's most recent run on record, labeled with its run id.

## How resolved tickets show up

When the run finishes with the ticket closed:

1. **Ticket card:** the state changes to a teal **✓ Resolved** pill and the Run button disappears, since a closed ticket can't be rerun without a reset.
2. **Feed header:** a teal **✓ Resolved** pill appears next to the ticket title.
3. **Banner:** an off-white banner with a gold left edge shows the result, for example "Resolved · 5 agent steps · 34,335 tokens".
4. **Last step:** Boss's final message ends with a teal **✓ Ticket closed** tag.

If a run stops for a person (`needs_human`) or hits a token limit, the banner and tag turn dark red and say why in words.

**Why:** teal means "done" everywhere on the page, and dark red is kept for the one case that needs attention.

## How cash shows up

- **Balance card** in the hero: a frosted-glass card with the checking balance in large white Montserrat.
  - A light-red **▼ $840.00 this session** line shows the total drop since the page opened.
  - A **gold sparkline** with a coral end dot traces every balance this session, scaled to its own range so even one payment shows a clear slope.
- **Pending line:** while payments wait for sign-off, a line under the balance reads "$2,400.00 waiting on you → $160.00". The owner sees where cash *will* land before agreeing to anything.
- **Payment cards** in "Waiting on you" are navy with a soft gold glow and show:
  - the type and reference (Rent / Vendor invoice #501), the amount in large type, the payee, and the account
  - **Leaves $X**, which turns dark red under $500 as a warning
  - the badge of the agent that asked, with its reason
  The card for the selected ticket gets a gold outline.
- **Approve & pay** is a solid coral pill and stays disabled until the owner types a name in "Approving as". That name is saved to `payments.approved_by`. **Reject** is a quiet outline pill.

**Why:**
- Agents can only *prepare* payments. `POST /approvals/{id}/approve` is the only thing that moves cash, and the layout makes that clear.
- The approve button stands out and requires a name, so a payment never happens by accident.
- Showing the balance before and after side by side helps the owner judge cash flow. Paying the $840 reprint and the $2,400 rent together would leave only $160.
