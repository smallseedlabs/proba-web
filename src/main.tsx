import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ToastProvider } from './components/ui/toast';
import { ConfigProvider } from './lib/config';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <ConfigProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ConfigProvider>
    </AppErrorBoundary>
  </StrictMode>
);
