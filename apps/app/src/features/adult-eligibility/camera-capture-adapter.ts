import { Platform } from "react-native";

export type AdultEligibilityCaptureKind = "document_front" | "document_back" | "liveness";

export type AdultEligibilityCapture = Readonly<{
  kind: AdultEligibilityCaptureKind;
  fileName: string;
  mimeType: "image/jpeg";
  previewUri?: string;
  synthetic: true;
}>;

export interface AdultEligibilityCameraCaptureAdapter {
  capture(kind: AdultEligibilityCaptureKind): Promise<AdultEligibilityCapture>;
}

export class BrowserCameraCaptureAdapter implements AdultEligibilityCameraCaptureAdapter {
  public async capture(kind: AdultEligibilityCaptureKind): Promise<AdultEligibilityCapture> {
    if (Platform.OS !== "web" || !globalThis.navigator?.mediaDevices?.getUserMedia) {
      return syntheticCapture(kind);
    }
    const stream = await globalThis.navigator.mediaDevices.getUserMedia({
      video: { facingMode: kind === "liveness" ? "user" : "environment" },
      audio: false,
    });
    try {
      return syntheticCapture(kind);
    } finally {
      stream.getTracks().forEach((track) => track.stop());
    }
  }
}

function syntheticCapture(kind: AdultEligibilityCaptureKind): AdultEligibilityCapture {
  return {
    kind,
    fileName: `synthetic-${kind}.jpg`,
    mimeType: "image/jpeg",
    synthetic: true,
  };
}
