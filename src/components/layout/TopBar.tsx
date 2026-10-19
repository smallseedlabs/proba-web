import { useTransport } from '../../context/TransportContext';

interface TopBarProps {
  isPaused: boolean;
  onPauseToggle: () => void;
}

export function TopBar({ isPaused, onPauseToggle }: TopBarProps) {
  const transport = useTransport();

  const handleKill = () => {
    if (confirm('Are you sure you want to kill all running campaigns?')) {
      transport.sendCommand({
        kind: 'command',
        clientMsgId: crypto.randomUUID(),
        type: 'control',
        payload: {
          action: 'kill',
        },
        sentAt: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="h-14 border-b bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-primary">Proba</h1>
        <div className="text-sm text-muted-foreground">
          AI-native Ad Testing Platform
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onPauseToggle}
          className={`px-4 py-2 rounded font-medium ${
            isPaused
              ? 'bg-green-500 text-white'
              : 'bg-yellow-500 text-white'
          }`}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={handleKill}
          className="px-4 py-2 rounded font-medium bg-destructive text-destructive-foreground"
        >
          Kill
        </button>
      </div>
    </div>
  );
}
