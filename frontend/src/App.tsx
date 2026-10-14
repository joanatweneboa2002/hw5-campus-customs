import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type AgentEvent, type AgentName, type Cash, type PaymentRequest, type RunResult, type Ticket } from './api'
import { AGENTS, AgentBadge } from './agents'

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

const TYPE_LABEL: Record<string, string> = {
  customer_order: 'Customer order',
  rent_notice: 'Rent notice',
  price_override: 'Price override',
}

interface CashPoint {
  balance: number
  label: string
}

interface Running {
  ticketId: number
  startedAt: number
}

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [approvals, setApprovals] = useState<PaymentRequest[]>([])
  const [cash, setCash] = useState<Cash | null>(null)
  const [cashHistory, setCashHistory] = useState<CashPoint[]>([])
  const [running, setRunning] = useState<Running | null>(null)
  const [results, setResults] = useState<Record<number, RunResult>>({})
  const [approver, setApprover] = useState(() => localStorage.getItem('approver') ?? '')
  const [busyApproval, setBusyApproval] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const runningRef = useRef<Running | null>(null)

  const selected = tickets.find((t) => t.id === selectedId) ?? null

  // ---- data loading -------------------------------------------------------

  const loadCash = useCallback(async (label: string) => {
    const c = await api.cash()
    setCash(c)
    setCashHistory((h) =>
      h.length && h[h.length - 1].balance === c.balance ? h : [...h, { balance: c.balance, label }],
    )
  }, [])

  const loadTickets = useCallback(async () => {
    const t = await api.tickets()
    setTickets(t)
    setSelectedId((cur) => cur ?? t[0]?.id ?? null)
  }, [])

  const loadApprovals = useCallback(async () => setApprovals(await api.approvals()), [])

  const loadEvents = useCallback(async (ticketId: number) => {
    const all = await api.events(ticketId)
    const r = runningRef.current
    if (r && r.ticketId === ticketId) {
      // Live: only steps from the run that's happening now.
      setEvents(all.filter((e) => Date.parse(e.timestamp) >= r.startedAt - 2000).reverse())
    } else if (all.length) {
      // Otherwise the most recent run for this ticket.
      const runId = all[0].run_id
      setEvents(all.filter((e) => e.run_id === runId).reverse())
    } else {
      setEvents([])
    }
  }, [])

  const refreshAll = useCallback(
    async (cashLabel: string) => {
      try {
        await Promise.all([loadTickets(), loadApprovals(), loadCash(cashLabel)])
        setError(null)
      } catch (e) {
        setError(`Can't reach the backend at localhost:8000. Is uvicorn running? (${(e as Error).message})`)
      }
    },
    [loadTickets, loadApprovals, loadCash],
  )

  useEffect(() => {
    refreshAll('Opening balance')
  }, [refreshAll])

  useEffect(() => {
    if (selectedId != null) loadEvents(selectedId).catch(() => {})
  }, [selectedId, loadEvents])

  // Poll the audit trail while agents are working, so messages appear live.
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => {
      loadEvents(running.ticketId).catch(() => {})
      loadApprovals().catch(() => {})
    }, 1200)
    return () => clearInterval(timer)
  }, [running, loadEvents, loadApprovals])

  // ---- actions --------------------------------------------------------------

  async function runTicket(ticket: Ticket) {
    const r = { ticketId: ticket.id, startedAt: Date.now() }
    runningRef.current = r
    setRunning(r)
    setSelectedId(ticket.id)
    setEvents([])
    setError(null)
    try {
      const result = await api.run(ticket.id)
      setResults((m) => ({ ...m, [ticket.id]: result }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      await loadEvents(ticket.id).catch(() => {})
      runningRef.current = null
      setRunning(null)
      await refreshAll('After agent run')
    }
  }

  async function decide(req: PaymentRequest, approve: boolean) {
    if (!approver.trim()) return
    localStorage.setItem('approver', approver.trim())
    setBusyApproval(req.id)
    try {
      if (approve) await api.approve(req.id, approver.trim())
      else await api.reject(req.id, approver.trim())
      await refreshAll(approve ? `Paid ${req.payee} −${money(req.amount)}` : 'Rejected request')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyApproval(null)
    }
  }

  async function reset() {
    if (!window.confirm('Reset the shop database to the original? Tickets reopen and cash goes back to the start. The audit trail is kept.')) return
    try {
      await api.reset()
      setResults({})
      setCashHistory([])
      await refreshAll('Reset balance')
      if (selectedId != null) await loadEvents(selectedId)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // ---- derived ----------------------------------------------------------------

  const working: AgentName | null = useMemo(() => {
    if (!running || running.ticketId !== selectedId) return null
    const last = events[events.length - 1]
    if (!last) return 'boss'
    return last.next_action === 'handoff' ? last.handoff_to ?? 'boss' : null
  }, [running, selectedId, events])

  const pendingTotal = approvals.reduce((s, a) => s + a.amount, 0)

  return (
    <div className="desk">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 32 32"><path d="M8 22c2.2-6.5 5.4-11 8-11s5.8 4.5 8 11" /><circle cx="16" cy="11" r="2.6" /></svg>
          </span>
          <div>
            <div className="eyebrow">Campus Customs</div>
            <h1>Agent Desk</h1>
          </div>
        </div>
        <CashCard cash={cash} history={cashHistory} pendingTotal={pendingTotal} />
        <button className="ghost" onClick={reset} disabled={!!running}>Reset shop</button>
      </header>

      {error && <div className="alert" role="alert">{error}<button onClick={() => setError(null)}>×</button></div>}

      <main className="columns">
        {/* ---------------- tickets ---------------- */}
        <section className="col tickets">
          <h2 className="col-title">Tickets</h2>
          {tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              selected={t.id === selectedId}
              running={running?.ticketId === t.id}
              locked={!!running}
              onSelect={() => setSelectedId(t.id)}
              onRun={() => runTicket(t)}
            />
          ))}
          <AgentLegend />
        </section>

        {/* ---------------- live feed ---------------- */}
        <section className="col feed">
          {selected ? (
            <>
              <div className="feed-head">
                <div>
                  <div className="eyebrow">Ticket {selected.id} · {TYPE_LABEL[selected.type] ?? selected.type}</div>
                  <h2>{selected.subject}</h2>
                  <p className="muted">From {selected.requester}</p>
                </div>
                {selected.state === 'resolved' && <span className="stamp">Resolved</span>}
              </div>

              {results[selected.id] && <RunBanner result={results[selected.id]} />}

              <ol className="timeline">
                {events.map((e) => <EventItem key={`${e.run_id}-${e.step}`} event={e} />)}
                {working && (
                  <li className="event working">
                    <AgentBadge agent={working} />
                    <div className="bubble" style={{ borderLeftColor: AGENTS[working].color }}>
                      <strong style={{ color: AGENTS[working].color }}>{AGENTS[working].label}</strong> is working
                      <span className="dots"><i /><i /><i /></span>
                    </div>
                  </li>
                )}
              </ol>

              {!events.length && !running && (
                <div className="empty">
                  {selected.state === 'open'
                    ? 'No agents have worked this ticket yet. Press Run agents to start with Boss.'
                    : 'No agent steps on record for this ticket.'}
                </div>
              )}
              {!!events.length && !running && !results[selected.id] && (
                <p className="muted small">Showing the most recent run on record ({events[0].run_id}).</p>
              )}
            </>
          ) : (
            <div className="empty">Pick a ticket.</div>
          )}
        </section>

        {/* ---------------- approvals + summary ---------------- */}
        <section className="col side">
          <h2 className="col-title">Needs your sign-off</h2>
          <label className="approver">
            <span>Approving as</span>
            <input value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="Your name" />
          </label>
          {approvals.length === 0 && <p className="muted small">Nothing waiting. Agents can only prepare payments; they appear here for you to approve.</p>}
          {approvals.map((a) => (
            <ApprovalCard
              key={a.id}
              req={a}
              cash={cash}
              highlight={a.ticket_id === selectedId}
              canDecide={!!approver.trim() && busyApproval === null}
              busy={busyApproval === a.id}
              onApprove={() => decide(a, true)}
              onReject={() => decide(a, false)}
            />
          ))}

          <h2 className="col-title spaced">Who did what</h2>
          <AgentSummary events={events} />
        </section>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------

function CashCard({ cash, history, pendingTotal }: { cash: Cash | null; history: CashPoint[]; pendingTotal: number }) {
  const start = history[0]?.balance
  const delta = cash && start != null ? cash.balance - start : 0
  const last = history[history.length - 1]
  const points = history.map((p) => p.balance)
  // Scale to the session's own range so a drop is easy to see.
  const max = Math.max(...points)
  const min = Math.min(...points)
  const y = (b: number) => (max === min ? 16 : 4 + ((max - b) / (max - min)) * 24)
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100)
  const path = points.map((b, i) => `${x(i)},${y(b)}`).join(' ')
  return (
    <div className="cash" aria-live="polite">
      <div>
        <div className="eyebrow">Checking</div>
        <div className="cash-amount" key={cash?.balance}>{cash ? money(cash.balance) : '—'}</div>
        <div className="cash-meta">
          {delta < 0 && <span className="drop">▼ {money(-delta)} this session</span>}
          {delta === 0 && <span className="muted">as of {cash?.date ?? '…'}</span>}
          {pendingTotal > 0 && cash && (
            <span className="pending">{money(pendingTotal)} awaiting approval → {money(cash.balance - pendingTotal)}</span>
          )}
        </div>
      </div>
      {points.length > 1 && (
        <svg className="spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-label={last?.label}>
          <polyline points={path} />
          <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="2.6" />
        </svg>
      )}
    </div>
  )
}

function TicketCard({ ticket, selected, running, locked, onSelect, onRun }: {
  ticket: Ticket; selected: boolean; running: boolean; locked: boolean; onSelect: () => void; onRun: () => void
}) {
  const resolved = ticket.state === 'resolved'
  return (
    <article className={`ticket ${selected ? 'selected' : ''} ${resolved ? 'resolved' : ''}`} onClick={onSelect}>
      <div className="ticket-top">
        <span className="ticket-id">#{ticket.id}</span>
        <span className={`state ${ticket.state}`}>{resolved ? '✓ Resolved' : running ? 'Working…' : 'Open'}</span>
      </div>
      <h3>{ticket.subject}</h3>
      <p className="muted small">{TYPE_LABEL[ticket.type] ?? ticket.type} · {ticket.requester}</p>
      {!resolved && (
        <button
          className="run"
          disabled={locked}
          onClick={(e) => { e.stopPropagation(); onRun() }}
        >
          {running ? <><span className="spinner" /> Agents working</> : 'Run agents'}
        </button>
      )}
    </article>
  )
}

function EventItem({ event }: { event: AgentEvent }) {
  const a = AGENTS[event.agent]
  return (
    <li className="event">
      <AgentBadge agent={event.agent} />
      <div className="bubble" style={{ borderLeftColor: a.color }}>
        <div className="bubble-head">
          <strong style={{ color: a.color }}>{a.label}</strong>
          <span className="muted small">step {event.step} · {event.tokens.toLocaleString()} tokens</span>
        </div>
        <p className={event.error ? 'err' : ''}>{event.said}</p>
        {!!event.tools.length && (
          <div className="tools">
            {event.tools.map((t, i) => <code key={i}>{t}</code>)}
          </div>
        )}
        {event.next_action === 'handoff' && event.handoff_to && (
          <div className="handoff">
            <span>hands to</span>
            <AgentBadge agent={event.handoff_to} size={22} />
            <strong style={{ color: AGENTS[event.handoff_to].color }}>{AGENTS[event.handoff_to].label}</strong>
            {event.handoff_message && <em>“{event.handoff_message}”</em>}
          </div>
        )}
        {event.next_action === 'done' && <div className="outcome done">Ticket closed</div>}
        {event.next_action === 'needs_human' && <div className="outcome human">Stopped: needs a person</div>}
      </div>
    </li>
  )
}

function RunBanner({ result }: { result: RunResult }) {
  const ok = result.final_status === 'done'
  return (
    <div className={`run-banner ${ok ? 'ok' : 'warn'}`}>
      <strong>{ok ? 'Resolved' : result.final_status.replace('_', ' ')}</strong>
      <span>{result.steps} agent steps · {result.total_tokens.toLocaleString()} tokens</span>
    </div>
  )
}

function ApprovalCard({ req, cash, highlight, canDecide, busy, onApprove, onReject }: {
  req: PaymentRequest; cash: Cash | null; highlight: boolean; canDecide: boolean; busy: boolean
  onApprove: () => void; onReject: () => void
}) {
  const after = cash ? cash.balance - req.amount : null
  return (
    <article className={`approval ${highlight ? 'highlight' : ''}`}>
      <div className="approval-top">
        <span className="kind">{req.kind === 'rent' ? 'Rent' : 'Vendor invoice'} #{req.ref_id}</span>
        <span className="muted small">Ticket {req.ticket_id}</span>
      </div>
      <div className="approval-amount">{money(req.amount)}</div>
      <div className="small">to <strong>{req.payee}</strong> from {req.account}</div>
      {after != null && <div className={`small ${after < 500 ? 'drop' : 'muted'}`}>Leaves {money(after)}</div>}
      <p className="reason">
        <AgentBadge agent={req.requested_by} size={18} /> {req.reason}
      </p>
      <div className="approval-actions">
        <button className="approve" disabled={!canDecide} onClick={onApprove}>
          {busy ? 'Paying…' : 'Approve & pay'}
        </button>
        <button className="ghost small" disabled={!canDecide} onClick={onReject}>Reject</button>
      </div>
      {!canDecide && !busy && <p className="muted tiny">Enter your name above to sign off.</p>}
    </article>
  )
}

function AgentSummary({ events }: { events: AgentEvent[] }) {
  const order: AgentName[] = []
  const byAgent = new Map<AgentName, { steps: number; tools: Set<string>; last: string }>()
  for (const e of events) {
    if (!byAgent.has(e.agent)) {
      order.push(e.agent)
      byAgent.set(e.agent, { steps: 0, tools: new Set(), last: '' })
    }
    const s = byAgent.get(e.agent)!
    s.steps += 1
    e.tools.forEach((t) => t !== 'get_ticket' && s.tools.add(t))
    s.last = e.said ?? s.last
  }
  if (!order.length) return <p className="muted small">Run a ticket to see each agent's part.</p>
  return (
    <ul className="summary">
      {order.map((name) => {
        const s = byAgent.get(name)!
        return (
          <li key={name} style={{ borderLeftColor: AGENTS[name].color }}>
            <div className="summary-head">
              <AgentBadge agent={name} size={24} />
              <strong>{AGENTS[name].label}</strong>
              <span className="muted tiny">{s.steps} step{s.steps > 1 ? 's' : ''}</span>
            </div>
            <p className="small">{s.last}</p>
            {!!s.tools.size && <div className="tools">{[...s.tools].map((t) => <code key={t}>{t}</code>)}</div>}
          </li>
        )
      })}
    </ul>
  )
}

function AgentLegend() {
  return (
    <div className="legend">
      <h2 className="col-title spaced">The team</h2>
      {(Object.keys(AGENTS) as AgentName[]).map((n) => (
        <div key={n} className="legend-row">
          <AgentBadge agent={n} size={28} />
          <div>
            <strong style={{ color: AGENTS[n].color }}>{AGENTS[n].label}</strong>
            <div className="muted tiny">{AGENTS[n].role}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
