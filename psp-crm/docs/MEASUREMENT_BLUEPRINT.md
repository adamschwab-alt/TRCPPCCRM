# PSP Coverage CRM — Measurement & Attribution Blueprint

Decisions locked with owner (Jul 2026): no separate Leads object (coverage motion;
new logos are opportunities with `source`); stages stay Qualified→Quoted→Verbal→Won/Lost;
monthly forecast snapshots introduced (none exist today); manual touch logging now with
`activities.source` ready for later Outlook/Graph passive capture; no call intelligence;
AI features v1 = next-best-action + account summaries + deal-risk flags; single-wave
rollout (pre/post + dose-response attribution, no control group); baseline = trailing
12 months revenue (behavioral metrics begin at rollout); ROI bridge uses marked
placeholders for cost anchors; rep required-field burden capped at 5 fields per deal.

Legend: EXISTS = already live · EXTEND = add columns · NEW = migration 0008+

## 1. Measurement strategy
Five rules: (1) derive, don't ask; (2) capture at the moment of action, append-only;
(3) snapshot what changes (month-end forecast + DQ freezes); (4) attribution = linkage
(every AI recommendation carries entity/user/action/outcome IDs); (5) honesty at small n
(effect sizes and dollar deltas, not p-values, for ~6 reps).

Attribution lenses (no control group): pre/post vs 12-mo baseline with same-month YoY
pairing; dose-response (AI-usage intensity vs outcomes, normalized by wiring size mix,
selection-bias caveat always stated); within-rep before/after (hired_at for tenure);
recommendation-level micro-attribution (accepted vs ignored on matched accounts;
report "influenced $", never "caused").

Metric ladder: leading (touches, cadence adherence, NBA acceptance) → process
(next-step discipline, stage velocity, stalled %, DQ score) → output (pipeline created,
quotes, meetings) → outcome (GRR/NRR, win rate, cycle, forecast MAPE).

## 2. Core objects
- accounts EXISTS (+ segment optional). Derived: size class, TTM/prior, status, RAG, wiring.
- branches, contacts EXISTS (decision-maker = tier ≤ 2, derived).
- opportunities EXTEND: source (enum existing_account|new_branch|referral|inbound|event|
  cold|other), lost_reason (enum price|availability|lead_time|spec|relationship|
  no_decision|competitor|other + note), forecast_category (pipeline|best_case|commit,
  auto from stage, override logged), closed_at, primary_contact_id, competitor.
- activities EXTEND: outcome (connected|left_msg|no_response|meeting_booked|meeting_held),
  source (manual|outlook|system). Append-only; admin void flag only.
- opportunity_stage_history NEW: append-only, DB trigger on stage/amount/expected_close/
  owner/forecast_category changes (opp_id, field, old, new, changed_by, changed_at).
- profiles EXTEND: hired_at, rollout_wave (default 1), ai_enabled_at, training_completed_at.
- ai_recommendations NEW (see §4). forecast_snapshots NEW (month-end cron; per rep +
  total; system_amount = Σ weighted, adjusted_amount, by category; accuracy back-filled).
- dq_snapshots NEW (monthly completeness/freshness per rep + org).
- exogenous_events NEW (admin log of market shocks; footnotes every case-study chart).

## 3. ROI fields (delta only)
closed_at (system, on Won/Lost) → cycle length. stage_history → conversion, slippage
count, days-in-stage. source (rep, at create) → source effectiveness. lost_reason
(rep, gate at Lost) → objection patterns. forecast_category (auto+override) → forecast
accuracy vs snapshots. primary_contact_id (rep, gate at Verbal) → decision-maker
involvement. Stalled (derived) = no activity 21d OR next_date >7d past. Completeness
(derived 0–100) = weighted checklist: amount, close date, next step+date, source,
contact linked, product line. Freshness = % accounts within wiring cadence + % active
opps touched ≤14d. Misuse guards: amount sandbagging exposed by history; close-date
slip counted; "follow up" boilerplate caught by requiring next_date; category staleness
killed by auto-derivation.

## 4. AI instrumentation
ai_recommendations (append-only): id, type (next_best_action|account_summary|deal_risk),
shown_at, user_id, account_id?, branch_id?, opportunity_id?, contact_id?,
recommended_action, reason, score, model_version, prompt_version,
status (shown|accepted|dismissed|ignored), acted_at?, action_activity_id?,
override_note?, outcome_28d jsonb (order_within_28d, order_amount, stage_advanced) —
back-filled nightly; ignored = shown 3× no action.

Features: (a) NBA — formalize My Day top-10/rep/day as logged recommendations; Accept =
Log touch from card (links activity_id); add Dismiss+reason. Outcome: order within 28d,
accepted vs ignored, matched by size+status. (b) Account summary — "Brief me" button,
LLM 5-bullet pre-call brief; log shown/copied/thumbs/latency/cost; claim prep-time,
not revenue. (c) Deal-risk flags — rules (stage age, idle, no next step, single-threaded,
slippage) → chip; log shown/actioned-in-7d/dismissed; save-rate actioned vs not, per
flag type. Needs ANTHROPIC_API_KEY for (b).

## 5. Event model
User-entered: touches (10-sec modal), tasks, the 5 deal fields. System: stage history
(trigger), quote timestamp (stage→Quoted; cross-check Acumatica SO types), stalled/aging/
reopen/multithreading/DM-touched (derived nightly), sync/audit events. Immutable:
activities, stage_history, ai_recommendations, forecast/dq snapshots. In-place with
shadow history: opportunities, accounts, contacts, tasks.

## 6. Data quality & governance
Stage gates (soft-flag, not hard-block): Qualified needs account+source+line; Quoted
+amount+expected_close; Verbal +next_step+next_date+primary_contact; Lost needs
lost_reason. Every active opp requires future next_date else flagged stalled on manager
dashboard. Dupes: unique account/branch indexes (exist) + contact soft-warning.
KPI dictionary = docs/KPI_DICTIONARY.md: qualified opp, active pipeline, stalled,
AI-assisted (≥1 accepted rec in window), forecast accuracy (1−|won−commit|/commit,
signed bias), coverage (active pipeline ÷ remaining new-biz target).

## 7. Cohorts & baselines
Single wave. profiles fields future-proof a wave 2. Exposure measured via
ai_recommendations → user-vs-light-user and dose-response cuts, caveated. Baseline
package frozen at rollout: trailing-12-mo revenue by account/segment/rep, GRR/NRR/
contraction/expansion, white-space, DQ day-0, plus explicit "not measured pre-rollout"
list. Confounders: YoY same-month pairing, wiring-mix normalization, within-rep deltas,
exogenous_events footnotes.

## 8. Dashboards
1 Executive (monthly): book, GRR/NRR vs target, coverage, forecast vs actual,
AI-influenced $, DQ. 2 CRO /reports/pipeline (weekly): funnel conversion, win rate,
cycle, pipeline created, source, lost reasons. 3 Manager (weekly): rep scorecard
(exists) + stalled, slippage, gate violations. 4 Rep = My Day (exists). 5 AI
/reports/ai (monthly): acceptance by type, time-to-action, influenced $, thumbs, cost.
6 DQ admin panel (weekly). 7 Forecast (monthly): MAPE trend, bias, category hit-rate.
8 Case study (quarterly): §9 exports. All footnote "behavioral metrics begin
{rollout_date}".

## 9. Case-study outputs
Baseline freeze + auto-archived monthly snapshot packs (never regenerated); before/after
tables (baseline vs post 6/12mo); dose-response chart (acceptance quartile vs revenue
delta, matched); 3–5 deal-journey exports (opp + history + touches + recs timeline);
dated testimonial log; MAPE trend; ROI bridge with marked placeholders
([$FULLY_LOADED_REP_COST], [ADMIN_HRS_SAVED/WK]): productivity line, retention lift ×
GM%, cross-sell wins × GM%, forecast-error reduction (qualitative).

## 10. Phases
P1 wk1–2 MV measurement: migration 0008 (stage_history+trigger, opp/activity/profile
extensions), stage gates, KPI dictionary, baseline freeze. P2 wk2–3 DQ: scoring views,
dq_snapshots cron, admin panel. P3 wk3–6 AI: ai_recommendations + NBA wiring +
summaries + risk flags + nightly outcome backfill (needs ANTHROPIC_API_KEY). P4 wk6–8
dashboards + forecast_snapshots cron. P5 wk8–10 case-study package. Later: Outlook/
Graph passive capture (schema ready via activities.source).

## Non-negotiables before go-live
1 stage_history trigger · 2 baseline freeze on rollout day · 3 stage gates incl.
lost_reason · 4 ai_recommendations live with first AI feature · 5 append-only activities
(already true) · 6 month-end forecast+DQ crons · 7 KPI dictionary in repo ·
8 profiles.hired_at + ai_enabled_at · 9 exogenous-events log · 10 placeholder-marked
ROI bridge.
