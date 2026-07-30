import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export type DriverLivenessCameraPermission = "granted" | "denied";

export interface DriverLivenessCameraAdapter {
  prepare(): Promise<DriverLivenessCameraPermission>;
  release(): Promise<void>;
}

export class SyntheticDriverLivenessCameraAdapter
  implements DriverLivenessCameraAdapter
{
  private browserStream?: MediaStream;

  public async prepare(): Promise<DriverLivenessCameraPermission> {
    if (
      Platform.OS === "web" &&
      globalThis.navigator?.mediaDevices?.getUserMedia
    ) {
      try {
        this.browserStream =
          await globalThis.navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false,
          });
        return "granted";
      } catch {
        return "denied";
      }
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    return permission.granted ? "granted" : "denied";
  }

  public async release(): Promise<void> {
    this.browserStream?.getTracks().forEach((track) => track.stop());
    this.browserStream = undefined;
  }
}
