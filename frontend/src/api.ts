// Thin client for the FastAPI backend in backend/main.py.

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type AgentName = 'boss' | 'inventory' | 'accounting' | 'facilities' | 'customer_service'

export interface Ticket {
  id: number
  type: string
  requester: string
  subject: string
  sku: string | null
  size: string | null
  qty: number | null
  status: string
  created_at: string
  state: 'open' | 'resolved'
}

export interface AgentEvent {
  timestamp: string
  run_id: string
  ticket_id: number
  step: number
  agent: AgentName
  said: string | null
  next_action: 'handoff' | 'done' | 'needs_human' | null
  handoff_to: AgentName | null
  handoff_message: string | null
  tools: string[]
  tokens: number
  error: string | null
}

export interface RunResult {
  run_id: string
  ticket_id: number
  final_status: 'done' | 'needs_human' | 'step_limit' | 'token_limit' | 'error'
  steps: number
  total_tokens: number
  last_summary: string
}

export interface PaymentRequest {
  id: number
  ticket_id: number
  kind: 'rent' | 'invoice'
  ref_id: number
  payee: string
  amount: number
  account: string
  requested_by: AgentName
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface Cash {
  name: string
  balance: number
  date: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = body?.detail
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${res.status})`)
  }
  return body as T
}

export const api = {
  tickets: () => call<Ticket[]>('/tickets'),
  run: (id: number) => call<RunResult>(`/tickets/${id}/run`, { method: 'POST' }),
  events: (ticketId: number, limit = 60) =>
    call<AgentEvent[]>(`/events?ticket_id=${ticketId}&limit=${limit}`),
  approvals: () => call<PaymentRequest[]>('/approvals?status=pending'),
  approve: (id: number, approvedBy: string) =>
    call<{ new_balance: number }>(`/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved_by: approvedBy }),
    }),
  reject: (id: number, by: string) =>
    call(`/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify({ approved_by: by }) }),
  cash: () => call<Cash>('/cash'),
  reset: () => call('/reset', { method: 'POST' }),
}
