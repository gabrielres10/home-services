export const BILLS_BUCKET = "bills";
export const PHOTOS_BUCKET = "reading-photos";

export function billPdfPath(periodId: string): string {
  return `${periodId}/recibo.pdf`;
}

export function readingPhotoPath(input: {
  floorId: string;
  periodId: string;
  serviceId: string;
  fileId: string;
}): string {
  return `${input.floorId}/${input.periodId}/${input.serviceId}/${input.fileId}.jpg`;
}
