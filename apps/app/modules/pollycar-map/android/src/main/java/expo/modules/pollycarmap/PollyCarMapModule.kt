package expo.modules.pollycarmap

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PollyCarMapModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PollyCarMap")

    Constants {
      mapOf(
        "provider" to if (PollyCarMapView.isAmapAvailable()) "amap" else "synthetic",
        "gates" to mapOf(
          "realMapEnabled" to PollyCarMapView.isAmapAvailable(),
          "externalMapProviderEnabled" to PollyCarMapView.isAmapAvailable(),
          "realDeviceLocationEnabled" to false,
          "backgroundLocationEnabled" to false,
          "realVehicleLocationStreamEnabled" to false,
          "amapSdkEnabled" to PollyCarMapView.isAmapAvailable(),
          "amapWebServiceEnabled" to false
        )
      )
    }

    AsyncFunction("initializePrivacy") { state: Map<String, Any?> ->
      PollyCarMapView.updatePrivacy(
        requireNotNull(appContext.reactContext),
        state["noticeContainsAmapPolicy"] == true,
        state["noticeShown"] == true,
        state["consentGranted"] == true
      )
    }

    AsyncFunction("readDeviceLocation") {
      throw IllegalStateException("REAL_DEVICE_LOCATION_UNAVAILABLE")
    }

    AsyncFunction("setBackgroundLocationEnabled") { enabled: Boolean ->
      if (enabled) throw IllegalStateException("BACKGROUND_LOCATION_DISABLED")
    }

    View(PollyCarMapView::class) {
      Events("onCameraIdle", "onMapPress")
      Prop("centerLatitude") { view, latitude: Double -> view.setCenter(latitude = latitude) }
      Prop("centerLongitude") { view, longitude: Double -> view.setCenter(longitude = longitude) }
      Prop("zoom") { view, zoom: Double -> view.setZoom(zoom) }
      Prop("interactive") { view, enabled: Boolean -> view.setInteractive(enabled) }
      Prop("showsUserLocation") { view, enabled: Boolean -> view.setShowsUserLocation(enabled) }
      Prop("markersJson") { view, markersJson: String -> view.setMarkers(markersJson) }
    }
  }
}
