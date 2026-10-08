# @zebchat/react-native

ZebChat live chat for React Native apps. Your users chat with your team from inside your app,
see agent replies as push notifications, and your agents see who they are talking to and which
screen they are on.

This package is a thin wrapper around the native ZebChat SDKs: Android `com.zebchat:chat` and the
iOS pod `ZebChat`. The chat screen, the visitor session and the network calls all live in those
SDKs, so the chat behaves the same as in a native app.

## Requirements

- React Native **0.74+**. The module is a classic native module, so it works with both the old
  and the New Architecture (through React Native's interop layer). No codegen step.
- Android **minSdk 23**, iOS **14+**.
- A ZebChat website and its **site key** (dashboard → Websites → Install).
- Your app's ids added in the dashboard: website editor → **Mobile apps** → the Android package
  name (`applicationId`) and the iOS bundle id. Apps that are not listed are refused.

## Install

```sh
npm install @zebchat/react-native
# or: yarn add @zebchat/react-native
```

**iOS:** install the pods (this pulls in the `ZebChat` pod):

```sh
cd ios && pod install
```

Add these keys to your app's `Info.plist` so visitors can send photos from the chat:

```xml
<key>NSCameraUsageDescription</key>
<string>Take a photo to send in the chat.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Choose a photo to send in the chat.</string>
```

**Android:** nothing else to install. `com.zebchat:chat` comes from Maven Central, which every
React Native app already uses. The module uses your app's `compileSdkVersion`, `minSdkVersion`
and Kotlin version. To pin another SDK version, set `zebchatAndroidVersion` in the `ext` block of
`android/build.gradle`.

- The SDK does not declare `CAMERA`. If your app declares and holds the camera permission, the
  chat offers "take a photo" next to the file picker.
- The SDK never asks for `POST_NOTIFICATIONS`. On Android 13+ ask for it yourself (see below).

**Expo:** works in a development build after `npx expo prebuild`. There is no config plugin
(none is needed). Expo Go is not supported because it cannot load native modules.

## Quick start

```tsx
import { useEffect } from 'react';
import { Button } from 'react-native';
import { ZebChat, useZebChatUnread } from '@zebchat/react-native';

export function App() {
  useEffect(() => {
    ZebChat.configure({ siteKey: 'zc_your_site_key' });
  }, []);

  const unread = useZebChatUnread();
  return <Button title={`Chat with us (${unread})`} onPress={() => ZebChat.show()} />;
}
```

When your user signs in or out:

```ts
// `hash` is the HMAC your server computes for identity verification (optional).
ZebChat.setUser({ id: user.id, email: user.email, name: user.name, hash: user.zebchatHash });

ZebChat.logout(); // removes this device's push token, then forgets the user and the visitor
```

Show agents where the user is:

```ts
ZebChat.trackScreen('Checkout');
```

## API

| Call                                                     | What it does                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ZebChat.configure({ siteKey, locale? })`                | Call once at startup. `locale` is `auto` (device language, the default) or a code such as `fr`.                  |
| `ZebChat.setUser({ id?, email?, name?, phone?, hash? })` | Identify the signed-in user. Empty fields are ignored.                                                           |
| `ZebChat.logout()`                                       | Delete the push device, then forget the user and the visitor.                                                    |
| `ZebChat.show()`                                         | Open the full-screen chat over the current screen.                                                               |
| `ZebChat.trackScreen(name)`                              | Send a screen view (agents see it live).                                                                         |
| `ZebChat.track(name, properties?)`                       | Custom event, like `ZebChat.track()` on the web: `name` 1–64 of `A-Z a-z 0-9 _ . : -`, string properties ≤ 2 KB. |
| `ZebChat.setPushToken(token)`                            | Forward the Firebase Messaging (FCM) token.                                                                      |
| `ZebChat.isZebChatNotification(data)`                    | `true` when a push's `data` came from ZebChat (`data.zebchat === '1'`). Also a named export.                     |
| `ZebChat.handleNotificationTap(data)`                    | Open the chat for a tapped ZebChat push. Returns `false` for other pushes.                                       |
| `ZebChat.showNotification(data, { title?, body? }?)`     | Android: show a ZebChat push that arrived in the foreground. iOS: refresh the unread count, returns `false`.     |
| `ZebChat.setLocale(code)`                                | Change the chat language for the next `show()`.                                                                  |
| `ZebChat.addUnreadListener(count => …)`                  | Listen to the unread count. Returns a subscription: call `remove()` when done.                                   |
| `ZebChat.getUnreadCount()`                               | The last unread count reported to JS listeners.                                                                  |
| `ZebChat.fetchUnreadCount()`                             | Promise: the native SDK's last known unread count (no listener needed).                                          |
| `ZebChat.refreshUnreadCount()`                           | Android: read the count from ZebChat now. iOS: no-op (the SDK refreshes on its own).                             |
| `useZebChatUnread()`                                     | React hook: the unread count, re-rendering when it changes.                                                      |

Every call is safe before `configure` (it is logged and ignored), and if the native module is not
linked (for example in Expo Go) calls log one error and do nothing.

## Push notifications

ZebChat sends pushes through **your own Firebase project**, on Android and iOS. In the dashboard,
upload a Firebase service account for the website (Mobile apps → Push notifications). For iOS,
upload your APNs key in the Firebase console (Project settings → Cloud Messaging).

This package does not depend on Firebase. Your app receives the messages and forwards them. With
[`@react-native-firebase/messaging`](https://rnfirebase.io/messaging/usage):

```ts
import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { ZebChat } from '@zebchat/react-native';

export async function setUpZebChatPush(): Promise<() => void> {
  // Ask for permission (your app decides when).
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } else {
    await messaging().requestPermission();
  }

  // Forward the token now and whenever it changes.
  ZebChat.setPushToken(await messaging().getToken());
  const unsubscribeToken = messaging().onTokenRefresh((token) => ZebChat.setPushToken(token));

  // App in the foreground: Android shows it on the `zebchat_chat` channel.
  const unsubscribeMessage = messaging().onMessage(async (message) => {
    if (ZebChat.isZebChatNotification(message.data)) ZebChat.showNotification(message.data);
  });

  // Tapped while in the background, or the tap that launched the app.
  const unsubscribeOpened = messaging().onNotificationOpenedApp((message) => {
    ZebChat.handleNotificationTap(message.data);
  });
  const initial = await messaging().getInitialNotification();
  if (initial) ZebChat.handleNotificationTap(initial.data);

  return () => {
    unsubscribeToken();
    unsubscribeMessage();
    unsubscribeOpened();
  };
}
```

- ZebChat pushes only while the visitor is offline: the app is in the background or closed
  (the chat's live connection closes when the app leaves the screen).
- To show ZebChat pushes while an iOS app is in the foreground, set
  `messaging_ios_foreground_presentation_options` in your `firebase.json`.
- The push `data` holds `{ zebchat: '1', conversationId, siteKey }` only: no personal data.

## Example app

[`example/`](example) is a small app that opens the chat, sets a user, tracks screens and shows
the unread count. Its native projects are generated from the React Native template so they always
match the React Native version in `example/package.json`:

```sh
# Android: publish the ZebChat Android SDK to Maven Local first
(cd ../android && ./gradlew publishToMavenLocal)

cd example
npm install
npm run setup          # generates android/ and ios/ (git-ignored); --force regenerates
npm run android
# iOS (macOS): cd ios && bundle install && bundle exec pod install && cd .. && npm run ios
```

Set your site key in `example/App.tsx` and add `com.zebchat.example` (Android and iOS) to the
website's Mobile apps list.

## Development

This folder is a standalone npm package: it is **not** part of the monorepo's pnpm workspace or
Turbo pipeline.

```sh
npm ci
npm run check        # oxlint · tsc --noEmit · Jest · build (dist/commonjs, dist/module, dist/typescript)
```

CI: `.github/workflows/sdk-react-native.yml` runs the same checks and builds the example for
Android against the local Android SDK. Publishing: see [PUBLISHING.md](PUBLISHING.md).

## License

MIT
