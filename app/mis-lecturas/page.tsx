import Link from "next/link";
import { requireFloorUser } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { IssueList } from "@/components/issue-list";
import { ReadingForm } from "@/components/reading-form";
import { ReadingStatusBadge, MissingBadge } from "@/components/status-badge";
import { loadCatalog, loadPreviousApprovedValue, hasAnyEarlierPeriod } from "@/lib/data/catalog";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/data/period-detail";
import { PHOTOS_BUCKET } from "@/lib/storage/paths";
import { currentLessThanPreviousIssue } from "@/lib/domain/validation";
import { formatDate, formatNumber } from "@/lib/format";
import { canSubmitInPeriod } from "@/lib/domain/period-status";

export default async function MyReadingsPage() {
  const user = await requireFloorUser();
  if (!user.floorId) {
    return (
      <>
        <AppHeader user={user} title="Mis lecturas" />
        <main className="mx-auto max-w-3xl px-4 py-6">
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
        </main>
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
      <section key={period.id} className="space-y-4 rounded border border-stone-200 bg-white p-4">
        <div>
          <h3 className="text-lg font-medium">{period.label}</h3>
          <p className="text-sm text-stone-600">
            {formatDate(period.starts_on)} — {formatDate(period.ends_on)}
          </p>
        </div>
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
          if (previous === null && earlier) {
            issues.push({
              code: "reading.missing_previous",
              severity: "warning" as const,
              message:
                "No hay una lectura anterior aprobada. El consumo no se puede calcular todavía.",
            });
          }
          if (reading?.status === "rejected" && reading.rejection_reason) {
            issues.push({
              code: "reading.rejected",
              severity: "error" as const,
              message: `Requiere corrección: ${reading.rejection_reason}`,
            });
          }

          return (
            <div key={meter.serviceId} className="space-y-3 border-t border-stone-100 pt-3">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{service?.name}</h4>
                {reading ? <ReadingStatusBadge status={reading.status} /> : <MissingBadge />}
              </div>
              {photoUrl ? (
                <>
                  {/* URL firmada y privada: next/image no aplica. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt={`Fotografía enviada de ${service?.name}`}
                    className="max-h-64 rounded border border-stone-200 object-contain"
                  />
                </>
              ) : null}
              {reading ? (
                <p className="text-sm">
                  Enviada: {formatNumber(Number(reading.value))} {service?.unit}. Anterior:{" "}
                  {previous === null ? "no disponible" : formatNumber(previous)}
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
                />
              ) : (
                <IssueList issues={issues} />
              )}
            </div>
          );
          }),
        )}
      </section>
    );
  }

  return (
    <>
      <AppHeader user={user} title="Mis lecturas" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <p className="text-sm text-stone-600">
          Piso: <strong>{user.floorName}</strong>. Introduce solo la lectura actual y la
          fotografía. La lectura anterior se toma del último valor aprobado.
        </p>
        {openPeriods.length === 0 ? (
          <p>No hay períodos abiertos que requieran lecturas.</p>
        ) : (
          await Promise.all(openPeriods.map((period) => renderPeriod(period, true)))
        )}
        {otherPeriods.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm font-medium">Períodos anteriores</summary>
            <div className="mt-3 space-y-4">
              {await Promise.all(otherPeriods.map((period) => renderPeriod(period, false)))}
            </div>
          </details>
        ) : null}
        <p className="text-xs text-stone-500">
          Si necesitas volver al inicio, usa{" "}
          <Link className="underline" href="/">
            esta página
          </Link>
          .
        </p>
      </main>
    </>
  );
}
