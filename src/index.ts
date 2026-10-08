/**
 * ZebChat for React Native: a thin JS layer over the ZebChat Android SDK (`com.zebchat:chat`) and
 * iOS SDK (pod `ZebChat`). The native SDKs own the visitor session, the chat screen and the HTTP
 * calls; this module forwards calls and turns the unread count into a JS listener and a hook.
 *
 * Spec: docs/MOBILE_SDK.md §5 (React Native).
 */
import { useSyncExternalStore } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export interface ZebChatConfig {
  /** The website's site key from the dashboard (`zc_…`). */
  siteKey: string;
  /** Chat language: `auto` (device language, the default) or a code such as `fr`. */
  locale?: string | undefined;
}

/** The signed-in user of the host app. Send `hash` (server-side HMAC) for identity verification. */
export interface ZebChatUser {
  id?: string | undefined;
  email?: string | undefined;
  name?: string | undefined;
  phone?: string | undefined;
  hash?: string | undefined;
}

/** Push message data as delivered by Firebase Messaging (`remoteMessage.data`). */
export type ZebChatNotificationData = Readonly<Record<string, unknown>>;

export type ZebChatUnreadListener = (count: number) => void;

export interface ZebChatSubscription {
  remove(): void;
}

/** Overrides for `showNotification` (Android): else the push's own `title` / `body`. */
export interface ZebChatNotificationText {
  title?: string | undefined;
  body?: string | undefined;
}

/** The native module surface (Android `ZebChatModule`, iOS `RNZebChat`). */
interface ZebChatNativeModule {
  /** `sdk` is reported to ZebChat instead of `android/…` / `ios/…` (`react-native/<version>`). */
  configure(siteKey: string, locale: string | null, sdk: string): void;
  setUser(user: Record<string, string>): void;
  logout(): void;
  show(): void;
  trackScreen(name: string): void;
  /** `properties` is null when there are none. */
  track(name: string, properties: Record<string, string> | null): void;
  setPushToken(token: string): void;
  handleNotificationTap(data: Record<string, string>): void;
  /** Android shows the push; iOS only refreshes the unread count. */
  showNotification(data: Record<string, string>, title: string | null, body: string | null): void;
  setLocale(code: string): void;
  getUnreadCount(): Promise<number>;
  /** Android only (iOS refreshes on its own). */
  refreshUnreadCount(): void;
  /** Event emitter plumbing (iOS `RCTEventEmitter`, Android counts listeners). */
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

/** The package version, reported to ZebChat as `react-native/<version>`. */
export const VERSION = '1.0.0';
export const SDK_NAME = `react-native/${VERSION}`;

export const NATIVE_MODULE_NAME = 'RNZebChat';
export const UNREAD_EVENT = 'ZebChatUnread';

const LINKING_ERROR =
  "ZebChat: the native module '" +
  NATIVE_MODULE_NAME +
  "' is not linked. Rebuild the app after installing @zebchat/react-native (iOS: run " +
  '`pod install`; Expo: run `npx expo prebuild`, Expo Go is not supported).';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFunction = (value: unknown): boolean => typeof value === 'function';

const isNativeModule = (value: unknown): value is ZebChatNativeModule =>
  isRecord(value) &&
  isFunction(value.configure) &&
  isFunction(value.setUser) &&
  isFunction(value.logout) &&
  isFunction(value.show) &&
  isFunction(value.trackScreen) &&
  isFunction(value.track) &&
  isFunction(value.setPushToken) &&
  isFunction(value.handleNotificationTap) &&
  isFunction(value.showNotification) &&
  isFunction(value.setLocale) &&
  isFunction(value.getUnreadCount) &&
  isFunction(value.refreshUnreadCount) &&
  isFunction(value.addListener) &&
  isFunction(value.removeListeners);

const nativeModuleOrNull = (): ZebChatNativeModule | null => {
  const candidate: unknown = NativeModules[NATIVE_MODULE_NAME];
  return isNativeModule(candidate) ? candidate : null;
};

let warnedUnlinked = false;

/** The linked native module, or `null` (logged once) so every call stays a safe no-op. */
const native = (): ZebChatNativeModule | null => {
  const module = nativeModuleOrNull();
  if (!module && !warnedUnlinked) {
    warnedUnlinked = true;
    console.error(LINKING_ERROR);
  }
  return module;
};

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Firebase data payloads are string maps; drop anything else before it crosses the bridge. */
const stringEntries = (data: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!isRecord(data)) return out;
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
};

const USER_FIELDS = ['id', 'email', 'name', 'phone', 'hash'] as const;

const userEntries = (user: ZebChatUser): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const field of USER_FIELDS) {
    const value = user[field];
    if (nonEmpty(value)) out[field] = value.trim();
  }
  return out;
};

// ---- unread count: one native subscription shared by every JS listener ----------------------

const isUnreadEvent = (value: unknown): value is { count: number } =>
  isRecord(value) &&
  typeof value.count === 'number' &&
  Number.isInteger(value.count) &&
  value.count >= 0;

const unreadListeners = new Set<ZebChatUnreadListener>();
let unreadCount = 0;
let nativeSubscription: { remove(): void } | null = null;

const onNativeUnread = (event: unknown): void => {
  if (!isUnreadEvent(event)) return;
  unreadCount = event.count;
  for (const listener of Array.from(unreadListeners)) listener(unreadCount);
};

const startNativeUnread = (): void => {
  if (nativeSubscription) return;
  const module = native();
  if (!module) return;
  nativeSubscription = new NativeEventEmitter(module).addListener(UNREAD_EVENT, onNativeUnread);
};

const stopNativeUnread = (): void => {
  nativeSubscription?.remove();
  nativeSubscription = null;
};

// ---- public API ------------------------------------------------------------------------------

/** `true` when a push message's data came from ZebChat (`data.zebchat === '1'`). Pure JS. */
export function isZebChatNotification(data: unknown): boolean {
  return isRecord(data) && data.zebchat === '1';
}

export const ZebChat = {
  /** Call once at startup, before any other call. */
  configure(config: ZebChatConfig): void {
    if (!isRecord(config) || !nonEmpty(config.siteKey)) {
      console.error('ZebChat.configure: siteKey is required.');
      return;
    }
    const locale = nonEmpty(config.locale) ? config.locale.trim() : null;
    native()?.configure(config.siteKey.trim(), locale, SDK_NAME);
  },

  /** Identify the signed-in user (empty fields are dropped). */
  setUser(user: ZebChatUser): void {
    if (!isRecord(user)) return;
    native()?.setUser(userEntries(user));
  },

  /** Forget the user and visitor (the push device is deleted first). */
  logout(): void {
    native()?.logout();
  },

  /** Open the full-screen chat over the current screen. */
  show(): void {
    native()?.show();
  },

  /** Record a screen view agents see live, e.g. `trackScreen('Checkout')`. */
  trackScreen(name: string): void {
    if (!nonEmpty(name)) return;
    native()?.trackScreen(name.trim());
  },

  /**
   * Record a custom event agents see in the visitor's journey, like `ZebChat.track()` on the web,
   * e.g. `track('added_to_cart', { sku: 'A1' })`. `name` is 1–64 of `A-Z a-z 0-9 _ . : -`;
   * `properties` (string values) at most 2 KB as JSON. The native SDK logs and ignores invalid
   * events.
   */
  track(name: string, properties?: Record<string, string>): void {
    if (!nonEmpty(name)) return;
    const entries = stringEntries(properties);
    native()?.track(name.trim(), Object.keys(entries).length > 0 ? entries : null);
  },

  /** Forward the Firebase Messaging token (FCM on both platforms). */
  setPushToken(token: string): void {
    if (!nonEmpty(token)) return;
    native()?.setPushToken(token);
  },

  isZebChatNotification,

  /** Open the chat for a tapped ZebChat notification. Returns `false` for other pushes. */
  handleNotificationTap(data: ZebChatNotificationData | null | undefined): boolean {
    if (!isZebChatNotification(data)) return false;
    native()?.handleNotificationTap(stringEntries(data));
    return true;
  },

  /**
   * Call for every push that arrives while the app is in the foreground.
   *
   * Android: shows a ZebChat push on the `zebchat_chat` channel (FCM does not display foreground
   * pushes); `text` overrides the push's own `title` / `body`. Returns `true` when it was handed to
   * the SDK, which still skips it while the chat is on screen or notifications are off.
   *
   * iOS: the system presents the push through the host's notification delegate; this only
   * refreshes the unread count and returns `false`. Returns `false` for pushes not from ZebChat.
   */
  showNotification(
    data: ZebChatNotificationData | null | undefined,
    text?: ZebChatNotificationText,
  ): boolean {
    if (!isZebChatNotification(data)) return false;
    const module = native();
    if (!module) return false;
    const title: unknown = isRecord(text) ? text.title : undefined;
    const body: unknown = isRecord(text) ? text.body : undefined;
    module.showNotification(
      stringEntries(data),
      nonEmpty(title) ? title : null,
      nonEmpty(body) ? body : null,
    );
    return Platform.OS === 'android';
  },

  /** Chat language for the next `show()`: `auto` or a code such as `fr`. */
  setLocale(code: string): void {
    if (!nonEmpty(code)) return;
    native()?.setLocale(code.trim());
  },

  /** Listen to the visitor's unread message count. Call `remove()` on the result when done. */
  addUnreadListener(listener: ZebChatUnreadListener): ZebChatSubscription {
    unreadListeners.add(listener);
    startNativeUnread();
    let removed = false;
    return {
      remove(): void {
        if (removed) return;
        removed = true;
        unreadListeners.delete(listener);
        if (unreadListeners.size === 0) stopNativeUnread();
      },
    };
  },

  /** The last unread count the native SDK reported to JS listeners (0 until the first report). */
  getUnreadCount(): number {
    return unreadCount;
  },

  /** Reads the native SDK's last known unread count (no listener needed). 0 when not linked. */
  async fetchUnreadCount(): Promise<number> {
    const module = native();
    if (!module) return 0;
    const count: unknown = await module.getUnreadCount();
    return typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : 0;
  },

  /** Android: asks ZebChat for the unread count now (listeners hear about a change). iOS: no-op. */
  refreshUnreadCount(): void {
    native()?.refreshUnreadCount();
  },
} as const;

const subscribeUnread = (onChange: () => void): (() => void) => {
  const subscription = ZebChat.addUnreadListener(onChange);
  return () => subscription.remove();
};

const unreadSnapshot = (): number => unreadCount;

/** The visitor's unread message count; re-renders when it changes. */
export function useZebChatUnread(): number {
  return useSyncExternalStore(subscribeUnread, unreadSnapshot, unreadSnapshot);
}

export default ZebChat;
