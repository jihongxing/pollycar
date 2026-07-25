import ExpoModulesCore

#if canImport(AMapFoundationKit)
import AMapFoundationKit
#endif

#if canImport(MAMapKit)
import MAMapKit
#endif

public final class PollyCarMapModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PollyCarMap")

    Constants {
      let available = PollyCarMapView.isAmapAvailable
      return [
        "provider": available ? "amap" : "synthetic",
        "gates": [
          "realMapEnabled": available,
          "externalMapProviderEnabled": available,
          "realDeviceLocationEnabled": false,
          "backgroundLocationEnabled": false,
          "realVehicleLocationStreamEnabled": false,
          "amapSdkEnabled": available,
          "amapWebServiceEnabled": false
        ]
      ]
    }

    AsyncFunction("initializePrivacy") { (state: [String: Any]) in
      guard
        state["noticeContainsAmapPolicy"] as? Bool == true,
        state["noticeShown"] as? Bool == true,
        state["consentGranted"] as? Bool == true
      else {
        throw NSError(
          domain: "PollyCarMap",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "AMAP_PRIVACY_CONSENT_REQUIRED"]
        )
      }
      #if canImport(AMapFoundationKit) && canImport(MAMapKit)
      guard
        let apiKey = Bundle.main.object(forInfoDictionaryKey: "PollyCarAmapApiKey") as? String,
        !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      else {
        throw NSError(
          domain: "PollyCarMap",
          code: 4,
          userInfo: [NSLocalizedDescriptionKey: "AMAP_IOS_API_KEY_REQUIRED"]
        )
      }
      AMapServices.shared().apiKey = apiKey
      MAMapView.updatePrivacyShow(.didShow, privacyInfo: .didContain)
      MAMapView.updatePrivacyAgree(.didAgree)
      #else
      throw NSError(
        domain: "PollyCarMap",
        code: 5,
        userInfo: [NSLocalizedDescriptionKey: "AMAP_IOS_SDK_UNAVAILABLE"]
      )
      #endif
    }
    AsyncFunction("readDeviceLocation") {
      throw NSError(domain: "PollyCarMap", code: 1, userInfo: [NSLocalizedDescriptionKey: "REAL_DEVICE_LOCATION_UNAVAILABLE"])
    }
    AsyncFunction("setBackgroundLocationEnabled") { (enabled: Bool) in
      if enabled {
        throw NSError(domain: "PollyCarMap", code: 2, userInfo: [NSLocalizedDescriptionKey: "BACKGROUND_LOCATION_DISABLED"])
      }
    }

    View(PollyCarMapView.self) {
      Events("onCameraIdle", "onMapPress")
      Prop("centerLatitude") { view, latitude: Double in view.setCenter(latitude: latitude) }
      Prop("centerLongitude") { view, longitude: Double in view.setCenter(longitude: longitude) }
      Prop("zoom") { view, zoom: Double in view.setZoom(zoom) }
      Prop("interactive") { view, enabled: Bool in view.setInteractive(enabled) }
      Prop("showsUserLocation") { view, enabled: Bool in view.setShowsUserLocation(enabled) }
      Prop("markersJson") { view, markersJson: String in view.setMarkers(markersJson) }
    }
  }
}
