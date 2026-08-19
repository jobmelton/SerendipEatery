# Guinness World Record Attempt — SerendipEatery

**Proposed title:** Largest online asynchronous rock-paper-scissors tournament  
**Organisation:** SerendipEatery  
**Record to beat (related in-person title):** 10,033 participants — Tianjin Joy City, China, 24 December 2019  
**Target field:** 50,000 phone-verified players (auto-start). Bracket pads to the next power of two with documented byes. Single elimination, first to two winning throws.

This folder is the application pack. Submit it through the official Guinness World Records process. Do not start the official attempt until written guidelines arrive.

## Apply first

1. Create an organisation account at [guinnessworldrecords.com](https://www.guinnessworldrecords.com).
2. Apply for a **new title**. The current “Largest Rock, Paper, Scissors tournament” title is an in-person mass-participation event. An async phone tournament may be rejected against that title and accepted as a new one.
3. Attach `APPLICATION.md`, `RULES.md`, `EVIDENCE.md`, and `WITNESS-PLAN.md`.
4. Wait for the official guideline pack. If Guinness changes a rule (deadlines, forfeits, identity, video), update the engine to match **before** registration opens.
5. Run a dry-run tournament (100–500 people) and keep the evidence pack. Use the official attempt only after the dry run is clean.

Typical review is several weeks. The software can be finished while that is pending.

## What “counts”

| Count | Definition |
|---|---|
| Registered | Legal name, unique verified phone, age gate, Guinness + SMS consent |
| Official participant | Registered **and** either locked at least one throw, or received a documented round-1 bye after the roster freeze |
| No-show | Registered, never threw, did not receive a bye — listed in the roster, **excluded** from the official count |

The public counter on the site is registered-and-verified. The number submitted to Guinness is the official participant count.

## Product rule (locked)

The consumer app is the tournament until a player is eliminated or crowned. Elimination (or the championship) unlocks SerendipEatery. Do not wait until the whole bracket is over.

## Files

| File | Use |
|---|---|
| [SerendipEatery-Guinness-Application-Form.pdf](./SerendipEatery-Guinness-Application-Form.pdf) | Printable 2-page form (sign + upload) |
| [/record/apply](../../apps/web/src/app/record/apply/page.tsx) | Fillable web form — copy packet into the Guinness site |
| [APPLICATION.md](./APPLICATION.md) | Long-form application text |
| [RULES.md](./RULES.md) | Public rules. Version this. Ship the same text in the app. |
| [EVIDENCE.md](./EVIDENCE.md) | Evidence checklist and export map |
| [WITNESS-PLAN.md](./WITNESS-PLAN.md) | Witnesses, digital stewards, livestream |

Rules version in software: `rps-async-v1`
