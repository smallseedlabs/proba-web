import { HubAuthClient, type AuthClient, type Session } from './auth';
import type { AppConfig } from './config';
import { SSETransport, type TransportClient } from './transport';

export interface Services {
  auth: AuthClient;
  createTransport(session: Session, workspaceId: string): TransportClient;
}

export async function createServices(config: AppConfig): Promise<Services> {
  if (__DEMO_MODE__) {
    // Development only. This branch and the demo module are removed from
    // production builds because __DEMO_MODE__ is a compile-time constant.
    const demo = await import('./demo');
    return {
      auth: new demo.DemoAuthClient(),
      createTransport: (_session, workspaceId) => new demo.DemoTransport({ workspaceId }),
    };
  }

  return {
    auth: new HubAuthClient({ apiBaseUrl: config.apiBaseUrl, loginPath: config.authLoginPath }),
    createTransport: (session) => new SSETransport({ apiBaseUrl: config.apiBaseUrl, token: session.token }),
  };
}
