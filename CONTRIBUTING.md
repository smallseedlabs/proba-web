# Contributing to proba-web

Thank you for contributing to Proba!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Run in dev mode: `npm run dev`

## Code Standards

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add spend_bar component
fix: handle SSE reconnection edge case
docs: update environment variables section
```

### Code Style

- Use TypeScript for all new code
- Follow ESLint rules: `npm run lint`
- Run type checking: `npm run typecheck`
- Format with Prettier (via ESLint)

### Testing

- Write unit tests for new components
- Add E2E tests for new user flows
- Ensure all tests pass: `npm run validate`

## Pull Request Process

1. Update README if adding features
2. Update CHANGELOG.md with your changes
3. Ensure CI passes (lint, typecheck, tests, docker build)
4. Request review from maintainers

## Protocol Changes

If you need protocol changes:

1. Open an issue in [proba-protocol](https://github.com/smallseedlabs/proba-protocol)
2. Add an "Open Questions" section in your PR description
3. Link to the protocol issue

## Questions?

Open an issue or reach out to the maintainers.
