# Credit Card Benefits Tracker — Feature Document

*Draft v1 · October 14, 2026 · Card data reflects public sources as of October 2026 and must be re-verified against issuer terms before seeding production data.*

## 1. Overview

### 1.1 Problem
Premium travel cards bundle dozens of credits, each with its own reset cycle (monthly, quarterly, semi-annual, calendar year, account anniversary, every 4 years), enrollment rules, and merchant restrictions. People holding several of them routinely forfeit credits they have already paid for through the annual fee. Spreadsheets and calendar reminders break down quickly, and issuers change benefits often (the Amex Platinum fee rose to $895 in the 2025–26 refresh, the Saks credit was retired in July 2026, Lufthansa lounge access ended October 1, 2026, and Chase doubled the Sapphire Preferred hotel credit in June 2026).

### 1.2 Product vision
A MaxRewards-style companion app that answers three questions at a glance: **What credits do I still have left to use? What do I need to do before they expire? Is each card actually earning back its annual fee?** It also recommends which card to use at checkout.

### 1.3 Target user
A points-and-miles enthusiast or frequent traveler who holds 3+ premium cards across Amex, Chase and Bilt, wants to extract full value, and does not want to maintain a spreadsheet.

### 1.4 Goals and non-goals
**Goals**
- Zero forfeited credits through timely, accurate reminders.
- A trustworthy, per-card ROI view that nets annual fee against value actually captured.
- Correct handling of every reset type, including anniversary-based and threshold-based benefits.
- Fast setup: add a card and get its full benefit checklist in under a minute.

**Non-goals (v1)**
- Applying for cards, welcome-offer tracking, or credit-score features.
- Moving money, paying bills, or acting on the user's behalf with issuers.
- Storing full card numbers or card credentials.

### 1.5 Supported cards (v1)
| # | Card | Annual fee |
|---|---|---|
| 1 | Chase Sapphire Preferred (CSP) | $95 |
| 2 | The Platinum Card from American Express | $895 |
| 3 | Hilton Honors American Express Aspire | $550 |
| 4 | Hilton Honors American Express Surpass | $150 |
| 5 | Bilt Palladium Card | $495 |
| 6 | Marriott Bonvoy Brilliant American Express (assumed to be the "Amex Brilliant" card) | $650 |

Annual fees total $2,535 across the six cards, which is why per-card ROI tracking is the core value proposition.

## 2. Core user flows
1. **Onboarding:** select cards from a catalog, enter each card's open date (needed for anniversary-based benefits), choose which benefits to enroll in or ignore, set notification preferences.
2. **Daily glance:** home screen shows credits expiring soon, remaining value this period, and a "use this card here" suggestion.
3. **Mark a credit used:** auto-detected from a linked account, or one-tap manual "Used" with an amount.
4. **Before a trip:** the user sees which hotel, flight, lounge and status benefits apply to the trip and which card to book with.
5. **Renewal decision:** 60 days before each annual fee, the app shows realized value vs. fee and a keep/downgrade/cancel summary.

## 3. Feature requirements
Priority: **P0** = MVP, **P1** = fast follow, **P2** = later.

### 3.1 Wallet and card setup
- **P0** Add cards from a curated catalog; each card pre-populates its full benefit list.
- **P0** Per-card fields: nickname, open date, anniversary date, annual fee date, authorized-user flag, last four digits (optional, display only).
- **P0** Per-benefit toggles: *Track*, *Ignore (won't use)*, *Enrolled* (for benefits requiring enrollment).
- **P1** Household mode: multiple holders and authorized users with separate trackers.
- **P2** Support for additional cards beyond the six launch cards via a request queue.

### 3.2 Benefit catalog and rules engine
- **P0** A versioned, centrally maintained benefit catalog (see Section 5 and 6). Every benefit has an amount, cadence, reset anchor, eligible-merchant description, enrollment flag, and source URL.
- **P0** Supported reset anchors: calendar year, half-year (Jan–Jun / Jul–Dec), quarter, calendar month, **cardmember anniversary year**, **renewal date**, fixed multi-year interval (e.g., Global Entry every 4 years), and spend-threshold triggers.
- **P0** Benefit lifecycle states: `active`, `changed`, `retired` (kept visible in history, excluded from ROI going forward), `grandfathered`.
- **P1** Change feed: when a benefit changes (amount, cadence, retirement), affected users see an in-app notice with an effective date.

### 3.3 Credit tracker
- **P0** Per-benefit period instances showing amount available, used, remaining, expiry date and status (unused, partial, used, expired).
- **P0** Manual logging with amount, date and optional note.
- **P0** Grouped views: by card, by expiry date, by category (travel, dining, entertainment, shopping, wellness).
- **P0** Clear distinction between *use-it-or-lose-it* credits and *carry-forward* items (such as free nights and Bilt Cash with its own expiry rule).
- **P1** Auto-detection from transactions (Section 3.4).

### 3.4 Transaction linking and auto-detection
- **P1** Read-only account linking through an aggregator (for example Plaid). Coverage for each issuer, especially Bilt, must be confirmed before launch.
- **P1** Match logic: merchant name and category against each benefit's eligible-merchant rules, plus detection of issuer statement-credit lines that post after the qualifying charge.
- **P1** Match confidence: auto-apply high-confidence matches, show "Confirm?" for uncertain ones, and always allow undo.
- **P1** Fallbacks: CSV statement import and manual entry when linking is unavailable.
- **P2** Email-receipt parsing for hotel and Resy-type bookings.

### 3.5 Reminders and notifications
- **P0** Local push and email reminders with per-benefit overrides.
- **P0** Default schedule: 14 days and 3 days before expiry for monthly and quarterly credits; 30, 14 and 3 days for semi-annual and annual credits; 60 days before an annual fee posts.
- **P0** Smart suppression: no reminder if a benefit is fully used or set to Ignore.
- **P0** Enrollment nudges for benefits that need activation before they work.
- **P1** Digest mode (weekly summary) and quiet hours.
- **P1** Calendar export (ICS) for expiry dates.

### 3.6 Annual-fee ROI dashboard
- **P0** For each card: annual fee, face value of benefits available, value used, and **net position** (used minus fee).
- **P0** *Realistic value* mode: user sets a personal value percentage per benefit (for example 100% for a hotel credit they would book anyway, 0% for a gym credit they will never use). ROI is computed on realistic value, not sticker value.
- **P0** Configurable cents-per-point for each currency: Membership Rewards, Ultimate Rewards, Hilton Honors, Marriott Bonvoy and Bilt Points.
- **P1** Break-even projection: "At your current pace you will recover X% of this fee."
- **P1** Renewal report: keep, downgrade or cancel summary 60 days before the fee date.

### 3.7 Spend progress and status tracking
- **P0** Threshold trackers: Hilton Surpass free night at $15,000 and temporary Diamond at $40,000 per calendar year; Hilton Aspire additional free nights at $30,000 and $60,000; Marriott Brilliant earned-choice award at $60,000.
- **P0** Marriott Elite Night Credits (25 per calendar year) and free-night certificate tracking with expiry dates.
- **P0** Bilt Cash balance and expiry tracking, including the year-end rule that balances above a threshold expire.
- **P1** Elite status tracker per program (Hilton, Marriott) showing source of status and next-tier progress.

### 3.8 Which-card-to-use recommendations
- **P0** Search by merchant or category: "Which card should I use at Hilton / dining / flights / groceries?" with earn rate and any active credit that applies.
- **P1** Location-aware suggestion on arrival at a merchant (opt-in).
- **P1** "Credit still available here" prompts, for example a restaurant when the monthly dining credit is unused.
- **P2** Rent-day mode for Bilt: reminder and earning-rule guidance for rent and mortgage payments.

### 3.9 Overlap and conflict detection (differentiator)
With these six cards several benefits overlap or cannot be stacked. The app should warn when:
- **CLEAR+:** both Amex Platinum and Hilton Aspire offer a CLEAR+ credit; only one membership needs reimbursement.
- **Global Entry / TSA PreCheck:** CSP and Marriott Brilliant (and possibly Platinum) offer application-fee credits; one application every 4 years needs one card.
- **Airline incidental / flight credits:** Platinum (one airline per year) and Aspire (quarterly) have different eligibility rules.
- **Hotel credits:** Chase Travel, Bilt Travel and Amex hotel credits each require their own portal; one booking cannot use two credits.
- **Lounge access:** Priority Pass appears on several cards; show the best access path per airport and per trip.
- **Status duplication:** Hilton Diamond from Aspire makes Surpass Gold redundant; show this in the ROI view.

### 3.10 Settings, privacy and security
- **P0** Sign-in via Apple, Google or email; optional biometric lock.
- **P0** No full card numbers, CVV or issuer passwords stored. Aggregator tokens only; read-only.
- **P0** Full data export and permanent delete-my-account.
- **P0** Clear disclosure that benefit data is community- and editor-maintained and may lag issuer changes.
- **P1** Optional manual-only mode that never connects to a bank.

### 3.11 Catalog operations (internal admin)
- **P0** Admin tool to create and edit benefits with effective dates and source links.
- **P0** Review queue for proposed changes and a monitored-sources list (issuer pages and a handful of trusted card-news sources).
- **P1** User-submitted "report incorrect benefit" flow that feeds the review queue.
- **P1** Automated change alerts: scrape or monitor issuer benefit pages and flag diffs for human review.

## 4. Screens
1. **Home:** expiring soon, remaining value this period, net ROI snapshot, one recommended card.
2. **Wallet:** the six cards with fee date, progress ring of value captured, and next expiry.
3. **Card detail:** every benefit as a checklist grouped by cadence, with enrollment badges and a status/threshold section.
4. **Benefit detail:** rules, eligible merchants, history of uses, source link and "last verified" date.
5. **Calendar / timeline:** all expiry dates plotted across the year.
6. **Optimizer:** merchant/category search returning best card and applicable credits.
7. **ROI & renewal:** per-card and portfolio value, break-even forecast, renewal report.
8. **Settings:** valuations, notifications, linked accounts, data export.

## 5. Card-by-card benefit seed data

**Legend:** *Confirmed* = amount and cadence agree across recent public sources. *Verify* = amount confirmed but cadence, eligibility or exact rules need checking against the issuer's current terms before shipping. Sources occasionally disagree (for example, CLEAR+ is listed at $189, $209 and $219 across different pages), which is exactly why every benefit needs a source URL and a last-verified date.

### 5.1 Chase Sapphire Preferred ($95)
| Benefit | Value | Cadence / anchor | Notes | Status |
|---|---|---|---|---|
| Chase Travel hotel credit | $100 | Each account anniversary year | Doubled from $50 on June 15, 2026; prepaid hotels booked through Chase Travel; reportedly reversed if the booking is cancelled | Confirmed |
| Global Entry / TSA PreCheck / NEXUS credit | $120 | Every 4 years | Pay the application fee with the card | Verify |
| Points Boost | Up to 1.5x redemption value | Per eligible Chase Travel booking | Applies only to flagged flights and hotels; non-eligible redemptions are worth less | Confirmed |
| Earning | 5x Chase Travel (excluding hotel purchases that use the credit), 3x dining and top streaming; added categories reported (Lyft, Peloton, vacation rentals) | Ongoing | 10% anniversary points bonus eliminated | Verify categories |
| Hyatt transfer | 4:3 ratio | Ongoing | Applied to existing members from October 1, 2026 | Confirmed |
| Other perks (streaming/subscription offers) | Varies | Varies | Recorded in some sources; confirm current list | Verify |

### 5.2 The Platinum Card from American Express ($895)
| Benefit | Value | Cadence / anchor | Notes | Status |
|---|---|---|---|---|
| Hotel credit | $600 | Two $300 credits, semi-annual | Prepaid Fine Hotels + Resorts / Hotel Collection bookings through Amex Travel | Amount confirmed; booking rules Verify |
| Resy dining credit | $400 | Verify (commonly quarterly) | Enrollment required | Verify |
| Digital entertainment credit | $300 | Verify (commonly monthly) | Enrollment required | Verify |
| lululemon credit | $300 | Verify (commonly quarterly) | Enrollment required | Verify |
| Equinox credit | $300 | Verify | Enrollment required | Verify |
| CLEAR+ credit | ~$209 (sources show $209–$219) | Calendar year | Overlaps with Hilton Aspire | Verify amount |
| Airline incidental fee credit | $200 | Calendar year, one selected airline | Workarounds were closed in 2026; track the airline selection | Confirmed |
| Uber Cash | $200 | Verify (commonly monthly with a December bonus) | Enrollment required | Verify |
| Uber One membership credit | $120 | Calendar year | Pay for auto-renewing Uber One with the card | Confirmed |
| Oura Ring credit | $200 | Verify | Enrollment required | Verify |
| Walmart+ credit | $155 | Verify (commonly monthly) | Enrollment required | Verify |
| Saks credit | $100 | — | **Retired July 2026**; show as retired, exclude from ROI | Retired |
| Flights / prepaid hotels earning | 5x via Amex Travel | Ongoing; annual cap per sources | | Confirmed |
| Lounge access | Centurion and other networks | Ongoing | **Lufthansa lounge access ended October 1, 2026** | Confirmed |
| Hotel status | Complimentary hotel/car-rental elite status | Ongoing | Enrollment required | Verify |
| Fine Hotels + Resorts perks | Average benefit value cited by Amex around $550 per stay | Per eligible stay | | Confirmed |

### 5.3 Hilton Honors American Express Aspire ($550)
| Benefit | Value | Cadence / anchor | Notes | Status |
|---|---|---|---|---|
| Hilton resort credit | $400 | Two $200 credits, semi-annual | Participating Hilton resorts, charged directly to the card | Confirmed |
| Flight credit | $200 | Four $50 credits, quarterly | Airlines directly or Amex Travel | Confirmed |
| CLEAR+ credit | ~$209 (sources show $189–$219) | Calendar year | Overlaps with Amex Platinum | Verify amount |
| Free Night Reward | 1 night | On approval, then each renewal | No spend requirement; redeemable at nearly any Hilton property per sources | Confirmed |
| Additional free nights | 1 each | At $30,000 and $60,000 annual spend | Calendar-year spend trackers | Confirmed |
| Hilton Diamond status | Status | Ongoing | | Confirmed |
| National Car Rental Emerald Club Executive | Status | Ongoing | Enrollment required | Confirmed |
| Property credit (Conrad / Waldorf Astoria) | $100 | Per qualifying stay | Reported by one source; confirm rules | Verify |
| Airport lounge access | Priority Pass | Ongoing | Enrollment required; confirm | Verify |

### 5.4 Hilton Honors American Express Surpass ($150)
| Benefit | Value | Cadence / anchor | Notes | Status |
|---|---|---|---|---|
| Hilton statement credit | $200 | Four $50 credits, quarterly | Eligible Hilton purchases | Confirmed |
| Free Night Reward | 1 night | After $15,000 spend in a calendar year | No automatic anniversary night | Confirmed |
| Temporary Diamond status | Status | After $40,000 spend in a calendar year | Per sources | Verify |
| Hilton Gold status | Status | Ongoing | Includes fifth-night-free on point stays | Confirmed |
| National Car Rental status | Status | Ongoing | Enrollment required | Verify |
| Earning | 12x Hilton, 6x U.S. dining/groceries/gas, 3x other | Ongoing | | Confirmed |

### 5.5 Bilt Palladium ($495)
| Benefit | Value | Cadence / anchor | Notes | Status |
|---|---|---|---|---|
| Bilt Travel hotel credit | $400 | Two $200 credits, semi-annual | Bilt Travel Portal bookings of 2+ nights | Confirmed |
| Bilt Cash | $200 | Annually, at account anniversary | Balances above a stated threshold expire at calendar year-end per sources; track the expiry rule | Verify expiry rule |
| Priority Pass | Member + 2 guests | Ongoing | Activation required | Confirmed |
| Rent / mortgage rewards | Up to 1.25x | Monthly, tied to the Bilt Cash / points choice | No transaction fee; track the user's chosen option | Confirmed |
| Everyday earning | 2x points; option of 4% Bilt Cash | Ongoing | | Confirmed |
| Neighborhood Benefits | Extra points at partner merchants | Per purchase | | Confirmed |
| Protections | World Legend Mastercard coverages | Ongoing | | Confirmed |

### 5.6 Marriott Bonvoy Brilliant American Express ($650)
| Benefit | Value | Cadence / anchor | Notes | Status |
|---|---|---|---|---|
| Brilliant dining credit | $300 | Monthly ($25), calendar year | Restaurants worldwide | Confirmed |
| Annual free night award | Up to 85K points (per sources) | Each renewal | Confirm certificate rules | Verify |
| Marriott property credit | $100 | Verify | Confirm eligible properties and frequency | Verify |
| Elite Night Credits | 25 | Calendar year | Counts toward next Marriott tier | Confirmed |
| Platinum Elite status | Status | Ongoing | | Confirmed |
| Global Entry / TSA PreCheck credit | $120 (Global Entry) or up to $85 (TSA PreCheck) | Every 4 years (sources differ on TSA interval) | | Verify |
| Priority Pass Select | Unlimited visits | Ongoing | Enrollment required | Confirmed |
| Brilliant Earned Choice Award | Choice of benefit | After $60,000 calendar-year spend | Options include Suite Night Awards, a free night award, or a mattress discount | Confirmed |
| Earning | 6x Marriott properties | Ongoing | | Confirmed |

**Open assumption:** "Amex Brilliant" is taken to mean the Marriott Bonvoy Brilliant. If another card was intended, only this section changes.

## 6. Data model (high level)
- **Card** — issuer, name, annual fee, network, reward currency.
- **Benefit** — card_id, name, category, amount, cadence, reset_anchor, rules (eligible merchants, minimums, portal requirement), enrollment_required, status, effective_from, effective_to, source_url, last_verified_at. Versioned; never edited in place.
- **UserCard** — user_id, card_id, open_date, anniversary_date, fee_date, nickname, is_authorized_user, linked_account_id.
- **BenefitInstance** — user_card_id, benefit_id, period_start, period_end, amount_available, amount_used, status, expiry_notified_at.
- **UsageEvent** — benefit_instance_id, amount, date, source (manual, auto, imported), transaction_id, confidence.
- **Transaction** — account_id, date, amount, merchant, category, raw_description (from linked accounts or import).
- **ThresholdTracker** — user_card_id, benefit_id, calendar_year, spend_to_date, threshold, awarded_at.
- **Reminder** — benefit_instance_id, send_at, channel, state.
- **UserValuation** — user_id, benefit_id or currency_id, value_pct or cents_per_point.
- **OverlapRule** — benefit_ids, rule_type (mutually exclusive, redundant, shared limit), message.
- **CatalogChange** — benefit_id, change_type, before, after, effective_date, source_url, reviewed_by.

## 7. Key rules and edge cases
- **Anniversary vs. calendar boundaries:** CSP hotel credit and Bilt Cash follow the cardmember anniversary; Amex monthly/quarterly/semi-annual credits follow calendar boundaries. Instances must be generated from the correct anchor per benefit.
- **Credits that post late:** matching should look back and forward several days around the qualifying charge and handle credits that post as separate lines.
- **Partial use:** credits like Hilton resort and dining credits can be used in pieces; the tracker accumulates up to the cap and marks expired with the unused remainder.
- **Cancellations and refunds:** if a qualifying booking is cancelled or refunded (Chase reverses the hotel credit on cancelled Chase Travel bookings), the usage event must be reversible.
- **Retired and changed benefits:** history is preserved; ROI for past periods uses the benefit as it existed then.
- **Mid-year card opening:** the first period is prorated or flagged, since many credits are available immediately on open while thresholds start at zero.
- **Authorized users:** some credits are per-account rather than per-cardholder; flag so users don't double-count.
- **Time zones:** use the issuer's billing cycle and the user's local midnight, with a one-day safety margin on deadlines.

## 8. Non-functional requirements
- **Security:** encryption at rest and in transit; aggregator tokens in a secrets vault; no issuer credentials; periodic access reviews.
- **Privacy:** minimal data collection, clear consent for account linking, in-app data export and deletion, no selling of user data.
- **Reliability:** reminders must send even if the app is offline (server-scheduled push and email).
- **Accuracy:** every catalog entry shows its source and last-verified date; stale entries (over 90 days) flagged to editors.
- **Accessibility:** WCAG 2.1 AA, scalable text, screen-reader labels for progress rings.
- **Performance:** home screen loads in under 2 seconds with cached data; widget and notification actions work in one tap.

## 9. Suggested architecture
- **Client:** cross-platform mobile app (for example React Native or Flutter) plus an optional web dashboard; home-screen widget for "credits expiring this week."
- **Backend:** API service, relational database for catalog and user data, scheduler for period generation and reminders, queue workers for transaction sync and matching.
- **Integrations:** account aggregator (read-only), push and email providers, calendar export.
- **Catalog pipeline:** admin UI, review queue, diff monitoring of issuer pages, and a published, versioned catalog the client syncs.

## 10. Phased roadmap
| Phase | Scope |
|---|---|
| **MVP** | Six-card catalog, manual tracking, reset engine, reminders, threshold trackers, realistic ROI dashboard, which-card-to-use search. |
| **V1** | Account linking and auto-detection, statement import, overlap warnings, catalog change feed, renewal reports. |
| **V2** | Location-aware suggestions, household mode, widget and calendar sync, email-receipt parsing. |
| **V3** | Additional cards, community corrections, optional premium tier. |

## 11. Success metrics
- Percentage of available credit dollars captured by active users (target: above 85%).
- Forfeited credits per user per year (target: trending toward zero).
- Reminder-to-action rate (credit marked used within 7 days of a reminder).
- Setup completion: time from install to first card tracked (under 5 minutes).
- Catalog freshness: median age of last-verified date under 60 days.
- 90-day retention and weekly active use around expiry dates.

## 12. Risks and open questions
**Risks**
- **Benefit churn:** issuers change cards frequently; mitigated by versioned catalog, change monitoring and visible last-verified dates.
- **Aggregator coverage:** some issuers (particularly newer ones like Bilt) may have limited or unreliable support; manual and import fallbacks are required.
- **Matching errors:** false positives can make users think a credit was used; require confirmation on low-confidence matches and make undo easy.
- **Terms and compliance:** use of issuer names, logos and benefit descriptions should be reviewed; avoid implying affiliation with any issuer.

**Open questions**
1. Is "Amex Brilliant" the Marriott Bonvoy Brilliant card?
2. Is this a personal tool or a public product (affects monetization, support and legal review)?
3. Target platform first: iOS, Android or web?
4. Is auto-detection required for launch, or is a manual-first MVP acceptable?
5. Should the app model Membership Rewards, Ultimate Rewards and Bilt Points balances, or only benefits and fees?
6. Which benefits does the user already know they will never use (to default them to Ignore)?

## 13. Source notes
Benefit data was compiled in October 2026 from issuer announcements and travel-card reporting, including Chase's June 15, 2026 Sapphire Preferred announcement, Amex Platinum refresh coverage, Hilton Aspire and Surpass card pages, Bilt Palladium reviews and card comparison pages, and Marriott Bonvoy Brilliant card pages. Cadences marked *Verify* should be checked against each issuer's current Guide to Benefits before they are loaded into the production catalog.
