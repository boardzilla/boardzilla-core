import chai from 'chai';
import Queue from '../ui/queue.js';

const { expect } = chai;

describe('Queue', () => {
  let timeouts: (() => void)[];

  beforeEach(() => {
    timeouts = [];
    globalThis.window = {
      setTimeout: (callback: TimerHandler) => {
        timeouts.push(callback as () => void);
        return timeouts.length;
      },
      clearTimeout: () => {},
    } as unknown as typeof globalThis.window;
  });

  afterEach(() => {
    // @ts-ignore
    delete globalThis.window;
  });

  it('pauses after an announcement update until resumed', () => {
    const queue = new Queue();
    const updates: string[] = [];

    queue.schedule(() => updates.push('announcement'), false, true);
    queue.schedule(() => updates.push('final state'), true);

    expect(updates).to.deep.equal(['announcement']);
    expect(queue.paused).to.equal(true);

    timeouts.shift()!();
    expect(updates).to.deep.equal(['announcement']);

    queue.resume();
    expect(updates).to.deep.equal(['announcement', 'final state']);
  });
});
