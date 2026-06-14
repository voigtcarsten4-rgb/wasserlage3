# Auto-Deploy nach Cloudflare Pages (wasserlage3)

Damit jeder Push nach `main` automatisch baut (Vite) und nach Cloudflare Pages
(`wavebite.info`) deployt:

## 1. Workflow-Datei anlegen: `.github/workflows/deploy.yml`

```yaml
name: Build & Deploy (Cloudflare Pages)
on:
  push:
    branches: [main]
  workflow_dispatch:
concurrency:
  group: pages-deploy
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Build (Vite, Cloudflare base '/')
        run: npm run build
        env:
          CF_PAGES: '1'
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=wasserlage3 --branch=main
```

## 2. Zwei Repo-Secrets hinterlegen
GitHub → Repo `wasserlage3` → **Settings → Secrets and variables → Actions → New repository secret**:
- `CLOUDFLARE_API_TOKEN` — Cloudflare → My Profile → API Tokens → *Create Token* → Vorlage **„Cloudflare Pages — Edit"**.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare → Workers & Pages → rechts „Account ID".

Danach deployt jeder Push automatisch; Status unter dem Tab **Actions**.
