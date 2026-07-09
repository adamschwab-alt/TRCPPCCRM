# PSP Coverage CRM — KPI Dictionary

Single source of truth for metric definitions. If a report and this file
disagree, the report is wrong. Change definitions only by PR to this file.

## Revenue (source: sales_transactions via metric views; status <> 'Canceled')
- **Current book (TTM)** — net sales in the 12 months ending at `as_of_date`.
- **Prior book** — the 12 months before that.
- **GRR** — (prior − lapsed prior − contraction) / prior. Account grain: a parent's
  branches are summed BEFORE status is evaluated.
- **NRR** — GRR numerator + expansion, / prior.
- **Contraction** — Σ negative account deltas, excluding Lapsed accounts.
- **Expansion** — Σ positive account deltas, excluding New accounts.
- **New business** — TTM revenue of accounts with no prior-year revenue.
- **Lapsed** — prior-year revenue > 0, TTM = 0.

## Funnel (source: opportunities + opportunity_stage_history)
- **Qualified opportunity** — an opportunity past creation gates (account, source,
  product line). All opportunities in this system are at least Qualified.
- **Active pipeline** — open opps (not Won/Lost) whose next_date is not more than
  30 days in the past.
- **Pipeline created (period)** — Σ amount of opps created in the period
  (`created_at`), regardless of current stage.
- **Pipeline coverage** — active pipeline ÷ (new-business target − new business
  booked TTM).
- **Win rate (period)** — Won ÷ (Won + Lost), by `closed_at` in period. Count and
  dollar-weighted variants both reported; label which.
- **Cycle length** — `closed_at` − `created_at`, Won deals only, median reported.
- **Stage conversion** — of opps that ENTERED stage S (history), % that later
  reached stage S+1 or Won. Entering = first history row with new_value = S.
- **Slippage count** — number of `expected_close` changes in history where the
  new date is later than the old.
- **Stalled** — open opp with (a) no activity in 21 days, OR (b) next_date more
  than 7 days past. Either alone qualifies.
- **Speed-to-first-touch** — first activity on the opp's account/branch after
  opp `created_at`, in days. (No leads object; this replaces speed-to-lead.)

## Activity & coverage (source: activities, wiring)
- **Touch** — one activities row (call/visit/email/note). Append-only; source
  field distinguishes manual vs future passive capture.
- **Wiring cadence** — target touch interval from account size class (TTM:
  A≥$6M, B≥$2M, C≥$1M, D≥$200K, E below) × relationship rating (1/2/3) per the
  Customer Wiring matrix {A:[12,12,6], B:[8,8,4], C:[6,4,2], D:[4,2,1], E:[2,1,0]}
  touches/year. E×3 = no cadence.
- **Cadence overdue** — branch idle (no order) longer than its account's wiring
  interval. (Order recency, not touch recency — it flags commercial risk.)
- **Coverage % (rep, 90d)** — owned accounts with ≥1 touch in the last 90 days ÷
  owned accounts.
- **Plan vs actual (weekly)** — plan = Σ wiring touches/yr over book ÷ 52;
  actual = touches logged in last 30 days ÷ (30/7).

## Forecast (source: forecast_snapshots — Phase 4)
- **Forecast category** — pipeline / best_case / commit. Auto-mapped from stage
  (Qualified/Quoted/Verbal); explicit changes are overrides, recorded in history.
- **Forecast accuracy (month)** — 1 − |won$ − committed$| ÷ committed$, from the
  month-start snapshot. Report signed bias (over/under) alongside.

## Data quality (Phase 2)
- **Completeness (active opp)** — % of: amount, expected_close, next_step,
  next_date, source, primary_contact_id, product_line present.
- **Freshness** — % of accounts within wiring cadence + % of active opps
  touched in last 14 days.

## AI (source: ai_recommendations — Phase 3)
- **AI-assisted account (period)** — ≥1 accepted recommendation in the period.
- **Acceptance rate** — accepted ÷ shown, by recommendation type. "Ignored" =
  shown 3+ times with no action.
- **Influenced revenue** — orders within 28 days of an accepted recommendation
  on that account, compared against ignored-recommendation accounts matched by
  wiring size + status. Always labeled "influenced," never "caused."

## Cohorts
- Behavioral metrics (touches, funnel, AI) begin at rollout; revenue metrics
  have full history. Every chart footnotes this.
- Rep comparisons control for `hired_at` (tenure) and book size (wiring mix).
- Market shocks are recorded in `exogenous_events` and footnoted.
