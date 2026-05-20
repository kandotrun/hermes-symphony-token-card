import { NextRequest, NextResponse } from "next/server";
import { fmt, getUsage, renderBadge } from "@/src/lib/usage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind: raw } = await params;
  const kind = raw.replace(/\.svg$/, "").toLowerCase();
  const data = await getUsage();
  const metric = req.nextUrl.searchParams.get("metric") || "today";
  const cat = data.categories[kind] || data.categories.total;
  const bucket = metric === "month" ? cat.month : metric === "all" ? cat.allTime : cat.today;
  const colors: Record<string, string> = { hermes: "#22c55e", symphony: "#8b5cf6", total: "#38bdf8" };
  const label = `${cat.label} ${metric}`;
  return new NextResponse(renderBadge(label, fmt(bucket.tokens), colors[kind] || colors.total), { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" } });
}
