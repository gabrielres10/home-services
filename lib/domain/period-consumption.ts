import {
  consumptionFromApprovedReadings,
  unmeteredFloorConsumption,
} from "./consumption";
import { unmeteredConsumptionIssue } from "./validation";
import type { ReadingStatus, ValidationIssue } from "./types";

export type CatalogFloor = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
};

export type CatalogService = {
  id: string;
  code: string;
  name: string;
  unit: string;
  consumptionSource: "metered" | "copied";
  copiedFromServiceId: string | null;
};

export type SlotReading = {
  floorId: string;
  serviceId: string;
  value: number;
  status: ReadingStatus;
};

export type SlotPrevious = {
  floorId: string;
  serviceId: string;
  value: number;
};

export type ConsumptionSourceKind = "meter" | "difference" | "copied";

export type ConsumptionLine = {
  floorId: string;
  floorCode: string;
  floorName: string;
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  unit: string;
  source: ConsumptionSourceKind;
  previous: number | null;
  current: number | null;
  consumption: number | null;
  calculable: boolean;
  issues: ValidationIssue[];
};

function slotKey(floorId: string, serviceId: string): string {
  return `${floorId}:${serviceId}`;
}

export function buildPeriodConsumptions(input: {
  floors: CatalogFloor[];
  services: CatalogService[];
  meters: Array<{ floorId: string; serviceId: string }>;
  totals: Array<{ serviceId: string; total: number }>;
  currentReadings: SlotReading[];
  previousBySlot: SlotPrevious[];
}): {
  lines: ConsumptionLine[];
  hasNegativeUnmetered: boolean;
  allMeteredCalculable: boolean;
} {
  const meters = new Set(
    input.meters.map((meter) => slotKey(meter.floorId, meter.serviceId)),
  );
  const totals = new Map(
    input.totals.map((item) => [item.serviceId, item.total]),
  );
  const currentBySlot = new Map(
    input.currentReadings.map((item) => [slotKey(item.floorId, item.serviceId), item]),
  );
  const previousBySlot = new Map(
    input.previousBySlot.map((item) => [slotKey(item.floorId, item.serviceId), item.value]),
  );

  const floors = [...input.floors].sort((a, b) => a.sortOrder - b.sortOrder);
  const meteredServices = input.services.filter(
    (service) => service.consumptionSource === "metered",
  );
  const copiedServices = input.services.filter(
    (service) => service.consumptionSource === "copied",
  );

  const lines: ConsumptionLine[] = [];
  let hasNegativeUnmetered = false;
  let allMeteredCalculable = true;

  for (const service of meteredServices) {
    const meteredFloors = floors.filter((floor) =>
      meters.has(slotKey(floor.id, service.id)),
    );
    const unmeteredFloors = floors.filter(
      (floor) => !meters.has(slotKey(floor.id, service.id)),
    );

    const meteredConsumptions: Array<number | null> = [];

    for (const floor of meteredFloors) {
      const current = currentBySlot.get(slotKey(floor.id, service.id));
      const currentApproved =
        current && current.status === "approved" ? current.value : null;
      const previous = previousBySlot.get(slotKey(floor.id, service.id)) ?? null;
      const result = consumptionFromApprovedReadings(currentApproved, previous);
      const calculable = result.status === "ok";
      if (!calculable) {
        allMeteredCalculable = false;
      }
      const consumption = result.status === "ok" ? result.consumption : null;
      meteredConsumptions.push(consumption);

      const issues: ValidationIssue[] = [];
      if (result.status === "missing_previous" && currentApproved !== null) {
        issues.push({
          code: "reading.missing_previous",
          severity: "warning",
          message: "No hay lectura anterior aprobada. El consumo no es liquidable.",
        });
      }

      lines.push({
        floorId: floor.id,
        floorCode: floor.code,
        floorName: floor.name,
        serviceId: service.id,
        serviceCode: service.code,
        serviceName: service.name,
        unit: service.unit,
        source: "meter",
        previous,
        current: currentApproved,
        consumption,
        calculable,
        issues,
      });
    }

    const difference = unmeteredFloorConsumption(
      totals.get(service.id) ?? null,
      meteredConsumptions,
    );

    for (const floor of unmeteredFloors) {
      const negativeIssue = unmeteredConsumptionIssue(
        floor.name,
        service.name,
        difference,
      );
      if (difference.status === "negative") {
        hasNegativeUnmetered = true;
      }

      lines.push({
        floorId: floor.id,
        floorCode: floor.code,
        floorName: floor.name,
        serviceId: service.id,
        serviceCode: service.code,
        serviceName: service.name,
        unit: service.unit,
        source: "difference",
        previous: null,
        current: null,
        consumption:
          difference.status === "ok" || difference.status === "negative"
            ? difference.consumption
            : null,
        calculable: difference.status === "ok",
        issues: negativeIssue ? [negativeIssue] : [],
      });
    }
  }

  for (const service of copiedServices) {
    const sourceId = service.copiedFromServiceId;
    for (const floor of floors) {
      const sourceLine = sourceId
        ? lines.find(
            (line) => line.floorId === floor.id && line.serviceId === sourceId,
          )
        : undefined;

      lines.push({
        floorId: floor.id,
        floorCode: floor.code,
        floorName: floor.name,
        serviceId: service.id,
        serviceCode: service.code,
        serviceName: service.name,
        unit: service.unit,
        source: "copied",
        previous: sourceLine?.previous ?? null,
        current: sourceLine?.current ?? null,
        consumption: sourceLine?.consumption ?? null,
        calculable: sourceLine?.calculable ?? false,
        issues: [],
      });
    }
  }

  return { lines, hasNegativeUnmetered, allMeteredCalculable };
}
