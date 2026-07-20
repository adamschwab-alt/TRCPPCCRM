-- ════════════════════════════════════════════════════════════════════════════
-- 0019 Ross Hawks transition: stage 97 branch handoffs as planned_changes
-- ════════════════════════════════════════════════════════════════════════════
-- Source: workbook v10 'Ross Transition' tab. All handoffs go to Vinnie in
-- three phases: 2026-09-01 (69 branches), 2026-10-01 (25), 2026-12-01 (3).
-- Rows land status='pending'; the nightly cron executes each on its
-- scheduled_date (with a >110%-capacity guard) and flips branches.owner_id.
-- Any row can be cancelled in the UI before its date.
--
-- RUN AFTER 0018 (so current_owner snapshots capture the synced owners).
--
-- PRE-FLIGHT (run first, read-only) - BOTH must return exactly one row:
--   SELECT id, full_name FROM profiles
--   WHERE lower(full_name) = 'vinnie' OR lower(full_name) LIKE 'vinnie %';
--   SELECT id, full_name, email FROM profiles WHERE role = 'admin'
--   ORDER BY created_at LIMIT 1;
-- If the Vinnie lookup returns zero rows (no profile yet) this migration
-- inserts NOTHING - create Vinnie's profile first, then run it.
-- If it returns more than one, STOP and report; the LIMIT 1 below could
-- pick the wrong person.
-- ════════════════════════════════════════════════════════════════════════════

WITH new_owner AS (
  SELECT id FROM profiles
  WHERE lower(full_name) = 'vinnie' OR lower(full_name) LIKE 'vinnie %'
  ORDER BY created_at LIMIT 1
),
creator AS (
  SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1
)
INSERT INTO planned_changes
  (branch_id, current_owner_profile_id, new_owner_profile_id,
   scheduled_date, reason, status, notes, created_by_profile_id)
SELECT
  b.id, b.owner_id, no.id, v.move_date,
  'Ross Hawks separation - phase ' || v.phase || ' handoff',
  'pending',
  'Staged from workbook v10 Ross Transition tab',
  cr.id
FROM (VALUES
  ('Herc Rentals Inc. - Charlotte, NC', DATE '2026-09-01', 1),
  ('United Rentals - Chesapeake, VA', DATE '2026-09-01', 1),
  ('United Rentals - Greensboro, NC', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Charlotte, NC', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Spartanburg, SC', DATE '2026-09-01', 1),
  ('United Rentals - Manassas, VA', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Elgin, IL', DATE '2026-09-01', 1),
  ('United Rentals - Charlotte, NC', DATE '2026-09-01', 1),
  ('United Rentals - Quakertown, PA', DATE '2026-09-01', 1),
  ('United Rentals - Raleigh, NC', DATE '2026-09-01', 1),
  ('United Rentals - Elizabeth, NJ', DATE '2026-09-01', 1),
  ('United Rentals - Columbia, SC', DATE '2026-09-01', 1),
  ('National Trench Safety - Conley, GA', DATE '2026-09-01', 1),
  ('United Rentals - Rochester, NY', DATE '2026-09-01', 1),
  ('Allen Trench Safety Corporation - Bellevue, MI', DATE '2026-09-01', 1),
  ('United Rentals - Indianapolis, IN', DATE '2026-09-01', 1),
  ('United Rentals - North Charleston, SC', DATE '2026-09-01', 1),
  ('National Trench Safety - Cleveland, OH', DATE '2026-09-01', 1),
  ('United Rentals - Richfield, OH', DATE '2026-09-01', 1),
  ('United Rentals - Lawrenceville, GA', DATE '2026-09-01', 1),
  ('Sunstate Equipment - Concord, NC', DATE '2026-09-01', 1),
  ('United Rentals - Fairfield, OH', DATE '2026-09-01', 1),
  ('United Rentals - Pennsauken, NJ', DATE '2026-09-01', 1),
  ('United Rentals - Chicago, IL', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Memphis, TN', DATE '2026-09-01', 1),
  ('National Trench Safety - Des Moines, IA', DATE '2026-09-01', 1),
  ('United Rentals - Marmet, WV', DATE '2026-09-01', 1),
  ('National Trench Safety - Baltimore, MD', DATE '2026-09-01', 1),
  ('Herc Rentals Inc. - Newcastle, DE', DATE '2026-09-01', 1),
  ('United Rentals - Simpsonville, SC', DATE '2026-09-01', 1),
  ('United Rentals - Detroit, MI', DATE '2026-09-01', 1),
  ('National Trench Safety - Dracut, MA', DATE '2026-09-01', 1),
  ('United Rentals - Omaha, NE', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Fairfield, OH', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Hermitage, TN', DATE '2026-09-01', 1),
  ('United Rentals - Grimes, IA', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Quinton, VA', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Elkridge, MD', DATE '2026-09-01', 1),
  ('United Rentals - Fairburn, GA', DATE '2026-09-01', 1),
  ('United Rentals - Ashland, VA', DATE '2026-09-01', 1),
  ('Herc Rentals Inc. - New York, NY', DATE '2026-09-01', 1),
  ('United Rentals - Wilmington, NC', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Bronx, NY', DATE '2026-09-01', 1),
  ('National Trench Safety - Parsippany, NJ', DATE '2026-09-01', 1),
  ('United Rentals - West Mifflin, PA', DATE '2026-09-01', 1),
  ('National Trench Safety - Garner, NC', DATE '2026-09-01', 1),
  ('National Trench Safety - Toano, VA', DATE '2026-09-01', 1),
  ('National Trench Safety - Burlington, NC', DATE '2026-09-01', 1),
  ('Sunstate Equipment - Conley, GA', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Sterling, VA', DATE '2026-09-01', 1),
  ('National Trench Safety - Pittsburg, PA', DATE '2026-09-01', 1),
  ('National Trench Safety - North Charleston, SC', DATE '2026-09-01', 1),
  ('Herc Rentals Inc. - Shrewsbury, MA', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Pittsburgh, PA', DATE '2026-09-01', 1),
  ('Herc Rentals Inc.', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Trainer, PA', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Indianapolis, IN', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Corfu, NY', DATE '2026-09-01', 1),
  ('National Trench Safety - Gainesville, GA', DATE '2026-09-01', 1),
  ('Herc Rentals Inc. - Millersville, MD', DATE '2026-09-01', 1),
  ('National Trench Safety - Manchester, PA', DATE '2026-09-01', 1),
  ('United Rentals - Lansing, MI', DATE '2026-09-01', 1),
  ('Herc Rentals Inc. - Lebanon, TN', DATE '2026-09-01', 1),
  ('Sunbelt Rentals - Piscataway, NJ', DATE '2026-09-01', 1),
  ('Herc Rentals Inc. - S. Hackensack, NJ', DATE '2026-09-01', 1),
  ('National Trench Safety - Manassas, VA', DATE '2026-09-01', 1),
  ('United Rentals - Garden City, GA', DATE '2026-09-01', 1),
  ('National Trench Safety - Charlotte, NC', DATE '2026-09-01', 1),
  ('United Rentals - Louisville, KY', DATE '2026-09-01', 1),
  ('United Rentals - Shrewsbury, MA', DATE '2026-10-01', 2),
  ('United Rentals - Nashville, TN', DATE '2026-10-01', 2),
  ('National Trench Safety - Roselle, IL', DATE '2026-10-01', 2),
  ('United Rentals - Savage, MN', DATE '2026-10-01', 2),
  ('Sunstate Equipment  - Gainesville, GA', DATE '2026-10-01', 2),
  ('Sunstate Equipment - Garner, NC', DATE '2026-10-01', 2),
  ('Sunbelt Rentals - Conyers, GA', DATE '2026-10-01', 2),
  ('United Rentals - Hyattsville, MD', DATE '2026-10-01', 2),
  ('United Rentals - Columbus, OH', DATE '2026-10-01', 2),
  ('United Rentals - Bohemia, NY', DATE '2026-10-01', 2),
  ('Herc Rentals Inc. - East Point, GA', DATE '2026-10-01', 2),
  ('United Rentals - Streamwood, IL', DATE '2026-10-01', 2),
  ('Sunbelt Rentals - Wake Forest, NC', DATE '2026-10-01', 2),
  ('United Rentals - Baltimore, MD', DATE '2026-10-01', 2),
  ('United Rentals - Memphis, TN', DATE '2026-10-01', 2),
  ('United Rentals - Kennesaw, GA', DATE '2026-10-01', 2),
  ('United Rentals - Auburn, NH', DATE '2026-10-01', 2),
  ('United Rentals - Wallingford, CT', DATE '2026-10-01', 2),
  ('United Rentals - Knoxville, TN', DATE '2026-10-01', 2),
  ('United Rentals - Waukesha, WI', DATE '2026-10-01', 2),
  ('Carter Machinery Co., Inc. - District Heights, MD', DATE '2026-10-01', 2),
  ('J & B Tool, Inc. - Dallas, GA', DATE '2026-10-01', 2),
  ('Carter Machinery Co., Inc. - Salem, VA', DATE '2026-10-01', 2),
  ('ShorQuip Supply, Inc. - Conshohocken, PA', DATE '2026-10-01', 2),
  ('BOA Rentals LLC - Waterman, IL', DATE '2026-10-01', 2),
  ('Vandalia Rental - Vandalia, OH', DATE '2026-12-01', 3),
  ('Canhelco - Manassas, VA', DATE '2026-12-01', 3),
  ('Iron Lot - Burlington, NC', DATE '2026-12-01', 3)
) AS v(branch_name, move_date, phase)
JOIN branches b
  ON lower(regexp_replace(b.name, '\s+', ' ', 'g')) =
     lower(regexp_replace(v.branch_name, '\s+', ' ', 'g'))
CROSS JOIN new_owner no
CROSS JOIN creator cr
WHERE NOT EXISTS (
  SELECT 1 FROM planned_changes pc
  WHERE pc.branch_id = b.id
  AND pc.new_owner_profile_id = no.id
  AND pc.scheduled_date = v.move_date
  AND pc.status IN ('pending', 'scheduled', 'completed')
);

-- ── Post-run verification (read-only; run separately) ──
-- SELECT scheduled_date, count(*) FROM planned_changes
--   WHERE status = 'pending' GROUP BY 1 ORDER BY 1;
--   -- expect 2026-09-01: 69, 2026-10-01: 25, 2026-12-01: 3
-- SELECT count(*) FROM planned_changes;  -- expect 97 (if table was empty)
