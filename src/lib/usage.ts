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

function row(y: number, name: string, bucket: TokenBucket): string {
  return `<text x="42" y="${y}" fill="#a1a1aa" font-size="14" font-family="Inter,system-ui,sans-serif">${esc(name)}</text><text x="598" y="${y}" text-anchor="end" fill="#fafafa" font-size="26" font-weight="800" font-family="Inter,system-ui,sans-serif">${fmt(bucket.tokens)}</text><text x="598" y="${y + 20}" text-anchor="end" fill="#71717a" font-size="12" font-family="Inter,system-ui,sans-serif">in ${fmt(bucket.input)} · out ${fmt(bucket.output)} · cache ${fmt(bucket.cache)} · reason ${fmt(bucket.reasoning)}</text>`;
}

export function renderCard(kind: string, data: UsageData): string {
  const cat = data.categories[kind] || data.categories.total;
  const colors: Record<string, string> = { hermes: "#22c55e", symphony: "#8b5cf6", total: "#38bdf8" };
  const c = colors[kind] || colors.total;
  const pct = cat.month.tokens ? Math.min(100, Math.round((cat.today.tokens / cat.month.tokens) * 100)) : 0;
  const updated = new Date(data.generatedAt).toLocaleString("ja-JP", { timeZone: data.timezone, hour: "2-digit", minute: "2-digit" });
  const bar = Math.max(4, Math.round(556 * pct / 100));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300" viewBox="0 0 640 300" role="img" aria-label="${esc(cat.label)} token usage"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#09090b"/><stop offset="0.58" stop-color="#18181b"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-opacity=".28"/></filter></defs><rect x="8" y="8" width="624" height="284" rx="24" fill="url(#bg)" filter="url(#shadow)"/><rect x="8" y="8" width="624" height="284" rx="24" fill="none" stroke="#3f3f46"/><circle cx="540" cy="58" r="78" fill="${c}" opacity=".16"/><circle cx="540" cy="58" r="46" fill="${c}" opacity=".22"/><text x="40" y="58" fill="#fafafa" font-size="30" font-weight="900" font-family="Inter,system-ui,sans-serif">${esc(cat.label)}</text><text x="42" y="84" fill="#a1a1aa" font-size="13" font-family="Inter,system-ui,sans-serif">${esc(data.today)} JST · updated ${esc(updated)}</text><rect x="42" y="110" width="556" height="10" rx="5" fill="#27272a"/><rect x="42" y="110" width="${bar}" height="10" rx="5" fill="${c}"/><text x="42" y="139" fill="#71717a" font-size="12" font-family="Inter,system-ui,sans-serif">today / month: ${pct}% · sessions today ${cat.today.sessions}</text>${row(175, "Today tokens", cat.today)}${row(232, "This month tokens", cat.month)}<text x="42" y="270" fill="#52525b" font-size="11" font-family="Inter,system-ui,sans-serif">Local Hermes state.db lower-bound estimate; excludes provider-side hidden/retry usage.</text></svg>`;
}
