export const BILLS_BUCKET = "bills";
export const PHOTOS_BUCKET = "reading-photos";
export const MAX_BILL_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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

// Los archivos se sirven desde app/api/files, con la autorización en la ruta.
export function billPdfUrl(periodId: string): string {
  return `/api/files/bills/${periodId}`;
}

export function readingPhotoUrl(photoId: string): string {
  return `/api/files/photos/${photoId}`;
}
