#!/usr/bin/env node
/**
 * lesson-gate.mjs — the wire that makes a stored lesson actually change behaviour.
 *
 * THIS IS THE L3 STEP. ADR-029 mines which lessons are universal; ADR-030 says a lesson must
 * INTERRUPT at a decision point or it is prose. Both shipped. And nothing read the store: a grep for
 * `lessonsFor` across every gate returned zero. Lessons were written, schema-validated, weighted,
 * trust-boundaried — and consumed by nobody. That is the fourth built-tested-unwired failure in a
 * single night, which is itself the argument for wiring rather than intending.
 *
 * WHAT IT DOES. A gate calls it with the decision point it guards:
 *
 *     node scripts/lesson-gate.mjs --trigger ship
 *
 * It returns the lessons in force at that moment, formatted for a human who is about to be
 * interrupted, and exits non-zero ONLY if a lesson at that trigger is genuinely blocking:
 * `enforcement: block` AND ratified by a human. Unratified candidates print as a checklist and exit
 * 0 — they inform, they do not refuse.
 *
 * WHY THAT ASYMMETRY IS THE POINT. Every lesson currently in the store is an unratified candidate,
 * because the model does not get to ratify its own rules (ADR-031's trust boundary, added after an
 * adversarial review found that a hallucinated session summary could otherwise become a blocking
 * gate). So today this changes what you SEE, and the day the owner ratifies, the same wire starts
 * refusing — with no code change. The enforcement ladder is data, not a rewrite.
 *
 * DESIGN CONSTRAINT: a gate must never break the thing it guards. Any failure here — missing store,
 * corrupt JSON, unreadable file — exits 0 silently. A lesson gate that blocks a push because it
 * could not read a config file would be worse than no lesson gate, and would be switched off within
 * a day, which is how every over-eager gate dies.
 */
import path from 'node:path';
import { loadLessons, lessonsFor, ENFORCEMENT, STATUS, TRIGGERS } from './lesson-store.mjs';

const argv = process.argv.slice(2);
const arg = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const trigger = arg('--trigger');
const quiet = argv.includes('--quiet');
const json = argv.includes('--json');

if (!trigger) {
  console.log('lesson-gate — surface the lessons in force at a decision point\n');
  console.log('  --trigger <key>   one of: ' + Object.values(TRIGGERS).map((t) => t.key).join(', '));
  console.log('  --json            machine-readable');
  console.log('  --quiet           print nothing; exit code only\n');
  process.exit(0);
}

let lessons = [];
try { lessons = loadLessons(); } catch { process.exit(0); }   // never break the caller
const inForce = lessonsFor(trigger, lessons, { limit: 3 });

// BLOCKING requires both: declared `block` AND ratified by a human. A candidate never refuses work.
const blocking = inForce.filter(
  (l) => l.enforcement === ENFORCEMENT.BLOCK && (l.status === STATUS.RATIFIED || l.status === STATUS.ACTIVE),
);
// Candidates that WOULD block once ratified — worth showing, because the whole point is that the
// user can see what is about to become enforcement and agree or reject it before it bites.
const pendingBlock = inForce.filter((l) => l.intendedEnforcement === ENFORCEMENT.BLOCK && !blocking.includes(l));

if (json) {
  console.log(JSON.stringify({ trigger, inForce, blocking: blocking.map((l) => l.id), pendingBlock: pendingBlock.map((l) => l.id) }, null, 2));
  process.exit(blocking.length ? 1 : 0);
}

if (!quiet && inForce.length) {
  const label = Object.values(TRIGGERS).find((t) => t.key === trigger)?.label || trigger;
  console.log('');
  console.log(`  ⚑ ${blocking.length ? 'BLOCKED' : 'Before you continue'} — you are ${label}.`);
  console.log('');
  for (const l of inForce) {
    const mark = blocking.includes(l) ? '⛔' : pendingBlock.includes(l) ? '○' : '·';
    console.log(`  ${mark} ${l.statement}`);
    // The evidence is what makes this a lesson rather than a nag — it says why, from real history.
    if (l.evidence?.[0]?.observed) console.log(`      ${String(l.evidence[0].observed).slice(0, 150)}`);
    if (l.repeatCount >= 3) console.log(`      you have had to say this ${l.repeatCount} times across ${l.projects.length} project(s)`);
    console.log('');
  }
  if (pendingBlock.length && !blocking.length) {
    console.log(`  ${pendingBlock.length} of these would REFUSE this action once you ratify them:`);
    console.log(`      node scripts/lesson-ratify.mjs --list`);
    console.log('');
  }
}

process.exit(blocking.length ? 1 : 0);
