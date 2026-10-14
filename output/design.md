# Campus Customs Agent Desk: Design

The React + Vite + TypeScript dashboard in `frontend/` lets the shop owner run the agent team on a ticket, watch the agents work, sign off on payments, and see the checking balance change. It calls the FastAPI backend at `localhost:8000`, which allows requests from `localhost:5173`.

## Theme: plain

The page is deliberately plain:
- **Surfaces:** a near-white page (`#fafafa`), white cards, and thin light-gray borders (`#e5e7eb`).
- **Text:** dark gray (`#1f2937`), with medium gray (`#6b7280`) for secondary text.
- **Font:** the system sans-serif everywhere.
- **Buttons:** solid dark slate (`#374151`) with white text.
- **No effects:** no gradients, glows, tinted backgrounds, or flashing.
- **Red** (`#b91c1c`) is used only for warnings: an error, a cash drop, a balance getting low.

**History:** two earlier versions were tried and dropped because they hurt the user's eyes. The first was earthy and rusty with a dark header. The second used only light pinks.

**Why:** a page full of AI text is easier to read for a long time on white with dark gray text and nothing competing for attention. Color appears only where it carries meaning: the agent icons, and red for warnings. None of the default Vite page is left, and the favicon is a plain gray mark.

## Layout

The page has three columns under a header. They follow the order the owner works in: **pick a ticket → watch the agents → decide.**

| Area | What's there | Why |
|---|---|---|
| **Header** | Shop name, the **checking balance** card, and a Reset shop button. | Cash is the one number the owner always cares about, so it never scrolls away. |
| **Left: Tickets** | One card per ticket (id, subject, type, requester, state) with a **Run agents** button. Below that, "The team" legend. | Choosing work comes first, so it's on the left. The legend teaches the agent colors before the feed uses them. |
| **Center: Live feed** | The selected ticket's title, then a timeline of agent messages, newest at the bottom like a chat. | The run is the main story, so it gets the widest column. |
| **Right: Sign-off and summary** | "Needs your sign-off": pending payments with **Approve & pay** and **Reject**. Below that, "Who did what": one short card per agent. | The decisions only a human can make sit next to the feed, so the owner reads why and then approves without hunting. |

Below 1100px wide, the columns stack in the same order.

## How agents look different

Every agent has its own **color** and a **line icon** in a rounded-square badge. The pairing is the same everywhere: in the feed, in the "hands to" line, in the summary, on payment requests, and in the legend.

| Agent | Color | Icon | Why this icon |
|---|---|---|---|
| Boss | Slate gray `#374151` | Compass | Sets the direction for each ticket. |
| Inventory | Amber `#b45309` | Crate | Counts what's on the shelves. |
| Accounting | Green `#15803d` | Coin stack | Watches the money. |
| Facilities | Blue `#1d4ed8` | Storefront | Looks after the shop space and lease. |
| Customer Service | Purple `#7e22ce` | Speech bubble | Talks to customers. |

Each badge is a light-gray tile with the icon drawn in the agent's color. The color appears in only three small places: the icon, the agent's name, and a thin left edge on its messages.

- **Feed bubbles** are white with a thin gray border. Only the 3px left edge and the agent's name take its color.
- **Handoffs** show "hands to" plus the next agent's small badge and the exact handoff message. You can follow the baton from bubble to bubble.
- **Tools** each agent called appear as small monospace tags under its message, for example `check_order_fulfillment` and `request_payment_approval`.
- **While a run is going,** a dashed "Inventory is working…" bubble shows who has the ticket right now, with three softly blinking dots.

**Why:** with five agents passing one ticket around, you need to tell them apart at a glance. Five clearly different colors, used in small amounts, do that without making the page loud. The icon backs up the color, which also helps color-blind users.

## Live messages

Pressing **Run agents** calls `POST /tickets/{id}/run`. While that request is open, the page polls `GET /events?ticket_id=` every 1.2 seconds and shows only steps from the current run. Every agent turn is appended to the audit trail as it finishes, so each message appears seconds after the agent says it. In testing, the first message showed up 6 seconds into a 43-second run.

Afterwards, the feed shows that ticket's most recent run on record, labeled with its run id.

## How resolved tickets show up

When the run finishes with the ticket closed:

1. **Ticket card:** the status changes to a **✓ Resolved** pill. The card turns light gray, the title goes gray, and the Run button disappears, since a closed ticket can't be rerun without a reset.
2. **Feed header:** a **✓ Resolved** pill appears next to the ticket title.
3. **Banner:** a light-gray banner shows the result, for example "Resolved · 6 agent steps · 38,239 tokens".
4. **Last bubble:** Boss's final message ends with a **✓ Ticket closed** tag.

If a run stops for a person (`needs_human`) or hits a token limit, the banner and tag turn red and say why in words.

**Why:** the ✓, the gray-out, and the missing Run button all say "done" quietly. Red is kept for the one case that needs attention.

## How cash shows up

- **Balance card** in the header: the checking balance in large serif type.
  - A red **▼ $840.00 this session** line shows the total drop since the page opened.
  - A **sparkline** traces every balance this session, scaled to its own range so even one payment shows a clear slope.
- **Pending line:** while payments wait for sign-off, a gray line under the balance reads "$840.00 awaiting approval → $2,560.00". The owner sees where cash *will* land before agreeing to anything.
- **Payment cards** in "Needs your sign-off" show:
  - the type and reference (Rent / Vendor invoice #501), the amount, payee, and account
  - **Leaves $X**, which turns red under $500 as a warning
  - the badge of the agent that asked, with its reason
  The cards for the selected ticket get a dark outline.
- **Approve & pay** is a solid dark button and stays disabled until the owner types a name in "Approving as". That name is saved to `payments.approved_by`. **Reject** is a quiet outline button.

**Why:**
- Agents can only *prepare* payments. `POST /approvals/{id}/approve` is the only thing that moves cash, and the layout makes that clear.
- The approve button stands out and requires a name, so a payment never happens by accident.
- Showing the balance before and after side by side helps the owner judge cash flow. Paying the $840 reprint and the $2,400 rent together would leave only $160.
