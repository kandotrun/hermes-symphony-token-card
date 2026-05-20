# Hermes × Symphony Token Badges

GitHub profile README に埋め込める、Hermes Agent / Symphony のシンプルなトークン利用バッヂです。

- 日次トークン
- 月次トークン
- Hermes Agent と Symphony の分割表示
- `~/.hermes/state.db` 由来のローカル下限推定値
- 静的 SVG と Next.js API endpoint の両対応

## Embed

Vercel などにデプロイした場合:

```md
![Hermes tokens](https://YOUR_DOMAIN/api/card/hermes.svg)
![Symphony tokens](https://YOUR_DOMAIN/api/card/symphony.svg)
![Hermes today](https://YOUR_DOMAIN/api/badge/hermes.svg?metric=today)
![Hermes month](https://YOUR_DOMAIN/api/badge/hermes.svg?metric=month)
```

デプロイなしで raw SVG を使う場合:

```md
![Hermes tokens](https://raw.githubusercontent.com/kandotrun/hermes-symphony-token-card/main/public/hermes.svg)
![Symphony tokens](https://raw.githubusercontent.com/kandotrun/hermes-symphony-token-card/main/public/symphony.svg)
```

## Update data

```bash
python scripts/export_usage.py --out .
git add data/usage.json public/*.svg
git commit -m "data: update token usage"
git push
```

`--symphony-pattern` で Symphony 判定用の正規表現を変更できます。既定では session id / source / title / model_config に `symphony` などが含まれるものを Symphony、それ以外を Hermes Agent として扱います。

## Development

```bash
npm install
npm run check
```

## Caveat

Hermes の `sessions` table に保存された usage から集計するため、provider 側の hidden usage、retry、auxiliary LLM call、課金にだけ現れる利用量は含まれないことがあります。これは請求額ではなく、ローカル観測できる下限推定値です。
