export type VehicleMaterialKind =
  | "driver_license"
  | "vehicle_registration"
  | "insurance_proof";

export type VehicleMaterialRecognitionInput = Readonly<{
  materialKind: VehicleMaterialKind;
  mimeType: "image/jpeg" | "image/png" | "image/bmp";
  content: Uint8Array;
}>;

export type VehicleMaterialRecognitionSignal = Readonly<{
  providerId: "tencent-cloud-ocr";
  providerRequestId: string;
  materialKind: VehicleMaterialKind;
  outcome: "precheck_passed" | "needs_manual_review" | "failed" | "unknown";
  extractedFields: Readonly<Record<string, string>>;
  warningCodes: readonly string[];
}>;

export interface VehicleMaterialRecognitionProvider {
  recognize(
    input: VehicleMaterialRecognitionInput,
  ): Promise<VehicleMaterialRecognitionSignal>;
}
