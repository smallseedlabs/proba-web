# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Pinned `@smallseedlabs/proba-protocol` to the `v0.1.2` release tag (same commit `c643d52`).

### Added

- Sign-in screen with work email and password, validation, loading and error states, backed by an `AuthClient` interface and a Hub implementation (`POST /v1/auth/login`, `POST /v1/auth/logout`).
- Proba design system: colour tokens meeting WCAG AA, type scale, and primitives (button, badge, card, fields, menu, dialog, toast, skeleton, empty state).
- App shell with sidebar (Goals, Approvals, Activity, Campaigns, Settings), workspace switcher, user menu, Pause all and Emergency stop with confirmation.
- Goals, Approvals, Activity, Campaigns and Settings views with empty, loading, error and reconnecting states.
- Full implementations of `metric_chart`, `table`, `spend_bar`, `timeline_item`, `form`, `number_input`, `select` and `confirm`.
- Accessibility (axe, WCAG 2.2 AA) and tablet E2E tests; unit tests for auth, transport, state and every registry component.
- Production bundle check that fails the build if demo content is present.
- Screenshots in `docs/screenshots/`.

### Changed

- Demo data is now a build-time, development-only option (`VITE_DEMO_MODE`, off by default) and is removed from production builds. The runtime `MOCK_MODE` variable is gone.
- Pinned `@smallseedlabs/proba-protocol` to commit `c643d52` (0.1.2).
- Docker build uses Node 20 and never serves a cached `env-config.js`.

### Removed

- Development sign-in and all prototype wording from the interface.

## [0.1.0] - 2024-10-19

### Added

- Initial release of proba-web
- Server-driven UI component registry with support for:
  - Text, plan cards, approval cards
  - Question choice and text inputs
  - Status banners, metric tiles, goal summaries
  - Alerts and basic components
- SSE transport with automatic reconnection and deduplication
- Mock transport for development without backend
- REST command submission with optimistic UI
- Layout with top bar controls (Pause/Kill)
- Workspace sidebar with goals, approvals, and activity
- Chat panel with inline component rendering
- Dev login with mock mode support
- Multi-stage Docker build with nginx
- Runtime environment configuration injection
- Docker Compose for local development
- Docker Swarm deployment configuration
- GitHub Actions CI (lint, typecheck, test, e2e, docker)
- Comprehensive test suite (unit + E2E)
- Full documentation (README, CONTRIBUTING, CHANGELOG)

### Dependencies

- React 18.3
- TypeScript 5.6
- Vite 5.4
- Tailwind CSS 3.4
- @smallseedlabs/proba-protocol v0.1.0

[0.1.0]: https://github.com/smallseedlabs/proba-web/releases/tag/v0.1.0
