import { db } from "@/lib/db/pool";
import type { FloorRow, FloorServiceMeterRow, ServiceRow } from "@/lib/db/types";
import { findPreviousApprovedValue } from "@/lib/domain/consumption";
import type { CatalogFloor, CatalogService } from "@/lib/domain/period-consumption";
import { serviceDisplayIndex, type ReadingStatus } from "@/lib/domain/types";

export async function loadCatalog() {
  const [floors, services, meters] = await Promise.all([
    db.query<FloorRow>("select * from floors order by sort_order"),
    db.query<ServiceRow>("select * from services order by sort_order"),
    db.query<FloorServiceMeterRow>("select * from floor_service_meters"),
  ]);

  const catalogFloors: CatalogFloor[] = floors.map((floor) => ({
    id: floor.id,
    code: floor.code,
    name: floor.name,
    occupantName: floor.occupant_name,
    sortOrder: floor.sort_order,
  }));

  const catalogServices: CatalogService[] = services.map((service) => ({
    id: service.id,
    code: service.code,
    name: service.name,
    unit: service.unit,
    consumptionSource: service.consumption_source,
    copiedFromServiceId: service.copied_from_service_id,
  }));
  catalogServices.sort(
    (left, right) => serviceDisplayIndex(left.code) - serviceDisplayIndex(right.code),
  );

  const floorOrder = new Map(catalogFloors.map((floor) => [floor.id, floor.sortOrder]));
  const serviceCodeById = new Map(catalogServices.map((service) => [service.id, service.code]));
  const catalogMeters = meters
    .map((meter) => ({
      floorId: meter.floor_id,
      serviceId: meter.service_id,
    }))
    .sort((left, right) => {
      const floorDiff = (floorOrder.get(left.floorId) ?? 0) - (floorOrder.get(right.floorId) ?? 0);
      if (floorDiff !== 0) {
        return floorDiff;
      }
      return (
        serviceDisplayIndex(serviceCodeById.get(left.serviceId) ?? "") -
        serviceDisplayIndex(serviceCodeById.get(right.serviceId) ?? "")
      );
    });

  return {
    floors: catalogFloors,
    services: catalogServices,
    meters: catalogMeters,
  };
}

export async function loadPreviousApprovedValue(input: {
  floorId: string;
  serviceId: string;
  currentPeriodStartsOn: string;
}): Promise<number | null> {
  const readings = await db.query<{
    value: number;
    status: ReadingStatus;
    starts_on: string;
    ends_on: string;
  }>(
    `select r.value, r.status, p.starts_on, p.ends_on
     from meter_readings r
     join billing_periods p on p.id = r.period_id
     where r.floor_id = $1 and r.service_id = $2`,
    [input.floorId, input.serviceId],
  );

  const history = readings.map((row) => ({
    periodStartsOn: row.starts_on,
    periodEndsOn: row.ends_on,
    status: row.status,
    value: Number(row.value),
  }));

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
  const row = await db.queryOne<{ found: boolean }>(
    "select exists (select 1 from billing_periods where starts_on < $1) as found",
    [startsOn],
  );
  return row?.found ?? false;
}
