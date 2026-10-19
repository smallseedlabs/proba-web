import { describe, it, expect, beforeEach } from 'vitest';
import { MockTransport } from './mock';

describe('MockTransport', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  it('connects and emits fixture events', async () => {
    const events: unknown[] = [];
    
    transport.subscribe((event) => {
      events.push(event);
    });

    transport.connect();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('handles commands and advances fixture', async () => {
    let eventCount = 0;
    
    transport.subscribe(() => {
      eventCount++;
    });

    transport.connect();

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await transport.sendCommand({
      kind: 'command',
      type: 'send_message',
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(eventCount).toBeGreaterThan(2);
  });

  it('disconnects properly', () => {
    transport.connect();
    transport.disconnect();
    expect(() => transport.disconnect()).not.toThrow();
  });
});
