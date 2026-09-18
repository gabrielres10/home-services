import { parseEmcaliBillText } from "./emcali-parser";
import type { BillExtractor, ExtractedBillDraft, ManualBillInput } from "./extractor";
import { readPdfPageOneText } from "./pdf-reader";

export class PdfBillExtractor implements BillExtractor {
  async extract(
    file: File | null,
    manual: ManualBillInput,
  ): Promise<ExtractedBillDraft> {
    if (!file) {
      return {
        source: "manual",
        totals: manual.totals,
        charges: manual.charges,
        otherServicesApSubtotal: manual.otherServicesApSubtotal,
      };
    }

    const text = await readPdfPageOneText(file);
    return parseEmcaliBillText(text);
  }
}
