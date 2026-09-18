import { requireAdmin } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { PeriodForm } from "@/components/period-form";
import { PageMain } from "@/components/ui";

export default async function NewPeriodPage() {
  const user = await requireAdmin();
  return (
    <>
      <AppHeader user={user} title="Nuevo período" />
      <PageMain variant="form">
        <PeriodForm />
      </PageMain>
    </>
  );
}
