import { getUsage } from "@/src/lib/usage";

export default async function Home() {
  const data = await getUsage();
  return <main className="wrap"><section className="hero"><h1>Hermes × Symphony Token Card</h1><p className="muted">GitHub README に埋め込める、Hermes Agent / Symphony の日次・月次トークン利用カードです。データは <code>scripts/export_usage.py</code> がローカルの Hermes <code>state.db</code> から集計して <code>data/usage.json</code> と SVG を更新します。</p><p className="muted">Last updated: {new Date(data.generatedAt).toLocaleString("ja-JP", { timeZone: data.timezone })}</p><div className="cards"><img className="card" alt="Hermes" src="/api/card/hermes.svg" /><img className="card" alt="Symphony" src="/api/card/symphony.svg" /></div><p className="muted">Endpoints: <code>/api/card/hermes.svg</code>, <code>/api/card/symphony.svg</code>, <code>/api/badge/hermes.svg?metric=today|month|all</code></p></section></main>;
}
