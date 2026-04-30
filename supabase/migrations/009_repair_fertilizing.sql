-- Repair fertilizing schedules for existing plants.
--
-- Step 1: fill fertilizing_interval_days where it is null, using the same
--         archetype formula as computeSmartFertilizingInterval() in TypeScript.
--         Active-season multiplier (×1.0) is used since this runs in April.
--
-- Step 2: compute next_fertilized_at for plants that have last_fertilized_at
--         but never had next_fertilized_at written (most common case).

-- Step 1 ────────────────────────────────────────────────────────────────────
WITH classified AS (
  SELECT
    id,
    CASE
      WHEN humidity_preference = 'low'  THEN 'succulent'
      WHEN humidity_preference = 'high' THEN 'moisture_loving'
      WHEN (coalesce(species,'') || ' ' || coalesce(name,'') || ' ' || coalesce(soil_type,''))
           ~* 'succulent|cactus|aloe|agave|echeveria|sedum|haworthia|jade|euphorbia|stonecrop|sempervivum'
        THEN 'succulent'
      WHEN (coalesce(species,'') || ' ' || coalesce(name,'') || ' ' || coalesce(soil_type,''))
           ~* 'fern|calathea|peace.?lily|anthurium|orchid|bromeliad|carnivorous|pitcher.?plant|sundew|boston.?fern|maidenhair'
        THEN 'moisture_loving'
      ELSE 'regular'
    END AS archetype,
    light_requirement
  FROM plants
  WHERE fertilizing_interval_days IS NULL
    AND archived_at IS NULL
),
computed AS (
  SELECT
    id,
    GREATEST(
      CASE archetype WHEN 'succulent' THEN 30 WHEN 'moisture_loving' THEN 10 ELSE 14 END,
      LEAST(
        CASE archetype WHEN 'succulent' THEN 90 WHEN 'moisture_loving' THEN 42 ELSE 60 END,
        ROUND(
          -- F0: base days per archetype
          CASE archetype WHEN 'succulent' THEN 45 WHEN 'moisture_loving' THEN 14 ELSE 21 END
          *
          -- fLight: light adjustment
          CASE light_requirement WHEN 'direct' THEN 0.85 WHEN 'low' THEN 1.4 ELSE 1.0 END
        )
      )
    )::integer AS interval_days
  FROM classified
)
UPDATE plants
SET
  fertilizing_interval_days = computed.interval_days,
  fertilizing_source        = 'formula'
FROM computed
WHERE plants.id = computed.id;

-- Step 2 ────────────────────────────────────────────────────────────────────
-- Anchor logic:
--   • last_fertilized_at exists → next = last + interval (normal cycle)
--   • no last date              → next = (acquisition_date OR created_at) + 21 days settling
-- In both cases, GREATEST with last_repotted_at + 30 to respect the post-repot suspension.
UPDATE plants
SET next_fertilized_at = GREATEST(
  CASE
    WHEN last_fertilized_at IS NOT NULL
      THEN last_fertilized_at + fertilizing_interval_days
    ELSE
      coalesce(acquisition_date, created_at::date) + 21
  END,
  coalesce(last_repotted_at + 30, '0001-01-01'::date)
)
WHERE next_fertilized_at      IS NULL
  AND fertilizing_interval_days IS NOT NULL
  AND archived_at             IS NULL;
