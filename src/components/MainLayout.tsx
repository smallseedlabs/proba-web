import { useState } from 'react';
import { TopBar } from './layout/TopBar';
import { Workspace } from './layout/Workspace';
import { ChatPanel } from './layout/ChatPanel';

export function MainLayout() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <TopBar isPaused={isPaused} onPauseToggle={() => setIsPaused(!isPaused)} />
      <div className="flex-1 flex overflow-hidden">
        <Workspace onSelectThread={setSelectedThreadId} />
        <ChatPanel threadId={selectedThreadId} />
      </div>
    </div>
  );
}
