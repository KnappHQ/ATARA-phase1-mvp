-- Handles that the old PATCH /user/me stored verbatim.
--
-- Registration lowercases handles and getUserByHandle looks them up lowercased,
-- but the profile update wrote the raw value. A handle set to "Alice" is
-- therefore unreachable by search and by payment link. utils/profileValidation.ts
-- closes the write path; these rows predate it and are not repaired by any
-- migration, deliberately - renaming a user is not something to do without
-- looking first.
--
-- Run the SELECT before deploying. Only run the UPDATE if it returns rows and
-- the collision report below is empty.

-- 1. Who is affected.
SELECT id, handle, "displayName", "createdAt"
FROM "User"
WHERE handle <> lower(handle)
ORDER BY "createdAt";

-- 2. Collisions: rows whose lowercase form is already taken by someone else.
--    These CANNOT be fixed by the UPDATE - the unique index would reject it.
--    Decide case by case who keeps the handle.
SELECT lower(u.handle) AS target_handle,
       count(*)        AS claimants,
       array_agg(u.id) AS user_ids
FROM "User" u
WHERE lower(u.handle) IN (
  SELECT lower(handle) FROM "User" WHERE handle <> lower(handle)
)
GROUP BY lower(u.handle)
HAVING count(*) > 1;

-- 3. The repair. Skips any handle whose lowercase form is already taken, so it
--    is safe to run even if step 2 returned rows - those are simply left alone.
-- BEGIN;
-- UPDATE "User" AS u
-- SET handle = lower(u.handle)
-- WHERE u.handle <> lower(u.handle)
--   AND NOT EXISTS (
--     SELECT 1 FROM "User" other
--     WHERE other.id <> u.id AND other.handle = lower(u.handle)
--   );
-- COMMIT;
