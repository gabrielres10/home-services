export type BillServiceTotalInput = {
  serviceCode: string;
  totalConsumption: number | null;
};

export type BillChargeInput = {
  serviceCode: string;
  chargeCode: string;
  amount: number | null;
};

export type ExtractedBillDraft = {
  source: "manual" | "pdf";
  totals: BillServiceTotalInput[];
  charges: BillChargeInput[];
  otherServicesApSubtotal: number | null;
};

export type ManualBillInput = {
  totals: BillServiceTotalInput[];
  charges: BillChargeInput[];
  otherServicesApSubtotal: number | null;
};

export interface BillExtractor {
  extract(
    file: File | null,
    manual: ManualBillInput,
  ): Promise<ExtractedBillDraft>;
}

export class ManualBillExtractor implements BillExtractor {
  async extract(
    _file: File | null,
    manual: ManualBillInput,
  ): Promise<ExtractedBillDraft> {
    return {
      source: "manual",
      totals: manual.totals,
      charges: manual.charges,
      otherServicesApSubtotal: manual.otherServicesApSubtotal,
    };
  }
}

export async function extractBillDraft(
  file: File | null,
  manual: ManualBillInput,
  extractor: BillExtractor = new ManualBillExtractor(),
): Promise<ExtractedBillDraft> {
  return extractor.extract(file, manual);
}
