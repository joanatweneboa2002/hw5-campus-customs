// Each agent's look: name, role, color, and a hand-drawn line icon.
import type { AgentName } from './api'

interface AgentStyle {
  label: string
  role: string
  color: string // icon, name, and left edge
  soft: string // badge background
  Icon: () => React.JSX.Element
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// Compass: Boss sets the direction.
const CompassIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5 13.2 13.2 8.5 15.5l2.3-4.7z" />
  </svg>
)

// Crate: Inventory counts what's on the shelves.
const CrateIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke}>
    <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
    <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
  </svg>
)

// Coin stack: Accounting watches the money.
const CoinsIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke}>
    <ellipse cx="12" cy="6" rx="7" ry="2.8" />
    <path d="M5 6v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6" />
    <path d="M5 10v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4" />
    <path d="M5 14v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4" />
  </svg>
)

// Storefront: Facilities looks after the shop space.
const StoreIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke}>
    <path d="M4 10v10h16V10" />
    <path d="M3 10 5 4h14l2 6c0 1.4-1.1 2.3-2.4 2.3S16.2 11.4 16.2 10c0 1.4-1.1 2.3-2.4 2.3S11.4 11.4 11.4 10c0 1.4-1.1 2.3-2.4 2.3S6.6 11.4 6.6 10c0 1.4-1.1 2.3-2.4 2.3" />
    <path d="M10 20v-5h4v5" />
  </svg>
)

// Speech bubble: Customer Service talks to people.
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" {...stroke}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </svg>
)

export const AGENTS: Record<AgentName, AgentStyle> = {
  boss: { label: 'Boss', role: 'Reads & delegates', color: '#374151', soft: '#f3f4f6', Icon: CompassIcon },
  inventory: { label: 'Inventory', role: 'Stock & sizes', color: '#b45309', soft: '#f3f4f6', Icon: CrateIcon },
  accounting: { label: 'Accounting', role: 'Cash & prices', color: '#15803d', soft: '#f3f4f6', Icon: CoinsIcon },
  facilities: { label: 'Facilities', role: 'Lease & space', color: '#1d4ed8', soft: '#f3f4f6', Icon: StoreIcon },
  customer_service: { label: 'Customer Service', role: 'Replies to people', color: '#7e22ce', soft: '#f3f4f6', Icon: ChatIcon },
}

export function AgentBadge({ agent, size = 36 }: { agent: AgentName; size?: number }) {
  const a = AGENTS[agent]
  return (
    <span
      className="agent-badge"
      style={{ background: a.soft, width: size, height: size, color: a.color }}
      title={a.label}
    >
      <a.Icon />
    </span>
  )
}
