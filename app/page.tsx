import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";

export default async function HomePage() {
  const user = await requireUser();
  redirect(user.role === "admin" ? "/admin" : "/mis-lecturas");
}
