import { describe, expect, it } from "vitest";
import { buildPeriodConsumptions } from "@/lib/domain/period-consumption";

const floors = [
  { id: "f1", code: "piso-1", name: "Piso 1", occupantName: "Nasly", sortOrder: 1 },
  { id: "f2", code: "piso-2", name: "Piso 2", occupantName: "Lucy", sortOrder: 2 },
  { id: "f3", code: "piso-3", name: "Piso 3", occupantName: "Juan", sortOrder: 3 },
];

const services = [
  {
    id: "energia",
    code: "energia",
    name: "Energía",
    unit: "kWh",
    consumptionSource: "metered" as const,
    copiedFromServiceId: null,
  },
  {
    id: "agua",
    code: "agua",
    name: "Agua",
    unit: "m3",
    consumptionSource: "metered" as const,
    copiedFromServiceId: null,
  },
  {
    id: "alcantarillado",
    code: "alcantarillado",
    name: "Alcantarillado",
    unit: "m3",
    consumptionSource: "copied" as const,
    copiedFromServiceId: "agua",
  },
];

const meters = [
  { floorId: "f1", serviceId: "energia" },
  { floorId: "f2", serviceId: "energia" },
  { floorId: "f1", serviceId: "agua" },
  { floorId: "f2", serviceId: "agua" },
];

describe("buildPeriodConsumptions", () => {
  it("calcula piso 3 por diferencia y copia alcantarillado desde agua", () => {
    const result = buildPeriodConsumptions({
      floors,
      services,
      meters,
      totals: [
        { serviceId: "energia", total: 200 },
        { serviceId: "agua", total: 100 },
        { serviceId: "alcantarillado", total: 100 },
      ],
      currentReadings: [
        { floorId: "f1", serviceId: "energia", value: 8510, status: "approved" },
        { floorId: "f2", serviceId: "energia", value: 5194, status: "approved" },
        { floorId: "f1", serviceId: "agua", value: 1301, status: "approved" },
        { floorId: "f2", serviceId: "agua", value: 951, status: "approved" },
      ],
      previousBySlot: [
        { floorId: "f1", serviceId: "energia", value: 8421 },
        { floorId: "f2", serviceId: "energia", value: 5120 },
        { floorId: "f1", serviceId: "agua", value: 1284 },
        { floorId: "f2", serviceId: "agua", value: 934 },
      ],
    });

    const agua1 = result.lines.find((line) => line.floorId === "f1" && line.serviceId === "agua");
    const piso3Agua = result.lines.find((line) => line.floorId === "f3" && line.serviceId === "agua");
    const piso3Energia = result.lines.find(
      (line) => line.floorId === "f3" && line.serviceId === "energia",
    );
    const piso3Alcantarillado = result.lines.find(
      (line) => line.floorId === "f3" && line.serviceId === "alcantarillado",
    );

    expect(agua1?.consumption).toBe(17);
    expect(agua1?.floorName).toBe("Piso 1 · Nasly");
    expect(piso3Agua?.consumption).toBe(66);
    expect(piso3Agua?.floorName).toBe("Piso 3 · Juan");
    expect(piso3Energia?.consumption).toBe(37);
    expect(piso3Alcantarillado?.consumption).toBe(66);
    expect(piso3Alcantarillado?.source).toBe("copied");
    expect(result.hasNegativeUnmetered).toBe(false);
    expect(result.allMeteredCalculable).toBe(true);
  });

  it("en el período inicial no exige un período aún más antiguo", () => {
    const result = buildPeriodConsumptions({
      floors,
      services,
      meters,
      totals: [],
      currentReadings: [
        { floorId: "f1", serviceId: "agua", value: 1284, status: "approved" },
        { floorId: "f2", serviceId: "agua", value: 934, status: "approved" },
      ],
      previousBySlot: [],
      isOpeningPeriod: true,
    });

    const agua1 = result.lines.find((line) => line.floorId === "f1" && line.serviceId === "agua");
    expect(agua1?.calculable).toBe(false);
    expect(agua1?.issues.some((issue) => issue.code === "reading.opening")).toBe(true);
    expect(agua1?.issues.some((issue) => issue.code === "reading.missing_previous")).toBe(
      false,
    );
  });

  it("marca error si el piso 3 queda negativo", () => {
    const result = buildPeriodConsumptions({
      floors,
      services,
      meters,
      totals: [{ serviceId: "agua", total: 50 }],
      currentReadings: [
        { floorId: "f1", serviceId: "agua", value: 130, status: "approved" },
        { floorId: "f2", serviceId: "agua", value: 125, status: "approved" },
      ],
      previousBySlot: [
        { floorId: "f1", serviceId: "agua", value: 100 },
        { floorId: "f2", serviceId: "agua", value: 100 },
      ],
    });

    const piso3Agua = result.lines.find((line) => line.floorId === "f3" && line.serviceId === "agua");
    expect(piso3Agua?.consumption).toBe(-5);
    expect(result.hasNegativeUnmetered).toBe(true);
    expect(piso3Agua?.issues.some((issue) => issue.code === "consumption.unmetered_negative")).toBe(
      true,
    );
  });

  it("no usa una lectura pendiente para el consumo", () => {
    const result = buildPeriodConsumptions({
      floors,
      services,
      meters,
      totals: [{ serviceId: "agua", total: 100 }],
      currentReadings: [
        { floorId: "f1", serviceId: "agua", value: 1301, status: "pending" },
        { floorId: "f2", serviceId: "agua", value: 951, status: "approved" },
      ],
      previousBySlot: [
        { floorId: "f1", serviceId: "agua", value: 1284 },
        { floorId: "f2", serviceId: "agua", value: 934 },
      ],
    });

    const agua1 = result.lines.find((line) => line.floorId === "f1" && line.serviceId === "agua");
    const piso3 = result.lines.find((line) => line.floorId === "f3" && line.serviceId === "agua");
    expect(agua1?.calculable).toBe(false);
    expect(piso3?.calculable).toBe(false);
  });
});
