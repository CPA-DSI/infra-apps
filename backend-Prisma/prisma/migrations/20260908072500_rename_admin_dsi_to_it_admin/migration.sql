-- Rename enum value ADMIN_DSI to IT_ADMIN in UserRole

-- 1. Add a temporary tracking column
ALTER TABLE "users" ADD COLUMN "role_tmp" BOOLEAN DEFAULT false;

-- 2. Mark rows that currently have ADMIN_DSI
UPDATE "users" SET "role_tmp" = true WHERE role = 'ADMIN_DSI';

-- 3. Update ADMIN_DSI rows to USER (safe intermediate value)
UPDATE "users" SET role = 'USER' WHERE role = 'ADMIN_DSI';

-- 4. Drop the default value on the role column
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- 5. Create a new enum type with the desired values
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'IT_ADMIN', 'DIRECTION');

-- 6. Update the column to use the new type
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING "role"::text::"UserRole_new";

-- 7. Set the default value back
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';

-- 8. Restore the IT_ADMIN role for users that had ADMIN_DSI
UPDATE "users" SET role = 'IT_ADMIN' WHERE "role_tmp" = true;

-- 9. Drop the temporary column
ALTER TABLE "users" DROP COLUMN "role_tmp";

-- 10. Drop the old type
DROP TYPE "UserRole";

-- 11. Rename the new type to the original name
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
