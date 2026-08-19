# Application — Largest online asynchronous rock-paper-scissors tournament

**Applicant organisation:** SerendipEatery  
**Contact role:** Record attempt organiser  
**Proposed record title:** Largest online asynchronous rock-paper-scissors tournament  
**Related existing title:** Largest Rock, Paper, Scissors tournament (10,033 — Tianjin Joy City, 24 December 2019)  
**Why a new title is required:** The existing title is an in-person event. This attempt is a single global single-elimination tournament played asynchronously on a mobile application, with SMS notification when a player is due to throw.

## Description of the attempt

SerendipEatery will host one official tournament. Registration will open for a published window, then freeze. Every verified player is placed into one single-elimination bracket. Matches are first to two winning throws (ties replayed inside the same match). Players independently lock their throws in the official app. The server reveals throws only after both players have locked, or after a published deadline.

Players are notified by SMS and push notification when their match is live and again before the deadline. The first player to two winning throws advances. The loser is eliminated. The last remaining player is the champion.

The attempt is organised as a promotional event for the SerendipEatery consumer application. Participation is free. There is no entry fee. Completing (or being eliminated from) the tournament unlocks the rest of the application.

## Proposed minimum

50,000 phone-verified official participants (auto-start threshold). The bracket pads to the next power of two with documented byes.

## Automation

The official tournament does not have a human start button. Registration stays open until 50,000 unique phones are verified. At that count the system freezes the roster, publishes the freeze seed and hashes, generates the single-elimination bracket, and texts every live player.

While that count is filling, any verified registrant may host invite-only friend tournaments (“winner decides what we do tonight”). Those social brackets use the same engine and are stored as dry-run evidence.

## Dates (auto-triggered)

- Registration opens: after written guidelines are received  
- Official freeze / Round 1: automated — the moment verified signups exceed 50,000  
- Match deadline: 48 hours per match  
- Expected duration at 50,000+ players: up to 16 rounds × 48 hours ≈ 32 days, plus a published buffer for the final

## Location

Online / worldwide. Organiser based in the United States. Play takes place in the official SerendipEatery consumer application. A public live bracket and participant counter will be available on the web.

## Measurement

The record is the number of **official participants** in a single single-elimination tournament:

1. Unique natural person  
2. Legal name recorded  
3. Phone number verified by one-time code  
4. Age attested at or above the published minimum (13, or whatever Guinness requires)  
5. Written consent to appear on the official roster and to receive SMS  
6. Either locked at least one throw, or received a documented first-round bye after freeze  

Duplicate phones, unverified phones, and no-shows who never threw are excluded from the official count and retained in the audit roster.

## Why this is measurable and unique

- One frozen roster, one bracket, one champion  
- Every match, throw, timeout, and forfeit is written to an append-only hash-chained event log  
- Two independent witnesses receive read-only access to the live log and roster  
- A public livestream covers roster freeze, bracket generation, the live counter, and the final  
- Full evidence export (CSV + JSON + hash chain) is generated at freeze, at the end of every round, and at close  

## Request to Records Management

Please issue guidelines that specifically address:

1. Whether an asynchronous online tournament is accepted as a new title  
2. Whether a 48-hour per-match deadline and auto-forfeit are permitted  
3. Whether a first-round bye (when the field is not a power of two) counts as participation  
4. Whether a player who is forfeited against (opponent no-show) counts as an official participant  
5. Identity standard (phone OTP vs. government ID for the whole field vs. audit sample)  
6. Steward ratio for a digital event  
7. Video requirement for a multi-week attempt (we propose continuous public livestream of the live system plus dedicated recordings of freeze, generation, and the final)

We will not open official registration until those answers are in writing.
