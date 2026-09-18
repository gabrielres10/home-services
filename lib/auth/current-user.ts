import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/domain/types";

export type CurrentUser = {
  id: string;
  email: string | undefined;
  fullName: string;
  role: UserRole;
  floorId: string | null;
  floorName: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const { data: membership } = await supabase
    .from("floor_memberships")
    .select("floor_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let floorName: string | null = null;
  if (membership?.floor_id) {
    const { data: floor } = await supabase
      .from("floors")
      .select("name")
      .eq("id", membership.floor_id)
      .maybeSingle();
    floorName = floor?.name ?? null;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: profile.full_name,
    role: profile.role,
    floorId: membership?.floor_id ?? null,
    floorName,
  };
}

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
