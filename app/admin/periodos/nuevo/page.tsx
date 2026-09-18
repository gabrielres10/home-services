import { requireAdmin } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { PeriodForm } from "@/components/period-form";

export default async function NewPeriodPage() {
  const user = await requireAdmin();
  return (
    <>
      <AppHeader user={user} title="Nuevo período" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <PeriodForm />
      </main>
    </>
  );
}
