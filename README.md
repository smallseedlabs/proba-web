# proba-web

Client UI for **Proba** - an AI-native platform for testing products with ads.

## Overview

`proba-web` is a server-driven UI that communicates with the [Interaction Hub (proba-hub)](https://github.com/smallseedlabs/proba-hub) through the [proba-protocol](https://github.com/smallseedlabs/proba-protocol). It renders dynamic UI components based on events from the server, providing a real-time interface for managing campaigns, approvals, and goals.

## Architecture

### Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Vitest** - Unit testing
- **Playwright** - E2E testing
- **nginx** - Production web server

### Key Components

1. **Transport Layer** (`src/lib/transport/`)
   - SSE transport for real-time events with automatic reconnection
   - Mock transport for development without backend
   - Command sending via REST endpoint

2. **Component Registry** (`src/components/registry/`)
   - Maps protocol UI components to React components
   - Validates props against protocol schemas
   - Graceful fallback for unknown components

3. **Layout** (`src/components/layout/`)
   - Top bar with Pause/Kill controls
   - Left workspace with goals, approvals, and activity
   - Right chat panel with inline component rendering

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

Run in **mock mode** (uses fixture data, no backend required):

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

Run against a **real backend**:

```bash
VITE_API_BASE_URL=http://localhost:4000 VITE_MOCK_MODE=false npm run dev
```

### Building

```bash
npm run build
```

Output is in `dist/`.

### Preview Production Build

```bash
npm run preview
```

## Environment Variables

Runtime configuration is injected via `window.ENV` (see `docker/env.sh`).

### Build-time (Vite)

- `VITE_API_BASE_URL` - Hub API base URL (default: `http://localhost:4000`)
- `VITE_MOCK_MODE` - Use mock transport (default: `false`)

### Runtime (Docker)

- `API_BASE_URL` - Hub API base URL
- `MOCK_MODE` - Use mock transport (`true`/`false`)

Runtime variables take precedence over build-time variables.

## Testing

### Unit Tests

```bash
npm run test
npm run test:watch
```

### E2E Tests

```bash
npm run build
npm run test:e2e
```

Run with UI:

```bash
npm run test:e2e:ui
```

### Full Validation

```bash
npm run validate
```

Runs lint, typecheck, unit tests, and E2E tests.

## Docker

### Build

```bash
docker build -t proba-web:latest .
```

### Run (Mock Mode)

```bash
docker run -p 3000:8080 -e MOCK_MODE=true proba-web:latest
```

### Run (Against Hub)

```bash
docker run -p 3000:8080 -e API_BASE_URL=http://proba-hub:4000 -e MOCK_MODE=false proba-web:latest
```

### Docker Compose

Mock mode (no backend):

```bash
docker-compose up
```

With Hub (requires proba-hub running):

```bash
API_BASE_URL=http://proba-hub:4000 MOCK_MODE=false docker-compose up
```

### Docker Swarm

Deploy to Swarm:

```bash
docker stack deploy -c deploy/stack.yml proba
```

Requires `proba-network` network:

```bash
docker network create --driver overlay proba-network
```

## Project Structure

```
proba-web/
├── src/
│   ├── components/
│   │   ├── registry/          # UI component registry
│   │   ├── layout/            # Layout components
│   │   ├── AuthScreen.tsx
│   │   └── MainLayout.tsx
│   ├── context/               # React context providers
│   ├── lib/
│   │   ├── transport/         # Transport layer
│   │   └── config.tsx         # Runtime config
│   ├── test/                  # Test setup
│   ├── index.css
│   ├── main.tsx
│   └── App.tsx
├── e2e/                       # E2E tests
├── docker/                    # Docker assets
├── deploy/                    # Deployment configs
└── public/
```

## Protocol

This UI follows the [@smallseedlabs/proba-protocol](https://github.com/smallseedlabs/proba-protocol).

**Current version:** `github:smallseedlabs/proba-protocol#v0.1.0`

### Supported Components

- ✅ `text` - Formatted text with markdown
- ✅ `plan_card` - Multi-step plans
- ✅ `approval_card` - Action approvals
- ✅ `question_choice` - Multiple choice
- ✅ `question_text` - Free text input
- ✅ `status_banner` - Status with progress
- ✅ `metric_tile` - Single metric
- ✅ `goal_summary` - Goal overview
- ✅ `alert` - Notifications
- ⚠️ `metric_chart` - Fallback only
- ⚠️ `table` - Fallback only
- ⚠️ `spend_bar` - Fallback only
- ⚠️ `timeline_item` - Fallback only
- ⚠️ `form` - Fallback only
- ⚠️ `number_input` - Fallback only
- ⚠️ `select` - Fallback only
- ⚠️ `confirm` - Fallback only

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache-2.0 © Small Seed Labs

---

**Related Projects:**
- [proba-hub](https://github.com/smallseedlabs/proba-hub) - Interaction Hub
- [proba-protocol](https://github.com/smallseedlabs/proba-protocol) - Shared protocol library
