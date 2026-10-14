import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type AgentEvent, type AgentName, type Cash, type PaymentRequest, type RunResult, type Ticket } from './api'
import { AGENTS, AgentBadge, BigNumber } from './agents'
import { HERO_ART } from './art'

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

const TYPE_LABEL: Record<string, string> = {
  customer_order: 'Customer order',
  rent_notice: 'Rent notice',
  price_override: 'Price override',
}

// Fill for each ticket's big number, borrowed from the agent who owns that kind of work.
const TYPE_FILL: Record<string, string> = {
  customer_order: AGENTS.inventory.fill,
  rent_notice: AGENTS.facilities.fill,
  price_override: AGENTS.accounting.fill,
}

const pad = (n: number) => String(n).padStart(2, '0')

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

  // Slide each step, card and heading in as it scrolls into view.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.in)')
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    }, { threshold: 0.04 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [events, tickets, approvals, selectedId])

  const resolvedCount = tickets.filter((t) => t.state === 'resolved').length

  return (
    <div className="desk" id="top">
      {/* ---------------- hero ---------------- */}
      <header className="hero">
        <div className="hero-art" style={{ backgroundImage: HERO_ART }} aria-hidden />
        <div className="hero-tint" aria-hidden />
        <nav className="nav">
          <div className="logo">Campus Customs<span className="logo-dot" /></div>
          <div className="nav-links">
            <a href="#tickets">Tickets</a>
            <a href="#process">Process</a>
            <a href="#signoff">Sign-off{approvals.length > 0 && <span className="nav-badge">{approvals.length}</span>}</a>
            <a href="#team">Team</a>
          </div>
          <button className="ghost on-dark" onClick={reset} disabled={!!running}>Reset shop</button>
        </nav>
        <div className="hero-body">
          <div>
            <div className="hero-eyebrow">Agent Desk · Shop date {cash?.date ?? '…'}</div>
            <h1>Let's run the shop</h1>
            <p className="hero-lead">Five agents run the desk. They check the shop's data, pass tickets to each other, and get everything ready. Nothing goes out and no money moves until you say so.</p>
            <div className="hero-stats">
              <div><strong>{resolvedCount}/{tickets.length || 3}</strong><span>tickets done</span></div>
              <div><strong>{approvals.length}</strong><span>waiting for you</span></div>
              <div><strong>5</strong><span>agents on shift</span></div>
            </div>
          </div>
          <CashCard cash={cash} history={cashHistory} pendingTotal={pendingTotal} />
        </div>
      </header>

      {error && <div className="alert" role="alert">{error}<button onClick={() => setError(null)}>×</button></div>}

      {/* ---------------- tickets ---------------- */}
      <section className="tickets-band" id="tickets">
        <div className="section-head" data-reveal>
          <span className="chapter">01</span>
          <div>
            <div className="eyebrow">First up</div>
            <h2 className="section-title">Pick a ticket</h2>
          </div>
        </div>
        <div className="ticket-row">
          {tickets.map((t, i) => (
            <TicketCard
              order={i}
              key={t.id}
              ticket={t}
              selected={t.id === selectedId}
              running={running?.ticketId === t.id}
              locked={!!running}
              onSelect={() => setSelectedId(t.id)}
              onRun={() => runTicket(t)}
            />
          ))}
        </div>
      </section>

      <div className="section-head workspace-head" data-reveal>
        <span className="chapter">02</span>
        <div>
          <div className="eyebrow">Then</div>
          <h2 className="section-title">Watch the team work</h2>
        </div>
      </div>

      <main className="workspace">
        {/* ---------------- process feed ---------------- */}
        <section className="feed" id="process">
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
              {!!events.length && <RouteMap events={events} working={working} />}

              <ol className="timeline">
                {events.map((e, i) => <EventItem key={`${e.run_id}-${e.step}`} event={e} index={i} />)}
                {working && (
                  <li className="event working">
                    <BigNumber value={pad(events.length + 1)} fill={AGENTS[working].fill} />
                    <div className="bubble">
                      <h3 className="agent-name" style={{ color: AGENTS[working].color }}>{AGENTS[working].label} is working<span className="dots"><i /><i /><i /></span></h3>
                    </div>
                  </li>
                )}
              </ol>

              {!events.length && !running && (
                <div className="empty">
                  {selected.state === 'open'
                    ? 'Nobody has touched this one yet. Hit Run agents and Boss will get it started.'
                    : 'Nothing logged for this ticket yet.'}
                </div>
              )}
              {!!events.length && !running && !results[selected.id] && (
                <p className="muted small run-note">This is the last run ({events[0].run_id}).</p>
              )}
            </>
          ) : (
            <div className="empty">Pick a ticket up top to see what happened.</div>
          )}
        </section>

        {/* ---------------- approvals + summary ---------------- */}
        <aside className="side" id="signoff">
          <div className="side-chapter"><span className="chapter small-chapter">03</span><span className="eyebrow">Your turn</span></div>
          <h2 className="col-title">Waiting on you</h2>
          <label className="approver">
            <span>Signing as</span>
            <input value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="Type your name" />
          </label>
          {approvals.length === 0 && <p className="muted small">All clear. When the team wants to pay for something, it shows up here for you to OK.</p>}
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
        </aside>
      </main>

      <Footer />
      <a className="to-top" href="#top" aria-label="Back to top">↑</a>
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
            <span className="pending">{money(pendingTotal)} waiting on you → {money(cash.balance - pendingTotal)}</span>
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

function TicketCard({ ticket, order, selected, running, locked, onSelect, onRun }: {
  ticket: Ticket; order: number; selected: boolean; running: boolean; locked: boolean; onSelect: () => void; onRun: () => void
}) {
  const resolved = ticket.state === 'resolved'
  return (
    <article
      className={`ticket ${selected ? 'selected' : ''} ${resolved ? 'resolved' : ''}`}
      onClick={onSelect}
      data-reveal
      style={{ transitionDelay: `${order * 90}ms` }}
    >
      <div className="ticket-top">
        <span className="eyebrow">{TYPE_LABEL[ticket.type] ?? ticket.type}</span>
        <span className={`state ${ticket.state}`}>{resolved ? '✓ Resolved' : running ? 'Working…' : 'Open'}</span>
      </div>
      <BigNumber value={String(ticket.id)} fill={TYPE_FILL[ticket.type] ?? AGENTS.boss.fill} className="ticket-num" />
      <h3>{ticket.subject}</h3>
      <p className="muted small">From {ticket.requester}</p>
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

function EventItem({ event, index }: { event: AgentEvent; index: number }) {
  const a = AGENTS[event.agent]
  return (
    <li className={`event ${index % 2 ? 'flip' : ''}`} id={`step-${index + 1}`} data-reveal>
      <BigNumber value={pad(index + 1)} fill={a.fill} />
      <div className="bubble">
        <div className="step-eyebrow">Step {pad(index + 1)} · {a.role}</div>
        <div className="bubble-head">
          <h3 className="agent-name" style={{ color: a.color }}><AgentBadge agent={event.agent} size={30} /> {a.label}</h3>
          <span className="muted small">{event.tokens.toLocaleString()} tokens</span>
        </div>
        <p className={event.error ? 'err' : ''}>{event.said}</p>
        {!!event.tools.length && (
          <div className="tools">
            {event.tools.map((t, i) => <code key={i}>{t}</code>)}
          </div>
        )}
        {event.next_action === 'handoff' && event.handoff_to && (
          <div className="handoff" style={{ ['--to' as string]: AGENTS[event.handoff_to].color }}>
            <div className="handoff-to">
              <span>Passes to</span>
              <span className="handoff-arrow" aria-hidden />
              <AgentBadge agent={event.handoff_to} size={24} />
              <strong style={{ color: AGENTS[event.handoff_to].color }}>{AGENTS[event.handoff_to].label}</strong>
            </div>
            {event.handoff_message && <em>“{event.handoff_message}”</em>}
          </div>
        )}
        {event.next_action === 'done' && <div className="outcome done">Done, ticket closed</div>}
        {event.next_action === 'needs_human' && <div className="outcome human">Stuck, needs you to decide</div>}
      </div>
    </li>
  )
}

function RouteMap({ events, working }: { events: AgentEvent[]; working: AgentName | null }) {
  const stops = events.map((e) => e.agent)
  const tokens = events.reduce((n, e) => n + e.tokens, 0)
  return (
    <div className="route" data-reveal>
      <div className="route-head">
        <span className="eyebrow">Who touched it</span>
        <span className="muted small">{events.length} step{events.length === 1 ? '' : 's'} · {tokens.toLocaleString()} tokens</span>
      </div>
      <ol className="route-line">
        {stops.map((agent, i) => (
          <li key={i} style={{ ['--c' as string]: AGENTS[agent].color }}>
            <a href={`#step-${i + 1}`} title={`Step ${i + 1}: ${AGENTS[agent].label}`}>
              <AgentBadge agent={agent} size={34} />
              <span>{pad(i + 1)}</span>
            </a>
          </li>
        ))}
        {working && (
          <li className="route-live" style={{ ['--c' as string]: AGENTS[working].color }}>
            <AgentBadge agent={working} size={34} /><span>now</span>
          </li>
        )}
      </ol>
    </div>
  )
}

function RunBanner({ result }: { result: RunResult }) {
  const ok = result.final_status === 'done'
  return (
    <div className={`run-banner ${ok ? 'ok' : 'warn'}`}>
      <strong>{ok ? 'Resolved' : result.final_status.replace('_', ' ')}</strong>
      <span>{result.steps} agent step{result.steps === 1 ? '' : 's'} · {result.total_tokens.toLocaleString()} tokens</span>
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
      {!canDecide && !busy && <p className="muted tiny">Add your name above first.</p>}
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
  if (!order.length) return <p className="muted small">Run a ticket and you'll see who did what here.</p>
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

function Footer() {
  return (
    <footer className="footer">
      <div className="wordmark" aria-hidden>Campus Customs</div>
      <div className="footer-brand">
        <div className="logo">Campus Customs<span className="logo-dot" /></div>
        <p>The team does the legwork. You make the final call on anything that goes out or costs money.</p>
      </div>
      <div className="team" id="team">
        <h2>Meet the team</h2>
        <div className="team-grid">
          {(Object.keys(AGENTS) as AgentName[]).map((n) => (
            <div key={n} className="team-member">
              <AgentBadge agent={n} size={30} />
              <div>
                <strong>{AGENTS[n].label}</strong>
                <div className="tiny">{AGENTS[n].role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}
