/**
 * Storage abstraction for ChatAzad.
 *
 * - Postgres (via `pg`) when DATABASE_URL is set — this is what you use on
 *   Vercel (Neon, Supabase, or any Postgres provider).
 * - Local JSON files under ./data/ otherwise (development convenience only;
 *   files do NOT persist on Vercel serverless).
 *
 * Data retention: the events log is AUTO-PRUNED inside the write path —
 * only the latest N events are kept (N = settings.retention_limit,
 * default 200). This keeps the free Postgres tier tiny forever.
 */
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  Trigger,
  TriggerChannel,
  TriggerAction,
  MatchType,
} from './triggers';
import type { Flow, FlowNode, FlowEdge } from './flows';
import { defaultNodes } from './flows';

export interface StoredEvent {
  id: string;
  type: string; // 'webhook' | 'trigger_matched' | 'flow_executed' |
               // 'message_sent' | 'broadcast' | 'error'
  channel: string;
  summary: string;
  createdAt: string;
}

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
}

export interface Contact {
  id: string;
  platform: 'instagram' | 'facebook';
  senderId: string;
  name: string | null;
  channel: TriggerChannel;
  messageCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DashboardStats {
  messagesSent: number;
  triggersMatched: number;
  flowsExecuted: number;
  activeFlows: number;
  totalContacts: number;
  totalEvents: number;
}

export interface Storage {
  // --- users (v2 auth — email/password accounts) ---
  createUser(user: { email: string; passwordHash: string }): Promise<StoredUser>;
  findUserByEmail(email: string): Promise<StoredUser | null>;

  // --- quick-reply triggers (legacy simple triggers) ---
  listTriggers(): Promise<Trigger[]>;
  createTrigger(t: Omit<Trigger, 'id' | 'createdAt'>): Promise<Trigger>;
  updateTrigger(
    id: string,
    t: Partial<Omit<Trigger, 'id' | 'createdAt'>>,
  ): Promise<Trigger>;
  deleteTrigger(id: string): Promise<void>;

  // --- events (auto-pruned) ---
  logEvent(type: string, channel: string, summary: string): Promise<void>;
  recentEvents(limit: number): Promise<StoredEvent[]>;

  // --- visual flows ---
  listFlows(): Promise<Flow[]>;
  getFlow(id: string): Promise<Flow | null>;
  createFlow(name: string): Promise<Flow>;
  updateFlow(
    id: string,
    patch: Partial<Pick<Flow, 'name' | 'enabled' | 'nodes' | 'edges'>>,
  ): Promise<Flow>;
  deleteFlow(id: string): Promise<void>;
  duplicateFlow(id: string): Promise<Flow>;

  // --- contacts ---
  upsertContact(input: {
    platform: 'instagram' | 'facebook';
    senderId: string;
    name?: string | null;
    channel: TriggerChannel;
  }): Promise<Contact>;
  listContacts(query?: string, limit?: number): Promise<Contact[]>;
  countContacts(): Promise<number>;

  // --- settings / stats / danger zone ---
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getStats(): Promise<DashboardStats>;
  clearAll(): Promise<void>;

  // --- data deletion (Meta data-deletion callback / user requests) ---
  deleteUserData(senderId: string): Promise<{
    contactsDeleted: number;
    eventsDeleted: number;
  }>;
}

export const DEFAULT_RETENTION_LIMIT = 200;

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const CREATE_TRIGGERS_SQL = `
CREATE TABLE IF NOT EXISTS triggers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword     TEXT NOT NULL,
  match_type  TEXT NOT NULL CHECK (match_type IN ('exact', 'contains', 'starts_with')),
  channel     TEXT NOT NULL CHECK (channel IN ('instagram_dm', 'instagram_comment', 'facebook_message', 'facebook_comment', 'any')),
  reply_text  TEXT NOT NULL,
  action      TEXT NOT NULL DEFAULT 'send_text' CHECK (action IN ('send_text', 'private_reply')),
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);`;

const CREATE_EVENTS_SQL = `
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  channel     TEXT NOT NULL,
  summary     TEXT NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);`;

const CREATE_FLOWS_SQL = `
CREATE TABLE IF NOT EXISTS flows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  nodes       JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);`;

const CREATE_CONTACTS_SQL = `
CREATE TABLE IF NOT EXISTS contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  sender_id     TEXT NOT NULL,
  name          TEXT,
  channel       TEXT NOT NULL,
  message_count INT NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, sender_id)
);
CREATE INDEX IF NOT EXISTS idx_contacts_last_seen ON contacts (last_seen_at DESC);`;

const CREATE_SETTINGS_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);`;

const CREATE_USERS_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);`;

function rowToTrigger(row: {
  id: string;
  keyword: string;
  match_type: MatchType;
  channel: TriggerChannel;
  reply_text: string;
  action: TriggerAction;
  enabled: boolean;
  created_at: Date;
}): Trigger {
  return {
    id: row.id,
    keyword: row.keyword,
    matchType: row.match_type,
    channel: row.channel,
    replyText: row.reply_text,
    action: row.action,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
  };
}

function rowToFlow(row: {
  id: string;
  name: string;
  enabled: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  created_at: Date;
  updated_at: Date;
}): Flow {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    nodes: Array.isArray(row.nodes) ? row.nodes : [],
    edges: Array.isArray(row.edges) ? row.edges : [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function rowToContact(row: {
  id: string;
  platform: 'instagram' | 'facebook';
  sender_id: string;
  name: string | null;
  channel: TriggerChannel;
  message_count: number;
  first_seen_at: Date;
  last_seen_at: Date;
}): Contact {
  return {
    id: row.id,
    platform: row.platform,
    senderId: row.sender_id,
    name: row.name,
    channel: row.channel,
    messageCount: row.message_count,
    firstSeenAt: row.first_seen_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
  };
}

function clampRetention(raw: string | null): number {
  const n = parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return DEFAULT_RETENTION_LIMIT;
  return Math.min(Math.max(n, 10), 5000);
}

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

class PostgresStorage implements Storage {
  private pool: Pool;
  private ensured = false;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  private async ensureSchema(): Promise<void> {
    if (this.ensured) return;
    await this.pool.query(CREATE_TRIGGERS_SQL);
    await this.pool.query(CREATE_EVENTS_SQL);
    await this.pool.query(CREATE_FLOWS_SQL);
    await this.pool.query(CREATE_CONTACTS_SQL);
    await this.pool.query(CREATE_SETTINGS_SQL);
    await this.pool.query(CREATE_USERS_SQL);
    this.ensured = true;
  }

  // ----- users (v2 auth) -----
  async createUser(user: { email: string; passwordHash: string }): Promise<StoredUser> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [user.email, user.passwordHash],
    );
    return { id: rows[0].id, email: rows[0].email, passwordHash: user.passwordHash };
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    if (rows.length === 0) return null;
    return { id: rows[0].id, email: rows[0].email, passwordHash: rows[0].password_hash };
  }

  // ----- triggers -----
  async listTriggers(): Promise<Trigger[]> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      'SELECT * FROM triggers ORDER BY created_at ASC',
    );
    return rows.map(rowToTrigger);
  }

  async createTrigger(t: Omit<Trigger, 'id' | 'createdAt'>): Promise<Trigger> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      `INSERT INTO triggers (keyword, match_type, channel, reply_text, action, enabled)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [t.keyword, t.matchType, t.channel, t.replyText, t.action, t.enabled],
    );
    return rowToTrigger(rows[0]);
  }

  async updateTrigger(
    id: string,
    t: Partial<Omit<Trigger, 'id' | 'createdAt'>>,
  ): Promise<Trigger> {
    await this.ensureSchema();
    const current = await this.pool.query(
      'SELECT * FROM triggers WHERE id = $1',
      [id],
    );
    if (current.rowCount === 0) throw new Error(`Trigger ${id} not found`);
    const merged = { ...rowToTrigger(current.rows[0]), ...t };
    const { rows } = await this.pool.query(
      `UPDATE triggers SET keyword=$1, match_type=$2, channel=$3, reply_text=$4, action=$5, enabled=$6
       WHERE id=$7 RETURNING *`,
      [
        merged.keyword,
        merged.matchType,
        merged.channel,
        merged.replyText,
        merged.action,
        merged.enabled,
        id,
      ],
    );
    return rowToTrigger(rows[0]);
  }

  async deleteTrigger(id: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query('DELETE FROM triggers WHERE id = $1', [id]);
  }

  // ----- events (auto-pruned) -----
  private async retentionLimit(): Promise<number> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      "SELECT value FROM settings WHERE key = 'retention_limit'",
    );
    return clampRetention(rows[0]?.value ?? null);
  }

  async logEvent(type: string, channel: string, summary: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      'INSERT INTO events (type, channel, summary) VALUES ($1, $2, $3)',
      [type, channel, summary],
    );
    // AUTO-PRUNE inside the write path: keep only the latest N events.
    const limit = await this.retentionLimit();
    await this.pool.query(
      `DELETE FROM events WHERE id NOT IN (
         SELECT id FROM events ORDER BY created_at DESC LIMIT $1
       )`,
      [limit],
    );
  }

  async recentEvents(limit: number): Promise<StoredEvent[]> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      'SELECT id, type, channel, summary, created_at FROM events ORDER BY created_at DESC LIMIT $1',
      [Math.min(Math.max(limit, 1), 500)],
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      channel: r.channel,
      summary: r.summary,
      createdAt: r.created_at.toISOString(),
    }));
  }

  // ----- flows -----
  async listFlows(): Promise<Flow[]> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      'SELECT * FROM flows ORDER BY updated_at DESC',
    );
    return rows.map(rowToFlow);
  }

  async getFlow(id: string): Promise<Flow | null> {
    await this.ensureSchema();
    const { rows } = await this.pool.query('SELECT * FROM flows WHERE id = $1', [
      id,
    ]);
    return rows.length ? rowToFlow(rows[0]) : null;
  }

  async createFlow(name: string): Promise<Flow> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      `INSERT INTO flows (name, nodes, edges) VALUES ($1, $2::jsonb, '[]'::jsonb) RETURNING *`,
      [name, JSON.stringify(defaultNodes())],
    );
    return rowToFlow(rows[0]);
  }

  async updateFlow(
    id: string,
    patch: Partial<Pick<Flow, 'name' | 'enabled' | 'nodes' | 'edges'>>,
  ): Promise<Flow> {
    await this.ensureSchema();
    const current = await this.getFlow(id);
    if (!current) throw new Error(`Flow ${id} not found`);
    const { rows } = await this.pool.query(
      `UPDATE flows SET name=$1, enabled=$2, nodes=$3::jsonb, edges=$4::jsonb, updated_at=now()
       WHERE id=$5 RETURNING *`,
      [
        patch.name ?? current.name,
        patch.enabled ?? current.enabled,
        JSON.stringify(patch.nodes ?? current.nodes),
        JSON.stringify(patch.edges ?? current.edges),
        id,
      ],
    );
    return rowToFlow(rows[0]);
  }

  async deleteFlow(id: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query('DELETE FROM flows WHERE id = $1', [id]);
  }

  async duplicateFlow(id: string): Promise<Flow> {
    await this.ensureSchema();
    const current = await this.getFlow(id);
    if (!current) throw new Error(`Flow ${id} not found`);
    const { rows } = await this.pool.query(
      `INSERT INTO flows (name, enabled, nodes, edges)
       VALUES ($1, $2, $3::jsonb, $4::jsonb) RETURNING *`,
      [
        `${current.name} (copy)`,
        current.enabled,
        JSON.stringify(current.nodes),
        JSON.stringify(current.edges),
      ],
    );
    return rowToFlow(rows[0]);
  }

  // ----- contacts -----
  async upsertContact(input: {
    platform: 'instagram' | 'facebook';
    senderId: string;
    name?: string | null;
    channel: TriggerChannel;
  }): Promise<Contact> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      `INSERT INTO contacts (platform, sender_id, name, channel)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (platform, sender_id) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, contacts.name),
         channel = EXCLUDED.channel,
         message_count = contacts.message_count + 1,
         last_seen_at = now()
       RETURNING *`,
      [input.platform, input.senderId, input.name ?? null, input.channel],
    );
    return rowToContact(rows[0]);
  }

  async listContacts(query = '', limit = 100): Promise<Contact[]> {
    await this.ensureSchema();
    const q = `%${query.trim().toLowerCase()}%`;
    const { rows } = await this.pool.query(
      `SELECT * FROM contacts
       WHERE $1 = '%%' OR LOWER(COALESCE(name, '') || ' ' || sender_id || ' ' || platform) LIKE $1
       ORDER BY last_seen_at DESC LIMIT $2`,
      [q, Math.min(Math.max(limit, 1), 500)],
    );
    return rows.map(rowToContact);
  }

  async countContacts(): Promise<number> {
    await this.ensureSchema();
    const { rows } = await this.pool.query('SELECT COUNT(*)::int AS n FROM contacts');
    return rows[0].n as number;
  }

  // ----- settings / stats / danger zone -----
  async getSetting(key: string): Promise<string | null> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      'SELECT value FROM settings WHERE key = $1',
      [key],
    );
    return rows[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value],
    );
  }

  async getStats(): Promise<DashboardStats> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM events WHERE type = 'message_sent') AS messages_sent,
        (SELECT COUNT(*)::int FROM events WHERE type = 'trigger_matched') AS triggers_matched,
        (SELECT COUNT(*)::int FROM events WHERE type = 'flow_executed') AS flows_executed,
        (SELECT COUNT(*)::int FROM flows WHERE enabled) AS active_flows,
        (SELECT COUNT(*)::int FROM contacts) AS total_contacts,
        (SELECT COUNT(*)::int FROM events) AS total_events
    `);
    const r = rows[0];
    return {
      messagesSent: r.messages_sent,
      triggersMatched: r.triggers_matched,
      flowsExecuted: r.flows_executed,
      activeFlows: r.active_flows,
      totalContacts: r.total_contacts,
      totalEvents: r.total_events,
    };
  }

  async clearAll(): Promise<void> {
    await this.ensureSchema();
    await this.pool.query('DELETE FROM triggers');
    await this.pool.query('DELETE FROM flows');
    await this.pool.query('DELETE FROM contacts');
    await this.pool.query('DELETE FROM events');
  }

  async deleteUserData(senderId: string): Promise<{
    contactsDeleted: number;
    eventsDeleted: number;
  }> {
    await this.ensureSchema();
    const id = senderId.trim();
    if (!id) return { contactsDeleted: 0, eventsDeleted: 0 };

    const contacts = await this.pool.query(
      'DELETE FROM contacts WHERE sender_id = $1 OR sender_id = $2',
      [id, `comment:${id}`],
    );
    const events = await this.pool.query(
      'DELETE FROM events WHERE summary LIKE $1',
      [`%${id}%`],
    );
    return {
      contactsDeleted: contacts.rowCount ?? 0,
      eventsDeleted: events.rowCount ?? 0,
    };
  }
}

// ---------------------------------------------------------------------------
// JSON file fallback (dev only)
// ---------------------------------------------------------------------------

interface JsonContact extends Contact {}

class JsonFileStorage implements Storage {
  private dir = path.join(process.cwd(), 'data');
  private triggersFile = path.join(this.dir, 'triggers.json');
  private eventsFile = path.join(this.dir, 'events.json');
  private flowsFile = path.join(this.dir, 'flows.json');
  private contactsFile = path.join(this.dir, 'contacts.json');
  private settingsFile = path.join(this.dir, 'settings.json');
  private usersFile = path.join(this.dir, 'users.json');

  private async readJson<T>(file: string, fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(file, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(file: string, value: unknown): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
  }

  // ----- users (v2 auth) -----
  async createUser(user: { email: string; passwordHash: string }): Promise<StoredUser> {
    const users = await this.readJson<StoredUser[]>(this.usersFile, []);
    if (users.some((u) => u.email === user.email)) {
      throw new Error('Email already registered');
    }
    const created: StoredUser = {
      id: crypto.randomUUID(),
      email: user.email,
      passwordHash: user.passwordHash,
    };
    users.push(created);
    await this.writeJson(this.usersFile, users);
    return created;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const users = await this.readJson<StoredUser[]>(this.usersFile, []);
    return users.find((u) => u.email === email) ?? null;
  }

  // ----- triggers -----
  async listTriggers(): Promise<Trigger[]> {
    return this.readJson<Trigger[]>(this.triggersFile, []);
  }

  async createTrigger(t: Omit<Trigger, 'id' | 'createdAt'>): Promise<Trigger> {
    const triggers = await this.listTriggers();
    const trigger: Trigger = {
      ...t,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    triggers.push(trigger);
    await this.writeJson(this.triggersFile, triggers);
    return trigger;
  }

  async updateTrigger(
    id: string,
    t: Partial<Omit<Trigger, 'id' | 'createdAt'>>,
  ): Promise<Trigger> {
    const triggers = await this.listTriggers();
    const idx = triggers.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error(`Trigger ${id} not found`);
    triggers[idx] = { ...triggers[idx], ...t };
    await this.writeJson(this.triggersFile, triggers);
    return triggers[idx];
  }

  async deleteTrigger(id: string): Promise<void> {
    const triggers = await this.listTriggers();
    await this.writeJson(
      this.triggersFile,
      triggers.filter((x) => x.id !== id),
    );
  }

  // ----- events (auto-pruned) -----
  private async retentionLimit(): Promise<number> {
    const v = await this.getSetting('retention_limit');
    return clampRetention(v);
  }

  async logEvent(type: string, channel: string, summary: string): Promise<void> {
    const limit = await this.retentionLimit();
    const events = await this.readJson<StoredEvent[]>(this.eventsFile, []);
    events.unshift({
      id: crypto.randomUUID(),
      type,
      channel,
      summary,
      createdAt: new Date().toISOString(),
    });
    // AUTO-PRUNE inside the write path.
    await this.writeJson(this.eventsFile, events.slice(0, limit));
  }

  async recentEvents(limit: number): Promise<StoredEvent[]> {
    const events = await this.readJson<StoredEvent[]>(this.eventsFile, []);
    return events.slice(0, Math.min(Math.max(limit, 1), 500));
  }

  // ----- flows -----
  async listFlows(): Promise<Flow[]> {
    const flows = await this.readJson<Flow[]>(this.flowsFile, []);
    return flows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getFlow(id: string): Promise<Flow | null> {
    const flows = await this.readJson<Flow[]>(this.flowsFile, []);
    return flows.find((f) => f.id === id) ?? null;
  }

  async createFlow(name: string): Promise<Flow> {
    const flows = await this.readJson<Flow[]>(this.flowsFile, []);
    const now = new Date().toISOString();
    const flow: Flow = {
      id: crypto.randomUUID(),
      name,
      enabled: true,
      nodes: defaultNodes(),
      edges: [],
      createdAt: now,
      updatedAt: now,
    };
    flows.push(flow);
    await this.writeJson(this.flowsFile, flows);
    return flow;
  }

  async updateFlow(
    id: string,
    patch: Partial<Pick<Flow, 'name' | 'enabled' | 'nodes' | 'edges'>>,
  ): Promise<Flow> {
    const flows = await this.readJson<Flow[]>(this.flowsFile, []);
    const idx = flows.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error(`Flow ${id} not found`);
    flows[idx] = {
      ...flows[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.writeJson(this.flowsFile, flows);
    return flows[idx];
  }

  async deleteFlow(id: string): Promise<void> {
    const flows = await this.readJson<Flow[]>(this.flowsFile, []);
    await this.writeJson(
      this.flowsFile,
      flows.filter((f) => f.id !== id),
    );
  }

  async duplicateFlow(id: string): Promise<Flow> {
    const flow = await this.getFlow(id);
    if (!flow) throw new Error(`Flow ${id} not found`);
    const flows = await this.readJson<Flow[]>(this.flowsFile, []);
    const now = new Date().toISOString();
    const copy: Flow = {
      ...flow,
      id: crypto.randomUUID(),
      name: `${flow.name} (copy)`,
      createdAt: now,
      updatedAt: now,
    };
    flows.push(copy);
    await this.writeJson(this.flowsFile, flows);
    return copy;
  }

  // ----- contacts -----
  async upsertContact(input: {
    platform: 'instagram' | 'facebook';
    senderId: string;
    name?: string | null;
    channel: TriggerChannel;
  }): Promise<Contact> {
    const contacts = await this.readJson<JsonContact[]>(this.contactsFile, []);
    const now = new Date().toISOString();
    const idx = contacts.findIndex(
      (c) => c.platform === input.platform && c.senderId === input.senderId,
    );
    if (idx === -1) {
      const contact: Contact = {
        id: crypto.randomUUID(),
        platform: input.platform,
        senderId: input.senderId,
        name: input.name ?? null,
        channel: input.channel,
        messageCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      };
      contacts.push(contact);
      await this.writeJson(this.contactsFile, contacts);
      return contact;
    }
    contacts[idx] = {
      ...contacts[idx],
      name: input.name ?? contacts[idx].name,
      channel: input.channel,
      messageCount: contacts[idx].messageCount + 1,
      lastSeenAt: now,
    };
    await this.writeJson(this.contactsFile, contacts);
    return contacts[idx];
  }

  async listContacts(query = '', limit = 100): Promise<Contact[]> {
    const contacts = await this.readJson<JsonContact[]>(this.contactsFile, []);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? contacts.filter((c) =>
          `${c.name ?? ''} ${c.senderId} ${c.platform}`.toLowerCase().includes(q),
        )
      : contacts;
    return filtered
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, Math.min(Math.max(limit, 1), 500));
  }

  async countContacts(): Promise<number> {
    const contacts = await this.readJson<JsonContact[]>(this.contactsFile, []);
    return contacts.length;
  }

  // ----- settings / stats / danger zone -----
  async getSetting(key: string): Promise<string | null> {
    const settings = await this.readJson<Record<string, string>>(
      this.settingsFile,
      {},
    );
    return settings[key] ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const settings = await this.readJson<Record<string, string>>(
      this.settingsFile,
      {},
    );
    settings[key] = value;
    await this.writeJson(this.settingsFile, settings);
  }

  async getStats(): Promise<DashboardStats> {
    const events = await this.readJson<StoredEvent[]>(this.eventsFile, []);
    const flows = await this.readJson<Flow[]>(this.flowsFile, []);
    const count = (t: string) => events.filter((e) => e.type === t).length;
    return {
      messagesSent: count('message_sent'),
      triggersMatched: count('trigger_matched'),
      flowsExecuted: count('flow_executed'),
      activeFlows: flows.filter((f) => f.enabled).length,
      totalContacts: await this.countContacts(),
      totalEvents: events.length,
    };
  }

  async clearAll(): Promise<void> {
    await this.writeJson(this.triggersFile, []);
    await this.writeJson(this.flowsFile, []);
    await this.writeJson(this.contactsFile, []);
    await this.writeJson(this.eventsFile, []);
  }

  async deleteUserData(senderId: string): Promise<{
    contactsDeleted: number;
    eventsDeleted: number;
  }> {
    const id = senderId.trim();
    if (!id) return { contactsDeleted: 0, eventsDeleted: 0 };

    const contacts = await this.readJson<JsonContact[]>(this.contactsFile, []);
    const keepContacts = contacts.filter(
      (c) => c.senderId !== id && c.senderId !== `comment:${id}`,
    );
    const events = await this.readJson<StoredEvent[]>(this.eventsFile, []);
    const keepEvents = events.filter((e) => !e.summary.includes(id));

    await this.writeJson(this.contactsFile, keepContacts);
    await this.writeJson(this.eventsFile, keepEvents);

    return {
      contactsDeleted: contacts.length - keepContacts.length,
      eventsDeleted: events.length - keepEvents.length,
    };
  }
}

let cached: Storage | null = null;

/** Returns the Postgres store when DATABASE_URL is set, else the JSON fallback. */
export function getStore(): Storage {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (url) {
    console.log('[store] using Postgres storage');
    cached = new PostgresStorage(url);
  } else {
    console.log(
      '[store] DATABASE_URL not set — using local JSON file storage (dev only)',
    );
    cached = new JsonFileStorage();
  }
  return cached;
}
