# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
