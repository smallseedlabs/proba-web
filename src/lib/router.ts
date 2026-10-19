import { useCallback, useEffect, useState } from 'react';

export type Section = 'goals' | 'approvals' | 'activity' | 'campaigns' | 'settings';

export interface Route {
  section: Section;
  id?: string;
}

const SECTIONS: Section[] = ['goals', 'approvals', 'activity', 'campaigns', 'settings'];

export function parseHash(hash: string): Route {
  const [section, id] = hash.replace(/^#\/?/, '').split('/');
  if (SECTIONS.includes(section as Section)) {
    return { section: section as Section, id: id ? decodeURIComponent(id) : undefined };
  }
  return { section: 'goals' };
}

export function routeHref(route: Route): string {
  return `#/${route.section}${route.id ? `/${encodeURIComponent(route.id)}` : ''}`;
}

/** Minimal hash router; keeps deep links working behind any static host. */
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    const href = routeHref(next);
    if (window.location.hash !== href) window.location.hash = href;
    else setRoute(next);
  }, []);

  return [route, navigate];
}
