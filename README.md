# proba-web

Web client for **Proba**, an AI-native platform for product launch and ad-testing campaigns. Guardrails are enforced in code, and a person approves every plan and every change to spend.

## Overview

`proba-web` is a server-driven UI. It connects to the [Interaction Hub (proba-hub)](https://github.com/smallseedlabs/proba-hub) over the [proba-protocol](https://github.com/smallseedlabs/proba-protocol) and renders the components the Hub sends: plans, approvals, questions, charts, tables, spend bars and more.

## Features

- **Sign-in** with work email and password, validation, loading and error states, behind a pluggable `AuthClient` (`src/lib/auth/`).
- **App shell** with a sidebar (Goals, Approvals, Activity, Campaigns, Settings) and a top bar with a workspace switcher, user menu, **Pause all** and **Emergency stop** (with confirmation).
- **Empty, loading, error and reconnecting states** throughout.
- **Accessibility**: WCAG 2.2 AA, checked with axe in the E2E suite; full keyboard navigation, skip link, ARIA menus, dialogs with focus trapping, and reduced-motion support.
- **Responsive** down to tablet (768px): the sidebar collapses to a rail, and goals open full-width.

## Stack

React 18 · TypeScript (strict) · Vite 5 · Tailwind CSS 3 · lucide-react · Vitest + Testing Library · Playwright + axe-core · nginx

## Project structure

```
src/
├── App.tsx, main.tsx            # Entry, session handling
├── components/
│   ├── auth/                    # Sign-in page
│   ├── brand/                   # Proba logo
│   ├── registry/                # Protocol component registry (all 17 components)
│   ├── shell/                   # App shell: sidebar, top bar, banners, emergency stop
│   ├── ui/                      # Design system primitives (button, card, field, menu, dialog, toast…)
│   └── views/                   # Goals, Approvals, Activity, Campaigns, Settings
├── lib/
│   ├── auth/                    # AuthClient interface and Hub implementation
│   ├── transport/               # SSE transport with reconnection and de-duplication
│   ├── demo/                    # Demo data (development only, excluded from production builds)
│   ├── config.tsx, router.ts, services.ts, utils/
└── state/                       # Workspace reducer, selectors and provider
e2e/                             # Playwright E2E and accessibility tests
e2e-screenshots/                 # Screenshot capture for docs/screenshots
```

## Getting started

Requires Node.js 20.

```bash
npm install
cp .env.example .env    # optional; .env is gitignored
```

### Run against the Hub

```bash
VITE_API_BASE_URL=http://localhost:3000 npm run dev
```

### Demo mode (development only)

Demo mode runs the full UI with sample data and no backend. It is a **build-time** flag that is off by default; the demo code is removed from normal builds entirely, and `npm run check:bundle` verifies that.

```bash
npm run dev:demo
```

Sign in with any email address and a password of at least 8 characters.

## Configuration

| Build time (Vite)       | Runtime (Docker)  | Default            | Purpose                                     |
| ----------------------- | ----------------- | ------------------ | ------------------------------------------- |
| `VITE_API_BASE_URL`     | `API_BASE_URL`    | `http://localhost:3000` | Hub base URL                           |
| `VITE_AUTH_LOGIN_PATH`  | `AUTH_LOGIN_PATH` | `/v1/auth/login`   | Hub sign-in endpoint                        |
| `VITE_DEMO_MODE`        | n/a               | `false`            | Development-only demo data                  |

Runtime values are injected into `window.ENV` by `docker/env.sh` and take precedence over build-time values.

## Authentication

`HubAuthClient` (`src/lib/auth/hub.ts`) expects the Hub to provide:

- `POST /v1/auth/login` with `{ email, password }`, returning `{ token, user, workspaces? }`
- `POST /v1/auth/logout` (Bearer token)

The Hub does not provide these endpoints yet. Until it does, sign-in against a live Hub reports that the service is unavailable. The session token is used for `GET /v1/events` (SSE) and `POST /v1/commands`.

## Scripts

| Script                 | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Development server                                    |
| `npm run dev:demo`     | Development server with demo data                     |
| `npm run build`        | Production build to `dist/`                           |
| `npm run check:bundle` | Fails if demo or development content is in `dist/`    |
| `npm run lint`         | ESLint (zero warnings)                                |
| `npm run typecheck`    | TypeScript                                            |
| `npm run test`         | Unit tests                                            |
| `npm run test:e2e`     | Playwright E2E and accessibility tests                |
| `npm run screenshots`  | Regenerate `docs/screenshots/` at 1440×900            |
| `npm run validate`     | Everything above, in order                            |

## Docker

```bash
docker build -t proba-web .
docker run -p 5173:8080 -e API_BASE_URL=https://hub.example.com proba-web
```

Docker Compose: `API_BASE_URL=http://proba-hub:3000 docker-compose up`.
Docker Swarm: `docker network create --driver overlay proba-network && docker stack deploy -c deploy/stack.yml proba`.

## Protocol

Pinned to the `github:smallseedlabs/proba-protocol#v0.1.2` release tag.

All 17 protocol components are implemented: `text`, `plan_card`, `approval_card`, `question_choice`, `question_text`, `status_banner`, `metric_tile`, `metric_chart`, `table`, `spend_bar`, `timeline_item`, `goal_summary`, `alert`, `form`, `number_input`, `select` and `confirm`.

## Screenshots

See [`docs/screenshots/`](./docs/screenshots).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache-2.0 © Small Seed Labs
