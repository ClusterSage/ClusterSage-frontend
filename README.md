# ClusterSage Frontend

Next.js dashboard for ClusterSage.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment

Copy `.env.example` to `.env.local` for local development.

Key variables:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_AGENT_IMAGE`
- `NEXT_PUBLIC_AGENT_CHART`
- `NEXT_PUBLIC_AGENT_CHART_VERSION`

## Docker

```bash
docker build -t clustersage-frontend .
```

The image uses a multi-stage build and the runtime container runs as the non-root `node` user.
