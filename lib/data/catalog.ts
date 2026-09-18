import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findPreviousApprovedValue } from "@/lib/domain/consumption";
import type { CatalogFloor, CatalogService } from "@/lib/domain/period-consumption";

export async function loadCatalog() {
  const supabase = await createServerSupabaseClient();

  const [
    { data: floors, error: floorsError },
    { data: services, error: servicesError },
    { data: meters, error: metersError },
  ] = await Promise.all([
    supabase.from("floors").select("*").order("sort_order"),
    supabase.from("services").select("*").order("sort_order"),
    supabase.from("floor_service_meters").select("*"),
  ]);

  if (floorsError) throw new Error(floorsError.message);
  if (servicesError) throw new Error(servicesError.message);
  if (metersError) throw new Error(metersError.message);

  const catalogFloors: CatalogFloor[] = (floors ?? []).map((floor) => ({
    id: floor.id,
    code: floor.code,
    name: floor.name,
    sortOrder: floor.sort_order,
  }));

  const catalogServices: CatalogService[] = (services ?? []).map((service) => ({
    id: service.id,
    code: service.code,
    name: service.name,
    unit: service.unit,
    consumptionSource: service.consumption_source,
    copiedFromServiceId: service.copied_from_service_id,
  }));

  return {
    floors: catalogFloors,
    services: catalogServices,
    meters: (meters ?? []).map((meter) => ({
      floorId: meter.floor_id,
      serviceId: meter.service_id,
    })),
  };
}

export async function loadPreviousApprovedValue(input: {
  floorId: string;
  serviceId: string;
  currentPeriodStartsOn: string;
}): Promise<number | null> {
  const supabase = await createServerSupabaseClient();
  const { data: readings, error } = await supabase
    .from("meter_readings")
    .select("value, status, period_id")
    .eq("floor_id", input.floorId)
    .eq("service_id", input.serviceId);

  if (error) {
    throw new Error(error.message);
  }
  if (!readings || readings.length === 0) {
    return null;
  }

  const periodIds = [...new Set(readings.map((row) => row.period_id))];
  const { data: periods, error: periodsError } = await supabase
    .from("billing_periods")
    .select("id, starts_on, ends_on")
    .in("id", periodIds);

  if (periodsError) {
    throw new Error(periodsError.message);
  }

  const datesById = new Map(
    (periods ?? []).map((period) => [
      period.id,
      { startsOn: period.starts_on, endsOn: period.ends_on },
    ]),
  );
  const history = readings.flatMap((row) => {
    const dates = datesById.get(row.period_id);
    if (!dates) {
      return [];
    }
    return [
      {
        periodStartsOn: dates.startsOn,
        periodEndsOn: dates.endsOn,
        status: row.status,
        value: Number(row.value),
      },
    ];
  });

  return findPreviousApprovedValue(input.currentPeriodStartsOn, history);
}

export async function loadPreviousBySlots(input: {
  slots: Array<{ floorId: string; serviceId: string }>;
  currentPeriodStartsOn: string;
}): Promise<Array<{ floorId: string; serviceId: string; value: number }>> {
  const results: Array<{ floorId: string; serviceId: string; value: number }> = [];
  for (const slot of input.slots) {
    const value = await loadPreviousApprovedValue({
      floorId: slot.floorId,
      serviceId: slot.serviceId,
      currentPeriodStartsOn: input.currentPeriodStartsOn,
    });
    if (value !== null) {
      results.push({ floorId: slot.floorId, serviceId: slot.serviceId, value });
    }
  }
  return results;
}

export async function hasAnyEarlierPeriod(startsOn: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("billing_periods")
    .select("id", { count: "exact", head: true })
    .lt("starts_on", startsOn);

  if (error) {
    throw new Error(error.message);
  }
  return (count ?? 0) > 0;
}
