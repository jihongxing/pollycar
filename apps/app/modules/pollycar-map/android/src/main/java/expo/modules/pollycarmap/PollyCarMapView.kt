package expo.modules.pollycarmap

import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.FrameLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.lang.reflect.Proxy

class PollyCarMapView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onCameraIdle by EventDispatcher()
  val onMapPress by EventDispatcher()

  private var latitude = 31.2304
  private var longitude = 121.4737
  private var zoom = 16.0
  private var mapView: View? = null
  private var map: Any? = null

  init {
    if (isAmapAvailable()) {
      mapView = createMapView(context)
      mapView?.let { addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)) }
      installListeners()
      applyCamera()
    }
  }

  fun setCenter(latitude: Double? = null, longitude: Double? = null) {
    this.latitude = latitude ?: this.latitude
    this.longitude = longitude ?: this.longitude
    applyCamera()
  }

  fun setZoom(zoom: Double) {
    this.zoom = zoom
    applyCamera()
  }

  fun setInteractive(enabled: Boolean) {
    mapView?.isEnabled = enabled
  }

  fun setShowsUserLocation(enabled: Boolean) {
    runCatching {
      val options = map?.javaClass?.getMethod("getUiSettings")?.invoke(map)
      options?.javaClass?.getMethod("setMyLocationButtonEnabled", Boolean::class.javaPrimitiveType)?.invoke(options, enabled)
      map?.javaClass?.getMethod("setMyLocationEnabled", Boolean::class.javaPrimitiveType)?.invoke(map, enabled)
    }
  }

  fun setMarkers(@Suppress("UNUSED_PARAMETER") markersJson: String) {
    // 标记由行程页按需传入；选点页使用中心准星，不在这里持久化精确坐标。
  }

  override fun onDetachedFromWindow() {
    runCatching { mapView?.javaClass?.getMethod("onDestroy")?.invoke(mapView) }
    super.onDetachedFromWindow()
  }

  private fun createMapView(context: Context): View? = runCatching {
    val view = Class.forName("com.amap.api.maps.MapView")
      .getConstructor(Context::class.java)
      .newInstance(context) as View
    view.javaClass.getMethod("onCreate", Bundle::class.java).invoke(view, null)
    map = view.javaClass.getMethod("getMap").invoke(view)
    view
  }.getOrNull()

  private fun applyCamera() {
    val currentMap = map ?: return
    runCatching {
      val latLngClass = Class.forName("com.amap.api.maps.model.LatLng")
      val latLng = latLngClass.getConstructor(Double::class.javaPrimitiveType, Double::class.javaPrimitiveType)
        .newInstance(latitude, longitude)
      val factory = Class.forName("com.amap.api.maps.CameraUpdateFactory")
      val update = factory.getMethod("newLatLngZoom", latLngClass, Float::class.javaPrimitiveType)
        .invoke(null, latLng, zoom.toFloat())
      currentMap.javaClass.getMethod("moveCamera", Class.forName("com.amap.api.maps.CameraUpdate"))
        .invoke(currentMap, update)
    }
  }

  private fun installListeners() {
    val currentMap = map ?: return
    runCatching {
      val cameraListener = Class.forName("com.amap.api.maps.AMap\$OnCameraChangeListener")
      val listener = Proxy.newProxyInstance(cameraListener.classLoader, arrayOf(cameraListener)) { _, method, arguments ->
        if (method.name == "onCameraChangeFinish") emitCamera(arguments?.firstOrNull())
        null
      }
      currentMap.javaClass.getMethod("setOnCameraChangeListener", cameraListener).invoke(currentMap, listener)
    }
    runCatching {
      val clickListener = Class.forName("com.amap.api.maps.AMap\$OnMapClickListener")
      val listener = Proxy.newProxyInstance(clickListener.classLoader, arrayOf(clickListener)) { _, _, arguments ->
        val point = arguments?.firstOrNull()
        emitPoint(point)
        null
      }
      currentMap.javaClass.getMethod("setOnMapClickListener", clickListener).invoke(currentMap, listener)
    }
  }

  private fun emitCamera(position: Any?) {
    val target = position?.javaClass?.getField("target")?.get(position)
    emitPoint(target)
  }

  private fun emitPoint(point: Any?) {
    val nextLatitude = point?.javaClass?.getField("latitude")?.getDouble(point) ?: return
    val nextLongitude = point.javaClass.getField("longitude").getDouble(point)
    latitude = nextLatitude
    longitude = nextLongitude
    val payload = mapOf("latitude" to latitude, "longitude" to longitude, "zoom" to zoom)
    onCameraIdle(payload)
    onMapPress(payload)
  }

  companion object {
    fun isAmapAvailable(): Boolean {
      val supportsBundledAbi = android.os.Build.SUPPORTED_ABIS.firstOrNull() in
        setOf("arm64-v8a", "armeabi-v7a")
      return supportsBundledAbi && runCatching {
        Class.forName("com.amap.api.maps.MapView")
        true
      }.getOrDefault(false)
    }

    fun updatePrivacy(context: Context, containsPolicy: Boolean, shown: Boolean, agreed: Boolean) {
      if (!isAmapAvailable()) return
      runCatching {
        val initializer = Class.forName("com.amap.api.maps.MapsInitializer")
        initializer.getMethod("updatePrivacyShow", Context::class.java, Boolean::class.javaPrimitiveType, Boolean::class.javaPrimitiveType)
          .invoke(null, context, containsPolicy, shown)
        initializer.getMethod("updatePrivacyAgree", Context::class.java, Boolean::class.javaPrimitiveType)
          .invoke(null, context, agreed)
      }
      runCatching {
        val settings = Class.forName("com.amap.api.services.core.ServiceSettings")
        settings.getMethod("updatePrivacyShow", Context::class.java, Boolean::class.javaPrimitiveType, Boolean::class.javaPrimitiveType)
          .invoke(null, context, containsPolicy, shown)
        settings.getMethod("updatePrivacyAgree", Context::class.java, Boolean::class.javaPrimitiveType)
          .invoke(null, context, agreed)
      }
    }
  }
}
