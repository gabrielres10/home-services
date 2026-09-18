import { requireAdmin } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { PeriodForm } from "@/components/period-form";
import { PageMain, WorkPanel } from "@/components/ui";
import { loadPeriodList } from "@/lib/data/period-detail";

export default async function NewPeriodPage() {
  const user = await requireAdmin();
  const periods = await loadPeriodList();
  const isFirst = periods.length === 0;

  return (
    <>
      <AppHeader user={user} title="Nuevo período" crumbs={[{ href: "/admin", label: "Períodos" }]} />
      <PageMain variant="form">
        <WorkPanel
          step={1}
          kicker="Crear"
          title={isFirst ? "El primer período" : "Nuevo período"}
          hint={
            isFirst
              ? "Solo necesitas dos fechas. Luego registrarás las lecturas de Piso 1 y Piso 2. El recibo puede esperar al siguiente período."
              : "Elige el inicio y el fin. En la página siguiente cargarás el PDF del recibo y revisarás las lecturas."
          }
        >
          <PeriodForm isFirst={isFirst} />
        </WorkPanel>
      </PageMain>
    </>
  );
}
