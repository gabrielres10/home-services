import { describe, expect, it } from "vitest";
import {
  UnimplementedCalculationEngine,
  type SettlementInput,
} from "@/lib/domain/settlement";
import { extractBillDraft, ManualBillExtractor } from "@/lib/billing/extractor";

describe("CalculationEngine", () => {
  it("no inventa fórmulas de liquidación", () => {
    const engine = new UnimplementedCalculationEngine();
    const input: SettlementInput = {
      periodId: "p1",
      periodLabel: "Septiembre 2026",
      consumptions: [],
    };
    expect(() => engine.calculate(input)).toThrow(/fórmulas de liquidación/i);
  });
});

describe("BillExtractor", () => {
  it("en v1 usa la captura manual y deja el PDF para un extractor futuro", async () => {
    const draft = await extractBillDraft(null, {
      totals: [{ serviceCode: "agua", totalConsumption: 100 }],
      charges: [{ serviceCode: "agua", chargeCode: "cargo_basico", amount: 15000 }],
      otherServicesApSubtotal: 42000,
    }, new ManualBillExtractor());
    expect(draft.source).toBe("manual");
    expect(draft.totals[0]?.totalConsumption).toBe(100);
    expect(draft.charges[0]?.amount).toBe(15000);
    expect(draft.otherServicesApSubtotal).toBe(42000);
  });
});
