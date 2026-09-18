import Link from "next/link";
import { HouseMark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="auth-screen">
      <div className="auth-frame auth-frame-solo">
        <div className="auth-identity">
          <HouseMark size="lg" />
          <h1>No encontrado</h1>
          <p>Esa página o período no existe.</p>
          <p className="mt-8">
            <Link className="link-quiet" href="/">
              Volver al inicio
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
