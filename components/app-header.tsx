import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth/current-user";

export function AppHeader({
  user,
  title,
}: {
  user: CurrentUser;
  title: string;
}) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Servicios de la vivienda
          </p>
          <h1 className="text-lg font-semibold text-stone-900">{title}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="text-right">
            <p className="font-medium text-stone-800">{user.fullName}</p>
            <p className="text-stone-500">
              {user.role === "admin"
                ? "Administración"
                : user.floorName ?? "Piso"}
            </p>
          </div>
          {user.role === "admin" ? (
            <Link className="text-stone-700 underline" href="/admin">
              Administración
            </Link>
          ) : (
            <Link className="text-stone-700 underline" href="/mis-lecturas">
              Mis lecturas
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-50"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
