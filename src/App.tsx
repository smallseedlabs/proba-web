import { useState } from 'react';
import { useConfig } from './lib/config';
import { SSETransport, MockTransport } from './lib/transport';
import type { TransportClient } from './lib/transport';
import { AuthScreen } from './components/AuthScreen';
import { MainLayout } from './components/MainLayout';
import { TransportProvider } from './context/TransportContext';
import { EventProvider } from './context/EventContext';

function App() {
  const config = useConfig();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [transport, setTransport] = useState<TransportClient | null>(null);

  const handleLogin = () => {
    const newTransport = config.mockMode
      ? new MockTransport()
      : new SSETransport({
          apiBaseUrl: config.apiBaseUrl,
          onReconnect: () => console.log('Reconnected'),
          onError: (error) => console.error('Transport error:', error),
        });

    newTransport.connect();
    setTransport(newTransport);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated || !transport) {
    return <AuthScreen onLogin={handleLogin} mockMode={config.mockMode} />;
  }

  return (
    <TransportProvider transport={transport}>
      <EventProvider>
        <MainLayout />
      </EventProvider>
    </TransportProvider>
  );
}

export default App;
