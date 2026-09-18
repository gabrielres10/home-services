import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth/current-user";
import { HouseMark } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export type HeaderCrumb = {
  href: string;
  label: string;
};

export function AppHeader({
  user,
  title,
  crumbs = [],
}: {
  user: CurrentUser;
  title: string;
  crumbs?: HeaderCrumb[];
}) {
  const homeHref = user.role === "admin" ? "/admin" : "/mis-lecturas";
  const atHome = crumbs.length === 0;
  const identity =
    user.role === "admin" ? user.fullName : (user.floorName ?? user.fullName);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-brand">
          <span className="app-header-mark">
            <HouseMark />
          </span>
          <div className="app-header-titles">
            <p className="kicker">Servicios de la vivienda</p>
            {crumbs.length > 0 ? (
              <nav className="crumbs" aria-label="Ruta">
                <ol>
                  {crumbs.map((crumb) => (
                    <li key={crumb.href}>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </li>
                  ))}
                  <li>
                    <h1 aria-current="page">{title}</h1>
                  </li>
                </ol>
              </nav>
            ) : (
              <h1>{title}</h1>
            )}
          </div>
        </div>
        <div className="app-header-tools">
          <Link
            href={homeHref}
            className="app-header-inicio"
            aria-current={atHome ? "page" : undefined}
          >
            Inicio
          </Link>
          <p className="app-header-user">{identity}</p>
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
