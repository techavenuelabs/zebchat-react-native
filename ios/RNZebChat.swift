import Foundation
import React
import UIKit
import ZebChat

/// React Native bridge for the ZebChat iOS SDK (docs/MOBILE_SDK.md §5). A legacy native module
/// (exported by `RNZebChat.m`); it runs on the New Architecture through the interop layer.
/// Every call forwards to `ZebChat`, which is safe before `configure` and thread-safe. Calls
/// arrive on the module's method queue (not main); the two that present the chat hop to the main
/// queue (`MainActor.assumeIsolated` there, as `RCTPresentedViewController` is UIKit).
/// It reports itself to ZebChat as `react-native/<version>` (`ZebChatOptions.wrapperSDK`).
@objc(RNZebChat)
final class RNZebChat: RCTEventEmitter {
  private static let unreadEvent = "ZebChatUnread"
  /// Fallback for `wrapperSDK` (JS sends `react-native/<version>`).
  private static let sdk = "react-native/1.0.0"

  /// Removes the native unread listener; set while JS listens (`startObserving`).
  private var removeUnreadListener: (() -> Void)?

  override func supportedEvents() -> [String]! { [Self.unreadEvent] }

  override func startObserving() {
    let token = ZebChat.addUnreadListener { [weak self] count in
      self?.sendEvent(withName: Self.unreadEvent, body: ["count": count])
    }
    removeUnreadListener = { ZebChat.removeUnreadListener(token) }
  }

  override func stopObserving() {
    removeUnreadListener?()
    removeUnreadListener = nil
  }

  @objc(configure:locale:sdk:)
  func configure(_ siteKey: String, locale: String?, sdk: String?) {
    ZebChat.configure(
      siteKey: siteKey,
      options: ZebChatOptions(locale: locale ?? "auto", wrapperSDK: sdk ?? Self.sdk)
    )
  }

  @objc(setUser:)
  func setUser(_ user: NSDictionary) {
    ZebChat.setUser(
      ZebChatUser(
        id: user["id"] as? String,
        email: user["email"] as? String,
        name: user["name"] as? String,
        phone: user["phone"] as? String,
        hash: user["hash"] as? String
      )
    )
  }

  @objc func logout() {
    ZebChat.logout()
  }

  @objc func show() {
    DispatchQueue.main.async {
      MainActor.assumeIsolated {
        guard let presenter = RCTPresentedViewController() else { return }
        ZebChat.show(from: presenter)
      }
    }
  }

  @objc(trackScreen:)
  func trackScreen(_ name: String) {
    ZebChat.trackScreen(name)
  }

  @objc(track:properties:)
  func track(_ name: String, properties: NSDictionary?) {
    var strings: [String: String] = [:]
    for (key, value) in properties ?? [:] {
      if let key = key as? String, let value = value as? String { strings[key] = value }
    }
    ZebChat.track(name, properties: strings.isEmpty ? nil : strings)
  }

  @objc(setPushToken:)
  func setPushToken(_ token: String) {
    ZebChat.setPushToken(token)
  }

  @objc(handleNotificationTap:)
  func handleNotificationTap(_ data: NSDictionary) {
    let userInfo = Self.stringMap(data)
    DispatchQueue.main.async {
      MainActor.assumeIsolated {
        guard let presenter = RCTPresentedViewController() else { return }
        ZebChat.handleNotificationTap(userInfo, from: presenter)
      }
    }
  }

  /// iOS shows foreground pushes through the host's notification delegate; a ZebChat push only
  /// refreshes the unread count here (`title` / `body` are Android overrides).
  @objc(showNotification:title:body:)
  func showNotification(_ data: NSDictionary, title: String?, body: String?) {
    ZebChat.notificationReceived(Self.stringMap(data))
  }

  @objc(getUnreadCount:rejecter:)
  func getUnreadCount(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(ZebChat.unreadCount)
  }

  /// Android only: the iOS SDK refreshes on its own (foreground, ZebChat pushes, chat closed).
  @objc func refreshUnreadCount() {}

  @objc(setLocale:)
  func setLocale(_ code: String) {
    ZebChat.setLocale(code)
  }

  /// Firebase data payloads are string maps; anything else is dropped.
  private static func stringMap(_ data: NSDictionary) -> [AnyHashable: Any] {
    var out: [AnyHashable: Any] = [:]
    for (key, value) in data {
      if let key = key as? String, let value = value as? String { out[key] = value }
    }
    return out
  }
}
