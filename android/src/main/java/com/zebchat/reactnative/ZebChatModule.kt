package com.zebchat.reactnative

import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.ViewManager
import com.zebchat.chat.UnreadListener
import com.zebchat.chat.ZebChat
import com.zebchat.chat.ZebChatOptions
import com.zebchat.chat.ZebChatUser

/**
 * React Native bridge for the ZebChat Android SDK (docs/MOBILE_SDK.md §5). A legacy native module:
 * it runs on the New Architecture through the interop layer. Every call forwards to [ZebChat];
 * the SDK itself is safe before `configure` and thread-safe. It reports itself to ZebChat as
 * `react-native/<version>` (`ZebChatOptions.sdk`).
 */
class ZebChatModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  /** One instance, so remove finds what add registered. */
  private val unreadListener = UnreadListener { count -> emitUnread(count) }
  private var jsListeners = 0

  override fun getName(): String = NAME

  @ReactMethod
  fun configure(siteKey: String, locale: String?, sdk: String?) {
    ZebChat.configure(
      reactContext.applicationContext,
      siteKey = siteKey,
      options = ZebChatOptions(locale = locale ?: "auto", sdk = sdk ?: SDK),
    )
  }

  @ReactMethod
  fun setUser(user: ReadableMap) {
    ZebChat.setUser(
      ZebChatUser(
        id = user.stringOrNull("id"),
        email = user.stringOrNull("email"),
        name = user.stringOrNull("name"),
        phone = user.stringOrNull("phone"),
        hash = user.stringOrNull("hash"),
      ),
    )
  }

  @ReactMethod
  fun logout() {
    ZebChat.logout()
  }

  @ReactMethod
  fun show() {
    withActivity("show") { activity -> ZebChat.show(activity) }
  }

  @ReactMethod
  fun trackScreen(name: String) {
    ZebChat.trackScreen(name)
  }

  @ReactMethod
  fun track(name: String, properties: ReadableMap?) {
    ZebChat.track(name, properties?.toStringMap())
  }

  @ReactMethod
  fun setPushToken(token: String) {
    ZebChat.setPushToken(token)
  }

  @ReactMethod
  fun handleNotificationTap(data: ReadableMap) {
    val strings = data.toStringMap()
    withActivity("handleNotificationTap") { activity ->
      ZebChat.handleNotificationTap(activity, strings)
    }
  }

  @ReactMethod
  fun showNotification(data: ReadableMap, title: String?, body: String?) {
    ZebChat.showNotification(reactContext.applicationContext, data.toStringMap(), title, body)
  }

  @ReactMethod
  fun getUnreadCount(promise: Promise) {
    promise.resolve(ZebChat.unreadCount)
  }

  @ReactMethod
  fun refreshUnreadCount() {
    ZebChat.refreshUnreadCount()
  }

  @ReactMethod
  fun setLocale(code: String) {
    ZebChat.setLocale(code)
  }

  // ---- unread count events (NativeEventEmitter calls these) -----------------------------------

  @ReactMethod
  fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {
    synchronized(this) {
      if (jsListeners++ == 0) ZebChat.addUnreadListener(unreadListener)
    }
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    synchronized(this) {
      if (jsListeners == 0) return
      jsListeners = (jsListeners - count).coerceAtLeast(0)
      if (jsListeners == 0) ZebChat.removeUnreadListener(unreadListener)
    }
  }

  override fun invalidate() {
    synchronized(this) {
      if (jsListeners > 0) ZebChat.removeUnreadListener(unreadListener)
      jsListeners = 0
    }
    super.invalidate()
  }

  private fun emitUnread(count: Int) {
    if (!reactContext.hasActiveReactInstance()) return
    val payload = Arguments.createMap().apply { putInt("count", count) }
    reactContext.emitDeviceEvent(UNREAD_EVENT, payload)
  }

  private fun withActivity(call: String, block: (android.app.Activity) -> Unit) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      Log.w(TAG, "ZebChat.$call: no current Activity, ignored")
      return
    }
    UiThreadUtil.runOnUiThread { block(activity) }
  }

  private fun ReadableMap.stringOrNull(key: String): String? =
    if (hasKey(key) && getType(key) == ReadableType.String) getString(key) else null

  /** Firebase data payloads are string maps; anything else is dropped. */
  private fun ReadableMap.toStringMap(): Map<String, String> {
    val out = HashMap<String, String>()
    val keys = keySetIterator()
    while (keys.hasNextKey()) {
      val key = keys.nextKey()
      stringOrNull(key)?.let { out[key] = it }
    }
    return out
  }

  companion object {
    const val NAME = "RNZebChat"
    const val UNREAD_EVENT = "ZebChatUnread"

    /** Fallback for `ZebChatOptions.sdk` (JS sends `react-native/<version>`). */
    const val SDK = "react-native/1.0.0"
    private const val TAG = "ZebChat"
  }
}

/** Registered by autolinking (see react-native.config.js). */
class ZebChatPackage : ReactPackage {
  @Suppress("OVERRIDE_DEPRECATION")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(ZebChatModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
