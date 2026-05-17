import { promises as fs } from "fs";
import path from "path";
import type { MirrorListing, Subscription } from "./marketplace-types";

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

export async function loadListings(): Promise<Map<string, MirrorListing>> {
  if (listingsCache) return listingsCache;
  const arr = await readJson<MirrorListing[]>(LISTINGS_FILE, []);
  listingsCache = new Map(arr.map((l) => [l.wallet, l]));
  return listingsCache;
}

export async function saveListings(): Promise<void> {
  if (!listingsCache) return;
  await writeJson(LISTINGS_FILE, Array.from(listingsCache.values()));
}

export async function loadSubs(): Promise<Map<string, Subscription[]>> {
  if (subsCache) return subsCache;
  const obj = await readJson<Record<string, Subscription[]>>(SUBS_FILE, {});
  subsCache = new Map(Object.entries(obj));
  return subsCache;
}

export async function saveSubs(): Promise<void> {
  if (!subsCache) return;
  await writeJson(SUBS_FILE, Object.fromEntries(subsCache));
}

export async function loadUsedSignatures(): Promise<Set<string>> {
  if (usedSigsCache) return usedSigsCache;
  const arr = await readJson<string[]>(USED_SIGS_FILE, []);
  usedSigsCache = new Set(arr);
  return usedSigsCache;
}

export async function markSignatureUsed(signature: string): Promise<void> {
  const sigs = await loadUsedSignatures();
  if (sigs.has(signature)) return;
  sigs.add(signature);
  await writeJson(USED_SIGS_FILE, Array.from(sigs));
}
