import { requireAdmin } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { PeriodForm } from "@/components/period-form";
import { PageMain, WorkPanel } from "@/components/ui";
import { loadPeriodList } from "@/lib/data/period-detail";
import { suggestNextPeriodDates } from "@/lib/domain/period-label";

export default async function NewPeriodPage() {
  const user = await requireAdmin();
  const periods = await loadPeriodList();
  const isFirst = periods.length === 0;
  const lastPeriod = periods.reduce<(typeof periods)[number] | null>((latest, period) => {
    if (!latest) {
      return period;
    }
    if (period.ends_on > latest.ends_on) {
      return period;
    }
    if (period.ends_on === latest.ends_on && period.starts_on > latest.starts_on) {
      return period;
    }
    return latest;
  }, null);
  const suggested = lastPeriod ? suggestNextPeriodDates(lastPeriod.ends_on) : null;

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
              : suggested
                ? "Dejé fechas sugeridas a partir del último período. Confírmalas con el recibo y las lecturas antes de crear."
                : "Elige el inicio y el fin. En la página siguiente cargarás el PDF del recibo y revisarás las lecturas."
          }
        >
          <PeriodForm
            isFirst={isFirst}
            lastPeriodLabel={lastPeriod?.label ?? null}
            suggestedStartsOn={suggested?.startsOn ?? null}
            suggestedEndsOn={suggested?.endsOn ?? null}
          />
        </WorkPanel>
      </PageMain>
    </>
  );
}
