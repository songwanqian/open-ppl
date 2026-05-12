import { isUserAdmin } from "@/lib/db/users";
import { getServerSession } from "@/lib/session/get-server-session";

export async function requireAdmin() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { error: "Not authenticated", status: 401 } as const;
  }
  const admin = await isUserAdmin(session.user.id);
  if (!admin) {
    return { error: "Forbidden", status: 403 } as const;
  }
  return { userId: session.user.id } as const;
}
