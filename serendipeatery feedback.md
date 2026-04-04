# Serendipeatery — Product Spec & Prompt Reference

## What it is

A geolocation flash-sale app for independent restaurants and food trucks, built around a social game mechanic that drives viral user acquisition. The core experience is serendipitous — users don't search for deals, deals (and strangers) find them.

---

## The name

**Serendipeatery** = Serendipity + Eatery

- Serendipity: unexpected good fortune, the happy accident — which is literally what every interaction in the app produces
- Eatery: warm, unpretentious, neighborhood-feel — signals independent and local, not corporate
- The name is a product description, not a vibe

---

## Brand voice

**Tone:** Playful fatalism. Fate is a character. The app doesn't recommend — it delivers. Users don't search — they submit.

**Core taglines:**
- "Fate has good taste." ← primary, use everywhere
- "The best meal you didn't plan."
- "You didn't find it. It found you."
- "Luck. Local. Lunch."

**Owner-facing tone is separate:** direct, proof-oriented, no mysticism.
- "Fill your slow hours. Pay nothing until it works."
- "No commissions. No contracts. Just customers walking through your door."
- "See exactly where you lose them. Then don't lose them there anymore."

---

## The two user sides

### Users (consumers)
- Earn points through activity: sharing, challenging strangers, spinning the wheel, redeeming deals
- Points weight the deal roulette — more points = better spin odds
- Can save certain deals, lose them in RPS challenges
- Primary demographic: 18–28, bored in public spaces

### Owners (restaurants & food trucks)
- Free until ROI is proven (tracked via backend metrics)
- Then subscription-based: $29–$99/month tiered by traffic volume, max $99, zero commission ever
- Set up deals themselves: choose discount %, deal type (saveable vs time-limited), duration
- Get access to full funnel analytics dashboard

---

## Core engagement loops

### Loop 1 — The viral acquisition loop (most important)

1. Existing user is bored in public (DMV, line, waiting room)
2. User drops an AirDrop challenge to everyone in their perimeter
3. Stranger receives AirDrop — **no app required to respond**
4. Stranger accepts via web link, plays RPS in browser
5. If stranger wins → loot prompt appears → "claim your loot" → download prompt
6. Stranger installs to claim their earned prize
7. New user acquired at zero ad spend

**Key insight:** The install motivation is intrinsic — the stranger earned something real and needs the app to claim it. It is not a dark pattern.

**Critical UX requirement:** The RPS web page must load in under 2 seconds with zero account creation required. Any friction before the game kills conversion.

### Loop 2 — The deal roulette loop

1. User earns points through activity
2. Points weight the roulette spin (higher points = better deal odds)
3. Wheel spins → deal awarded (random restaurant, owner-set discount)
4. Deal is either saveable or time-limited (owner decides)
5. Saveable deals go into the user's stash
6. Stash is at risk in RPS challenges (see Loop 3)

**Deal types:**
- Saveable: can be stored, looted by challengers
- Time-limited: expires regardless, cannot be looted (creates urgency)

### Loop 3 — The RPS loot loop

1. User initiates or receives AirDrop challenge
2. Before game starts, both players see **what's at stake** — the loser's saved deals
3. Both players throw simultaneously (no waiting/watching)
4. Winner loots the loser's saved deals
5. Loser always keeps one deal — "fate is fair" — protects ecosystem health
6. Both players earn points for participation regardless of outcome

**Why the looting works:** Users aren't playing for a discount coupon, they're playing for something another person wanted and saved. That psychological distinction drives higher engagement and repeat play.

### Loop 4 — The owner conversion loop

1. Owner signs up free, sets up deals
2. Backend tracks full funnel: notification responded → wheel spun → deal claimed → restaurant entered → purchase made
3. ROI dashboard shows owner exactly where they lose customers and what traffic was generated
4. When traffic is proven, owner converts to paid subscription
5. Tier assigned based on traffic volume ($29 / $49 / $99 per month)

**The analytics layer is a competitive moat.** No existing tool gives independents this funnel granularity. The data is the product you sell, not just the deals.

---

## The AirDrop challenge — exact copy

**Notification text (must not change):**
> "Accept challenge and fate, or decline and live a life of regret."

**Decline button:** "Decline (live with it)"
**Accept button:** "Accept challenge and fate"

**Alternative notification variants for A/B testing:**
- "A stranger nearby is feeling lucky. Are you?"
- "Someone nearby just put their lunch on the line. You in?"

---

## Win / lose copy

**Win state:**
- "Fate favors you today. Their stash is yours. Don't waste it."
- "Fate favors the bold. Their stash is yours."

**Loss state:**
- "Fate is a fickle thing. One deal survives. The rest belong to them now."
- "Scissors beats paper. Fate beats plans. Play again."

**RPS stake display (shown before throw):**
- "Their saved deal: [Restaurant] · [Deal description]"
- "Best of 1 · winner takes all"

---

## Roulette spin copy

- "You've earned a spin. Fate decides what's next."
- "The wheel doesn't care about your plans. Spin it anyway."

---

## Empty states & onboarding copy

**Empty map:**
> "No deals nearby yet. But someone around you is holding one. Find them."

**First launch:**
> "You're in a room full of strangers. One of them has your next meal."

**Nudge to first action:**
> "Serendipity doesn't come to those who wait. Drop a challenge."

---

## Backend metrics to track (per deal, per owner)

In funnel order — each step calculates drop-off rate:

1. **Notification responded** — user opened the deal notification
2. **Wheel spun** — user engaged with roulette
3. **Deal claimed** — user accepted the prize
4. **Restaurant entered** — geofence confirms physical arrival
5. **Purchase made** — conversion confirmed (via owner confirmation or POS if available)

Each drop-off percentage is surfaced in the owner dashboard. This is the primary value proposition for the subscription.

---

## Monetization

- **Free tier:** Unlimited during proof-of-ROI period
- **Paid tiers:** $29 / $49 / $99 per month based on traffic volume
- **Maximum:** $99/month, hard cap, no exceptions
- **Commission:** Zero. Never. This is the counter-positioning against DoorDash/Yelp
- **Conversion trigger:** Define a hard threshold upfront in every owner conversation (suggested: 5 verified walk-ins in 30 days)

---

## Key design decisions to implement

- Loser always keeps 1 deal (protects stash ecosystem, reduces churn from loss aversion)
- Points economy needs a ceiling so power users cannot game the roulette into worthlessness for casual players
- Roulette weighting must be transparent to owners — higher-value deal = better spin odds, and owners must understand the rule clearly
- The "claim your loot" screen (stranger's win screen before download prompt) must be the highest-quality screen in the product — it is the install conversion moment
- Both players throw RPS simultaneously — no watching the other person decide
- Web link game experience: zero account creation, loads under 2 seconds, full game playable in browser before any install prompt

---

## What this is not

- Not a search app. Users do not browse for deals.
- Not a delivery app. Physical presence is required and is the point.
- Not a loyalty app. Repeat behavior is driven by game mechanics, not points cards.
- Not DoorDash. Zero commission is the entire owner pitch.

---

## The one unproven assumption (validate before building)

Whether strangers in public spaces will accept an AirDrop challenge from an unknown person.

**How to test:** Bring 5 friends to a busy public space (farmers market, food truck event). Have them AirDrop-challenge strangers manually. Count accept rate. Target: 1 in 5 or better. If below that, the acquisition loop requires rethinking before any code is written.
