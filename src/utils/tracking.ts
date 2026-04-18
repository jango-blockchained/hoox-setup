import type { D1Database } from "@cloudflare/workers-types";

export type EventType =
  | "INCOMING"
  | "PROCESSING"
  | "ACTION"
  | "OUTCOME"
  | "ERROR";
export type EventStatus = "pending" | "success" | "failed";

export interface TrackingOptions {
  signalId?: string;
  traceId?: string;
  payload?: Record<string, unknown>;
  status?: EventStatus;
  errorMessage?: string;
  executionTimeMs?: number;
}

export interface SignalEvent {
  id: number;
  event_id: string;
  worker_name: string;
  event_type: EventType;
  signal_id: string | null;
  trace_id: string | null;
  payload: Record<string, unknown> | null;
  status: EventStatus;
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: number;
  updated_at: number | null;
}

export interface EventTrace {
  id: number;
  trace_id: string;
  worker_name: string;
  event_type: EventType;
  event_id: string | null;
  details: Record<string, unknown> | null;
  created_at: number;
}

export interface WorkerStats {
  id: number;
  worker_name: string;
  total_events: number;
  total_errors: number;
  avg_execution_time_ms: number | null;
  last_event_at: number;
  created_at: number;
  updated_at: number | null;
}

export interface TrackingEnv {
  DB: D1Database;
}

export async function generateEventId(): Promise<string> {
  return crypto.randomUUID();
}

export async function generateTraceId(): Promise<string> {
  return crypto.randomUUID();
}

export async function trackSignal(
  env: TrackingEnv,
  workerName: string,
  eventType: EventType,
  options: TrackingOptions = {}
): Promise<string> {
  const eventId = await generateEventId();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO signal_events 
     (event_id, worker_name, event_type, signal_id, trace_id, payload, status, error_message, execution_time_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      eventId,
      workerName,
      eventType,
      options.signalId || null,
      options.traceId || null,
      options.payload ? JSON.stringify(options.payload) : null,
      options.status || "pending",
      options.errorMessage || null,
      options.executionTimeMs || null,
      now
    )
    .run();

  console.log(
    `[Tracking] Created ${eventType} event: ${eventId} for ${workerName}`
  );
  return eventId;
}

export async function updateSignalStatus(
  env: TrackingEnv,
  eventId: string,
  status: EventStatus,
  options: Partial<TrackingOptions> = {}
): Promise<void> {
  const now = Date.now();

  await env.DB.prepare(
    `UPDATE signal_events 
     SET status = ?, error_message = ?, execution_time_ms = ?, updated_at = ?
     WHERE event_id = ?`
  )
    .bind(
      status,
      options.errorMessage || null,
      options.executionTimeMs || null,
      now,
      eventId
    )
    .run();

  console.log(`[Tracking] Updated event ${eventId} to status: ${status}`);
}

export async function trackTrace(
  env: TrackingEnv,
  traceId: string,
  workerName: string,
  eventType: EventType,
  options: {
    eventId?: string;
    details?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO event_trace (trace_id, worker_name, event_type, event_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      traceId,
      workerName,
      eventType,
      options.eventId || null,
      options.details ? JSON.stringify(options.details) : null,
      now
    )
    .run();

  console.log(`[Tracking] Traced ${eventType} for trace: ${traceId}`);
}

export async function getEvents(
  env: TrackingEnv,
  workerName?: string,
  limit: number = 50,
  offset: number = 0
): Promise<SignalEvent[]> {
  let query = `SELECT * FROM signal_events`;
  const params: (string | number)[] = [];

  if (workerName) {
    query += ` WHERE worker_name = ?`;
    params.push(workerName);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await env.DB.prepare(query)
    .bind(...params)
    .all<SignalEvent>();
  return result.results || [];
}

export async function getTrace(
  env: TrackingEnv,
  traceId: string
): Promise<EventTrace[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM event_trace WHERE trace_id = ? ORDER BY created_at ASC`
  )
    .bind(traceId)
    .all<EventTrace>();

  return result.results || [];
}

export async function getWorkerStats(
  env: TrackingEnv,
  workerName: string
): Promise<WorkerStats | null> {
  const result = await env.DB.prepare(
    `SELECT * FROM worker_stats WHERE worker_name = ?`
  )
    .bind(workerName)
    .first<WorkerStats>();

  return result || null;
}

export async function updateWorkerStats(
  env: TrackingEnv,
  workerName: string,
  executionTimeMs?: number
): Promise<void> {
  const now = Date.now();
  const timeDelta = executionTimeMs || 0;

  await env.DB.prepare(
    `INSERT INTO worker_stats (worker_name, total_events, total_errors, avg_execution_time_ms, last_event_at, created_at)
     VALUES (?, 1, 0, ?, ?, ?)
     ON CONFLICT(worker_name) DO UPDATE SET
       total_events = total_events + 1,
       avg_execution_time_ms = (avg_execution_time_ms * total_events + ?) / (total_events + 1),
       last_event_at = ?,
       updated_at = ?`
  )
    .bind(workerName, timeDelta, now, now, timeDelta, now, now)
    .run();
}

export async function incrementErrorCount(
  env: TrackingEnv,
  workerName: string
): Promise<void> {
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO worker_stats (worker_name, total_events, total_errors, avg_execution_time_ms, last_event_at, created_at)
     VALUES (?, 0, 1, NULL, ?, ?)
     ON CONFLICT(worker_name) DO UPDATE SET
       total_errors = total_errors + 1,
       last_event_at = ?,
       updated_at = ?`
  )
    .bind(workerName, now, now, now, now)
    .run();
}
