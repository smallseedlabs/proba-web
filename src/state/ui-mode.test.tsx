import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UIModeProvider, useUIMode } from './ui-mode';

function ShowMode() {
  const { mode } = useUIMode();
  return <span data-testid="mode">{mode}</span>;
}

afterEach(() => window.localStorage.clear());

describe('UI mode defaults', () => {
  it('operators default to Controlled mode (explicit approvals, full navigation)', () => {
    render(
      <UIModeProvider workspaceId="w-op" userRole="operator">
        <ShowMode />
      </UIModeProvider>
    );
    expect(screen.getByTestId('mode').textContent).toBe('controlled');
  });

  it('instant users default to 1-Click Auto', () => {
    render(
      <UIModeProvider workspaceId="w-byo" userRole="instant_byo">
        <ShowMode />
      </UIModeProvider>
    );
    expect(screen.getByTestId('mode').textContent).toBe('auto');
  });

  it('App does not override the role-based default', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    expect(app).toMatch(/<UIModeProvider\b/);
    expect(app).not.toMatch(/<UIModeProvider[^>]*defaultMode=/);
  });
});
