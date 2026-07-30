import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(ROOT, 'console/app.js'), 'utf8');

describe('console advocacy precision visibility', () => {
  it('renders the backend advocacy precision payload in the capabilities card', () => {
    expect(source).toMatch(/function advocacyPrecisionSummary\(/);
    expect(source).toMatch(/advocacyPrecisionSummary\(data && data\.advocacy\)/);
  });

  it('labels empty evidence as accruing and never fabricates a zero score', () => {
    expect(source).toMatch(/Advocacy precision · accruing/);
    expect(source).toMatch(/Not judgeable yet/);
    expect(source).toMatch(/post-launch metric/);
  });

  it('shows sample counts and the honest interval when evidence exists', () => {
    expect(source).toMatch(/\$\{applied\} of \$\{n\}/);
    expect(source).toMatch(/honest 95% interval/);
  });
});
