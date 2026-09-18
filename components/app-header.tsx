import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth/current-user";
import { HouseMark } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function AppHeader({
  user,
  title,
}: {
  user: CurrentUser;
  title: string;
}) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-brand">
          <HouseMark />
          <div className="app-header-titles">
            <p className="kicker">Servicios de la vivienda</p>
            <h1>{title}</h1>
          </div>
        </div>
        <div className="app-header-tools">
          <div className="app-header-user">
            <strong>{user.fullName}</strong>
            <span>
              {user.role === "admin" ? "Administración" : (user.floorName ?? "Piso")}
            </span>
          </div>
          {user.role === "admin" ? (
            <Link className="app-header-nav" href="/admin">
              Administración
            </Link>
          ) : (
            <Link className="app-header-nav" href="/mis-lecturas">
              Mis lecturas
            </Link>
          )}
          <form action={signOut}>
            <SubmitButton variant="ghost" pendingLabel="Saliendo…">
              Salir
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}
