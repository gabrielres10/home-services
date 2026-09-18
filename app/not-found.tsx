import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">No encontrado</h1>
      <p className="mt-2 text-stone-600">Esa página o período no existe.</p>
      <Link className="mt-4 inline-block underline" href="/">
        Volver al inicio
      </Link>
    </main>
  );
}
