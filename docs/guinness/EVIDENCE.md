# Evidence plan

Follow the official Guinness “Guide to Your Evidence” once the guideline pack arrives. This document maps our system onto the usual requirements so the export is ready.

## Always required (every Guinness attempt)

| Item | How we produce it |
|---|---|
| Cover letter | Written at close from the attempt record + official count |
| Two independent witness statements | See `WITNESS-PLAN.md` |
| Photographic evidence | Freeze ceremony, bracket-generation screen, live counter, final match, champion |
| Video evidence | Livestream archive + dedicated recordings listed below |
| Organiser statement | Signed by the SerendipEatery organiser |

## Attempt-specific evidence

### 1. Frozen roster (CSV)

Columns:

- participant_id  
- legal_name  
- email  
- phone_e164 (witness/Guinness copy only — redacted in public exports)  
- phone_verified_at  
- age_confirmed  
- guinness_consent_at  
- sms_consent_at  
- ip_address  
- user_agent  
- joined_at  
- seed  
- status  
- official_participant (yes/no)  
- first_throw_at  
- eliminated_round  
- notes (bye / forfeit / no-show)

Export endpoints:

- `GET /record/admin/export/roster` — full (admin + witnesses)  
- `GET /record/admin/export/roster?redacted=1` — public

### 2. Match log (CSV + JSON)

Every match:

- match_id, round, match_index  
- player1_id, player2_id  
- status (ready / completed / bye / forfeit)  
- deadline_at  
- locked_at per player  
- revealed throws (only after completion)  
- winner_id, loser_id  
- forfeit_reason  
- battle_id  

### 3. Hash-chained event log

Table `record_event_log`. Each row:

- seq  
- event_type  
- payload (JSON)  
- prev_hash  
- hash = SHA-256(seq | prev_hash | event_type | payload | created_at)

Export: `GET /record/admin/export/chain`  
A verifier script in this folder’s engine recomputes the chain from row 1.

Events that must appear: `participant_registered`, `phone_verified`, `roster_frozen`, `bracket_generated`, `match_ready`, `throws_locked`, `match_completed`, `match_forfeit`, `player_eliminated`, `champion_crowned`, `round_snapshot`, `attempt_closed`.

### 4. SMS log

Every outbound SMS: to (e164), template, body, provider id, status, sent_at.  
Used to prove notification, not to prove the throw.

### 5. Snapshots

Automatic JSON snapshots:

- at freeze  
- after bracket generation  
- at the end of each round  
- at close  

Stored in `record_evidence`.

### 6. Video

Record and keep:

1. **Roster freeze** (screen + wall clock + witness on camera)  
2. **Bracket generation** (admin action, published seed, resulting hash)  
3. **Continuous public livestream** of the live counter and live bracket for the whole attempt  
4. **Final match** from both lock to reveal  
5. **Champion confirmation**

Guinness often wants video of the entire attempt. For a multi-week async event, ask them in the application to accept (3) plus (1), (2), (4), (5). If they refuse, we cannot run the official attempt as designed.

### 7. Identity

Default: unique verified phone + legal name + age attestation.  
If Guinness requires stronger ID:

- government-ID check for an audit sample (recommended: 2% or 200 players, whichever is larger)  
- government-ID check for quarterfinals and above  

Do not collect ID documents until the guideline pack says so.

## Retention

Keep the full evidence pack for at least 12 months after the decision, or longer if Guinness requires. Names and phone numbers are evidence, not marketing, until the player separately opts into SerendipEatery promotions at unlock.

## What not to send as the public story

Do not publish raw phone numbers or emails. The public page shows names (or display names) and the count. Guinness and witnesses get the full roster under the cover letter.
