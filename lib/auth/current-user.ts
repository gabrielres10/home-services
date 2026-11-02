import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/pool";
import { readSessionToken } from "@/lib/auth/session";
import { hashSessionToken } from "@/lib/auth/session-token";
import { floorDisplayName } from "@/lib/domain/floors";
import type { UserRole } from "@/lib/domain/types";

export type CurrentUser = {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  floorId: string | null;
  floorName: string | null;
};

type SessionUserRow = {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  floor_id: string | null;
  floor_name: string | null;
  occupant_name: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionToken();
  if (!token) {
    return null;
  }

  const row = await db.queryOne<SessionUserRow>(
    `select u.id, u.username, u.full_name, u.role,
            m.floor_id, f.name as floor_name, f.occupant_name
     from user_sessions s
     join users u on u.id = s.user_id
     left join floor_memberships m on m.user_id = u.id
     left join floors f on f.id = m.floor_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashSessionToken(token)],
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    floorId: row.floor_id,
    floorName:
      row.floor_name !== null
        ? floorDisplayName(row.floor_name, row.occupant_name)
        : null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login");
  }
  return current;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const current = await requireUser();
  if (current.role !== "admin") {
    redirect("/mis-lecturas");
  }
  return current;
}

export async function requireFloorUser(): Promise<CurrentUser> {
  const current = await requireUser();
  if (current.role === "admin") {
    redirect("/admin");
  }
  return current;
}
