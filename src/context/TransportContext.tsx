import {
  createContext,
  useContext,
  ReactNode,
  useRef,
  useEffect,
} from 'react';
import type { TransportClient } from '../lib/transport';

const TransportContext = createContext<TransportClient | null>(null);

export function TransportProvider({
  transport,
  children,
}: {
  transport: TransportClient;
  children: ReactNode;
}) {
  const transportRef = useRef(transport);

  useEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  return (
    <TransportContext.Provider value={transport}>
      {children}
    </TransportContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTransport(): TransportClient {
  const transport = useContext(TransportContext);
  if (!transport) {
    throw new Error('useTransport must be used within TransportProvider');
  }
  return transport;
}
