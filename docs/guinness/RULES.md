# Official rules — SerendipEatery world-record RPS tournament

**Rules version:** `rps-async-v1`  
These rules are the public contract. The same version string is stored on the record attempt in software. If Guinness guidelines conflict with this document, Guinness wins and this file is revised before registration opens.

## 1. Eligibility

1.1. One person, one entry.  
1.2. Minimum age: 13, or the higher age Guinness requires. Age is self-attested at registration.  
1.3. A player must register with a legal name, working email, and a unique mobile phone number they control.  
1.4. The phone number must be verified by a one-time SMS code before the roster freeze. Unverified registrations are dropped at freeze.  
1.5. The player must consent to: (a) being listed on the official record roster, (b) receiving SMS about this tournament, (c) the privacy notice for retaining name and contact as evidence.  
1.6. Employees of the organiser who have write access to the tournament database are ineligible to be official participants. They may appear as operators or digital stewards only.

## 2. Registration and freeze

2.1. Registration stays open until 50,000 unique phones are verified, unless Guinness requires a published close date instead.  
2.2. At that threshold the roster is frozen automatically. No additions. The official bracket generates without a human start.  
2.2a. Before freeze, verified players may host invite-only friend tournaments on the same engine. Those matches are not part of the official count. They are dry-run evidence.  
2.3. At freeze, unverified and duplicate phones are removed. The remaining list is the **frozen roster**.  
2.4. The frozen roster is shuffled with a documented random seed. Seeds are assigned. The single-elimination bracket is generated once.  
2.5. If the field is not a power of two, first-round byes are assigned by standard seeding. A documented bye is participation for the official count.  
2.6. After generation, the hash of the roster and the bracket is published.

## 3. Format

3.1. Single elimination. Lose one match and you are out.  
3.2. Each match is first to two winning throws.  
3.3. Legal throws: rock, paper, scissors. Rock beats scissors, scissors beats paper, paper beats rock.  
3.4. A tie (same throw) is not a winning throw. The next locked throw in the sequence is used.  
3.5. Each player independently locks a sealed sequence of three throws in the official app. The opponent cannot see those throws.  
3.6. The server reveals throws in order until one player has two wins. Remaining locked throws are unused.  
3.7. If the three-throw sequence is all ties, the match is a draw-reset: both players are asked to lock a new sequence under a fresh deadline (24 hours, or the remaining match deadline, whichever is longer).

## 4. Timing

4.1. A match becomes live when both slots are filled (or when a bye is resolved).  
4.2. Default deadline: 48 hours from the match becoming live.  
4.3. Both players are notified by SMS and push when the match becomes live, at 24 hours remaining, and at 1 hour remaining.  
4.4. A player may lock throws any time before the deadline, in any time zone.

## 5. Forfeits and no-shows

5.1. If only one player has locked throws when the deadline passes, that player wins the match by forfeit.  
5.2. If neither player has locked throws, both are marked no-show. One player is advanced by documented coin-flip (hash of match id + freeze seed) so the bracket can continue. **Neither no-show is added to the official participant count unless they already qualified in an earlier match.**  
5.3. A player who locked throws in any match remains an official participant even if they later no-show.  
5.4. There are no extensions except a documented platform outage lasting more than 2 hours, approved by the organiser and both witnesses.

## 6. Integrity

6.1. Throws are accepted only through the official application talking to the official API.  
6.2. The server stores the lock timestamp, hashed throw payload, device user-agent, and IP.  
6.3. Throws are never returned to a client until both players have locked or the match is forfeited.  
6.4. Every material event is appended to a hash-chained log. Previous hashes cannot be rewritten without breaking the chain.  
6.5. Two independent witnesses have read-only access for the entire attempt.  
6.6. The organiser will not edit match outcomes. If a genuine defect is found, the match is voided and replayed under witness supervision, and the void is logged.

## 7. Official count

7.1. The submitted record number is the count of official participants as defined in the application.  
7.2. The public marketing counter may show verified registrations. The evidence pack always shows both numbers.

## 8. Unlock of the SerendipEatery application

8.1. During the official attempt, the consumer app shows only the tournament until the player is eliminated or crowned.  
8.2. Elimination or championship unlocks the rest of the app. This does not affect the official count.  
8.3. After the attempt is closed, the lock is removed for everyone.

## 9. Conduct

9.1. Harassment, threats, or attempts to coerce an opponent’s throw are grounds for disqualification.  
9.2. Creating multiple accounts or using a phone number you do not control is grounds for disqualification and removal from the official count.  
9.3. Disqualification decisions are logged and visible to witnesses.

## 10. Champion

10.1. The winner of the final is the champion.  
10.2. The attempt then moves to `pending_verification`. No further official matches are played.
