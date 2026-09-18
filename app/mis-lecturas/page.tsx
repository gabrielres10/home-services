import Link from "next/link";
import { requireFloorUser } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { IssueList } from "@/components/issue-list";
import { ReadingForm } from "@/components/reading-form";
import { ReadingStatusBadge, MissingBadge } from "@/components/status-badge";
import { PageMain, WorkPanel } from "@/components/ui";
import { loadCatalog, loadPreviousApprovedValue, hasAnyEarlierPeriod } from "@/lib/data/catalog";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/data/period-detail";
import { PHOTOS_BUCKET } from "@/lib/storage/paths";
import { currentLessThanPreviousIssue, previousReadingIssue } from "@/lib/domain/validation";
import { formatDate, formatNumber, previousReadingDisplay } from "@/lib/format";
import { canSubmitInPeriod } from "@/lib/domain/period-status";

export default async function MyReadingsPage() {
  const user = await requireFloorUser();
  if (!user.floorId) {
    return (
      <>
        <AppHeader user={user} title="Mis lecturas" />
        <PageMain variant="narrow">
          <IssueList
            issues={[
              {
                code: "user.no_floor",
                severity: "error",
                message:
                  "Tu cuenta no está asociada a un piso. Pide al administrador que asigne la membresía.",
              },
            ]}
          />
        </PageMain>
      </>
    );
  }

  const supabase = await createServerSupabaseClient();
  const catalog = await loadCatalog();
  const floorMeters = catalog.meters.filter((meter) => meter.floorId === user.floorId);
  const floor = catalog.floors.find((item) => item.id === user.floorId);

  const { data: periods, error } = await supabase
    .from("billing_periods")
    .select("*")
    .order("starts_on", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }

  const { data: readings } = await supabase
    .from("meter_readings")
    .select("*")
    .eq("floor_id", user.floorId);

  const { data: photos } = await supabase.from("reading_photos").select("*");

  const openPeriods = (periods ?? []).filter((period) => period.status === "open");
  const otherPeriods = (periods ?? []).filter((period) => period.status !== "open");

  async function renderPeriod(period: NonNullable<typeof periods>[number], editable: boolean) {
    const earlier = await hasAnyEarlierPeriod(period.starts_on);
    return (
      <WorkPanel
        key={period.id}
        kicker={editable ? "Ahora toca enviar" : "Solo consulta"}
        title={period.label}
        hint={`${formatDate(period.starts_on)} — ${formatDate(period.ends_on)}. Energía y agua van por separado: termina una y sigue con la otra.`}
      >
        {await Promise.all(
          floorMeters.map(async (meter) => {
          const service = catalog.services.find((item) => item.id === meter.serviceId);
          const reading = (readings ?? []).find(
            (row) => row.period_id === period.id && row.service_id === meter.serviceId,
          );
          const previous = await loadPreviousApprovedValue({
            floorId: meter.floorId,
            serviceId: meter.serviceId,
            currentPeriodStartsOn: period.starts_on,
          });
          const photo = reading
            ? (photos ?? []).find((item) => item.id === reading.current_photo_id)
            : undefined;
          const photoUrl = await signedUrl(PHOTOS_BUCKET, photo?.storage_path ?? null);
          const issues = [];
          if (reading && previous !== null) {
            const warning = currentLessThanPreviousIssue(Number(reading.value), previous);
            if (warning) issues.push(warning);
          }
          if (previous === null) {
            issues.push(previousReadingIssue(earlier));
          }
          if (reading?.status === "rejected" && reading.rejection_reason) {
            issues.push({
              code: "reading.rejected",
              severity: "error" as const,
              message: `Requiere corrección: ${reading.rejection_reason}`,
            });
          }

          return (
            <div key={meter.serviceId} className="fieldset-panel stack-md">
              <div className="flex flex-wrap items-center gap-3">
                <h4 className="type-display text-[1.25rem] font-medium">
                  {service?.name}
                </h4>
                {reading ? <ReadingStatusBadge status={reading.status} /> : <MissingBadge />}
              </div>
              {photoUrl ? (
                <>
                  {/* URL firmada y privada: next/image no aplica. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt={`Fotografía enviada de ${service?.name}`}
                    className="max-h-64 w-full bg-[color-mix(in_srgb,var(--ink)_6%,var(--paper))] object-contain"
                  />
                </>
              ) : null}
              {reading ? (
                <p className="text-[0.95rem]">
                  Enviada:{" "}
                  <strong className="figure">{formatNumber(Number(reading.value))}</strong>{" "}
                  {service?.unit}. Anterior:{" "}
                  {previousReadingDisplay(previous, !earlier)}
                </p>
              ) : null}
              {editable && reading?.status !== "approved" ? (
                <ReadingForm
                  periodId={period.id}
                  floorId={meter.floorId}
                  floorName={floor?.name ?? "Tu piso"}
                  serviceId={meter.serviceId}
                  serviceName={service?.name ?? ""}
                  unit={service?.unit ?? ""}
                  previousValue={previous}
                  currentValue={reading ? String(reading.value) : ""}
                  readingDate={reading?.reading_date ?? period.ends_on}
                  issues={issues}
                  disabled={!canSubmitInPeriod(period.status)}
                  photoRequired={!reading?.current_photo_id}
                  isOpeningPeriod={!earlier}
                />
              ) : (
                <IssueList issues={issues} />
              )}
            </div>
          );
          }),
        )}
      </WorkPanel>
    );
  }

  return (
    <>
      <AppHeader user={user} title="Mis lecturas" />
      <PageMain variant="narrow">
        <aside className="now-card mb-8">
          <p className="kicker">Tu piso</p>
          <h2>{user.floorName ?? "Lecturas"}</h2>
          <p>
            En cada contador escribe el número que ves hoy y sube una foto. No
            tienes que buscar la lectura anterior: el sistema la pone.
          </p>
        </aside>
        <div className="stack-xl">
          {openPeriods.length === 0 ? (
            <p className="notice">
              No hay un período abierto. Cuando el administrador cree uno, aquí
              aparecerán tus contadores para enviar la lectura y la foto.
            </p>
          ) : (
            await Promise.all(openPeriods.map((period) => renderPeriod(period, true)))
          )}
          {otherPeriods.length > 0 ? (
            <details>
              <summary className="archive-toggle">Períodos anteriores</summary>
              <div className="mt-5 stack-lg">
                {await Promise.all(otherPeriods.map((period) => renderPeriod(period, false)))}
              </div>
            </details>
          ) : null}
        </div>
        <p className="muted mt-10 text-[0.78rem]">
          Si necesitas volver al inicio, usa{" "}
          <Link className="link-quiet" href="/">
            esta página
          </Link>
          .
        </p>
      </PageMain>
    </>
  );
}
