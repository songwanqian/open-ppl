import { eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";

/**
 * Check if a user exists in the database by ID.
 * Returns true if found, false otherwise. Lightweight query (only fetches the ID).
 */
export async function userExists(userId: string): Promise<boolean> {
  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result.length > 0;
}

/**
 * Check if a user has admin privileges.
 * Checks both the database isAdmin flag and the SYSTEM_MANAGER_EMAILS env var.
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const result = await db
    .select({ isAdmin: users.isAdmin, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (result.length === 0) return false;
  if (result[0].isAdmin) return true;

  const managerEmails = process.env.SYSTEM_MANAGER_EMAILS;
  if (managerEmails && result[0].email) {
    const emailList = managerEmails
      .split(",")
      .map((e) => e.trim().toLowerCase());
    return emailList.includes(result[0].email.toLowerCase());
  }
  return false;
}
