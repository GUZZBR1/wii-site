import { describe, expect, it, vi } from 'vitest';
import { observeEarlyRejection } from '../src/arena/cv/observeEarlyRejection';

describe('observeEarlyRejection', () => {
  it('observes a rejection immediately and preserves it for the later await', async () => {
    let rejectInitialization: ((error: Error) => void) | undefined;
    const initialization = new Promise<void>((_resolve, reject) => { rejectInitialization = reject; });
    const catchSpy = vi.spyOn(initialization, 'catch');
    const failure = new Error('pose worker failed');

    expect(observeEarlyRejection(initialization)).toBe(initialization);
    expect(catchSpy).toHaveBeenCalledOnce();
    rejectInitialization?.(failure);

    await expect(initialization).rejects.toBe(failure);
  });
});
