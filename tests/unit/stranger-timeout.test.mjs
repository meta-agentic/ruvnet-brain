import { describe, it, expect } from 'vitest';
import { selfCheckOuterTimeoutMs } from '../../scripts/ci/stranger-timeout.mjs';

describe('stranger-matrix installer watchdog', () => {
  it('outlives every declared hook watchdog across all four stdin regimes', () => {
    const hooks = {
      hooks: {
        SessionStart: [{ hooks: [{ timeout: 5 }, { timeout: 10 }] }],
        Stop: [{ hooks: [{ timeout: 30 }] }],
      },
    };

    expect(selfCheckOuterTimeoutMs(hooks)).toBe(264_000);
  });

  it('never treats an absent timeout as zero work', () => {
    const hooks = { hooks: { UserPromptSubmit: [{ hooks: [{}] }] } };

    expect(selfCheckOuterTimeoutMs(hooks)).toBe(88_000);
  });
});
