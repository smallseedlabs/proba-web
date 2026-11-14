import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SHORT_VIEWPORT_QUERY, useMediaQuery } from './useMediaQuery';

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches,
    media: SHORT_VIEWPORT_QUERY,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
    set(next: boolean) {
      this.matches = next;
      listeners.forEach((fn) => fn());
    },
  };
  window.matchMedia = vi.fn().mockImplementation(() => media);
  return media;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('tracks a short viewport and updates when it changes', () => {
    const media = mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery(SHORT_VIEWPORT_QUERY));
    expect(result.current).toBe(true);
    act(() => media.set(false));
    expect(result.current).toBe(false);
  });
});
