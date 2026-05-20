import fs from "node:fs/promises";
import path from "node:path";

export type TokenBucket = { tokens: number; input: number; output: number; cache: number; reasoning: number; sessions: number };
export type UsageCategory = { label: string; today: TokenBucket; month: TokenBucket; allTime: TokenBucket };
export type UsageData = { generatedAt: string; timezone: string; today: string; month: string; note: string; categories: Record<string, UsageCategory> };

const zero = (): TokenBucket => ({ tokens: 0, input: 0, output: 0, cache: 0, reasoning: 0, sessions: 0 });
const empty: UsageData = {
  generatedAt: new Date(0).toISOString(),
  timezone: "Asia/Tokyo",
  today: "unknown",
  month: "unknown",
  note: "No data exported yet",
  categories: {
    hermes: { label: "Hermes Agent", today: zero(), month: zero(), allTime: zero() },
    symphony: { label: "Symphony", today: zero(), month: zero(), allTime: zero() },
    total: { label: "Total", today: zero(), month: zero(), allTime: zero() },
  },
};

export async function getUsage(): Promise<UsageData> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "usage.json"), "utf8")) as UsageData;
  } catch {
    return empty;
  }
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] || c));
}

export function renderBadge(label: string, value: string, color = "#6366f1"): string {
  const left = Math.max(64, label.length * 7 + 18);
  const right = Math.max(64, value.length * 7 + 18);
  const w = left + right;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}"><clipPath id="r"><rect width="${w}" height="20" rx="5" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${left}" height="20" fill="#27272a"/><rect x="${left}" width="${right}" height="20" fill="${color}"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11"><text x="${left / 2}" y="14">${esc(label)}</text><text x="${left + right / 2}" y="14" font-weight="700">${esc(value)}</text></g></svg>`;
}

export function renderSummaryBadge(kind: string, data: UsageData): string {
  const cat = data.categories[kind] || data.categories.total;
  const colors: Record<string, string> = { hermes: "#22c55e", symphony: "#8b5cf6", total: "#38bdf8" };
  const value = `today ${fmt(cat.today.tokens)} / month ${fmt(cat.month.tokens)}`;
  return renderBadge(`${cat.label} tokens`, value, colors[kind] || colors.total);
}

export function renderCard(kind: string, data: UsageData): string {
  return renderSummaryBadge(kind, data);
}
