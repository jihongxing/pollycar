import ExpoModulesCore
import UIKit

#if canImport(MAMapKit)
import MAMapKit
#endif

final class PollyCarMapView: ExpoView {
  let onCameraIdle = EventDispatcher()
  let onMapPress = EventDispatcher()

  static var isAmapAvailable: Bool {
    #if canImport(MAMapKit)
    return true
    #else
    return false
    #endif
  }

  private var latitude = 31.2304
  private var longitude = 121.4737
  private var zoom = 16.0

  #if canImport(MAMapKit)
  private let mapView = MAMapView()
  #endif

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    #if canImport(MAMapKit)
    clipsToBounds = true
    mapView.frame = bounds
    mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(mapView)
    let recognizer = UITapGestureRecognizer(target: self, action: #selector(handleMapTap(_:)))
    mapView.addGestureRecognizer(recognizer)
    applyCamera()
    #endif
  }

  func setCenter(latitude: Double? = nil, longitude: Double? = nil) {
    self.latitude = latitude ?? self.latitude
    self.longitude = longitude ?? self.longitude
    applyCamera()
  }

  func setZoom(_ zoom: Double) {
    self.zoom = zoom
    applyCamera()
  }

  func setInteractive(_ enabled: Bool) {
    #if canImport(MAMapKit)
    mapView.isScrollEnabled = enabled
    mapView.isZoomEnabled = enabled
    #endif
  }

  func setShowsUserLocation(_ enabled: Bool) {
    #if canImport(MAMapKit)
    mapView.showsUserLocation = enabled
    #endif
  }

  func setMarkers(_: String) {}

  private func applyCamera() {
    #if canImport(MAMapKit)
    mapView.setCenter(CLLocationCoordinate2D(latitude: latitude, longitude: longitude), animated: false)
    mapView.zoomLevel = CGFloat(zoom)
    #endif
  }

  @objc private func handleMapTap(_ recognizer: UITapGestureRecognizer) {
    #if canImport(MAMapKit)
    let coordinate = mapView.convert(recognizer.location(in: mapView), toCoordinateFrom: mapView)
    latitude = coordinate.latitude
    longitude = coordinate.longitude
    let payload: [String: Any] = ["latitude": latitude, "longitude": longitude, "zoom": zoom]
    onMapPress(payload)
    onCameraIdle(payload)
    #endif
  }
}
