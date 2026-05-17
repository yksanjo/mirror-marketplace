import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import type { MirrorListing, Subscription } from "./marketplace-types";

const KV_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const KEY_LISTINGS = "marketplace:listings";
const KEY_SUBS = "marketplace:subs";
const KEY_USED_SIGS = "marketplace:used_sigs";

let redis: Redis | null = null;
function kv(): Redis | null {
  if (!KV_URL || !KV_TOKEN) return null;
  if (!redis) redis = new Redis({ url: KV_URL, token: KV_TOKEN });
  return redis;
}

const DATA_DIR =
  process.env.MARKETPLACE_DATA_DIR ?? path.join(process.cwd(), "data");
const LISTINGS_FILE = path.join(DATA_DIR, "listings.json");
const SUBS_FILE = path.join(DATA_DIR, "subscriptions.json");
const USED_SIGS_FILE = path.join(DATA_DIR, "used_signatures.json");

let listingsCache: Map<string, MirrorListing> | null = null;
let subsCache: Map<string, Subscription[]> | null = null;
let usedSigsCache: Set<string> | null = null;

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(file, "utf8");
    return JSON.parse(buf) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await ensureDir();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}

function parseListing(raw: unknown): MirrorListing | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as MirrorListing;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as MirrorListing;
  return null;
}

function parseSubs(raw: unknown): Subscription[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as Subscription[]) : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw as Subscription[];
  return [];
}

export async function loadListings(): Promise<Map<string, MirrorListing>> {
  if (listingsCache) return listingsCache;
  const r = kv();
  if (r) {
    const obj = (await r.hgetall(KEY_LISTINGS)) ?? {};
    const map = new Map<string, MirrorListing>();
    for (const [id, raw] of Object.entries(obj)) {
      const listing = parseListing(raw);
      if (listing) map.set(id, listing);
    }
    listingsCache = map;
    return map;
  }
  const arr = await readJson<MirrorListing[]>(LISTINGS_FILE, []);
  listingsCache = new Map(arr.map((l) => [l.id, l]));
  return listingsCache;
}

export async function saveListings(): Promise<void> {
  if (!listingsCache) return;
  const r = kv();
  if (r) {
    const entries = Array.from(listingsCache.values());
    if (entries.length === 0) return;
    const payload: Record<string, string> = {};
    for (const l of entries) payload[l.id] = JSON.stringify(l);
    await r.hset(KEY_LISTINGS, payload);
    return;
  }
  await writeJson(LISTINGS_FILE, Array.from(listingsCache.values()));
}

export async function loadSubs(): Promise<Map<string, Subscription[]>> {
  if (subsCache) return subsCache;
  const r = kv();
  if (r) {
    const obj = (await r.hgetall(KEY_SUBS)) ?? {};
    const map = new Map<string, Subscription[]>();
    for (const [wallet, raw] of Object.entries(obj)) {
      map.set(wallet, parseSubs(raw));
    }
    subsCache = map;
    return map;
  }
  const obj = await readJson<Record<string, Subscription[]>>(SUBS_FILE, {});
  subsCache = new Map(Object.entries(obj));
  return subsCache;
}

export async function saveSubs(): Promise<void> {
  if (!subsCache) return;
  const r = kv();
  if (r) {
    const payload: Record<string, string> = {};
    for (const [wallet, list] of subsCache.entries()) {
      payload[wallet] = JSON.stringify(list);
    }
    if (Object.keys(payload).length === 0) return;
    await r.hset(KEY_SUBS, payload);
    return;
  }
  await writeJson(SUBS_FILE, Object.fromEntries(subsCache));
}

export async function loadUsedSignatures(): Promise<Set<string>> {
  if (usedSigsCache) return usedSigsCache;
  const r = kv();
  if (r) {
    const members = (await r.smembers(KEY_USED_SIGS)) ?? [];
    usedSigsCache = new Set(members.map((m) => String(m)));
    return usedSigsCache;
  }
  const arr = await readJson<string[]>(USED_SIGS_FILE, []);
  usedSigsCache = new Set(arr);
  return usedSigsCache;
}

export async function markSignatureUsed(signature: string): Promise<void> {
  const r = kv();
  if (r) {
    await r.sadd(KEY_USED_SIGS, signature);
    if (usedSigsCache) usedSigsCache.add(signature);
    return;
  }
  const sigs = await loadUsedSignatures();
  if (sigs.has(signature)) return;
  sigs.add(signature);
  await writeJson(USED_SIGS_FILE, Array.from(sigs));
}
