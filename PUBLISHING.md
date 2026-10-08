# Publishing @zebchat/react-native

The package is published to npm under the **`@zebchat`** organization, from GitHub Actions with
**provenance**. Nothing is published from a laptop.

## Accounts (one-time)

- npm organization `@zebchat` (owner: ZebChat). At least two owners, 2FA required for everyone.
- On npmjs.com → package settings → **Trusted publishing**: add GitHub Actions for the repository
  `gossdhosting/Zebchat`, workflow `sdk-react-native-publish.yml`. With trusted publishing (OIDC)
  no npm token is stored in GitHub. Before the package exists, do the first publish with a
  granular automation token (`NPM_TOKEN` secret, publish rights on `@zebchat/*` only), then switch
  to trusted publishing and delete the token.

## Public repository

`package.json` has no `repository` / `bugs` yet: there is no public repository for the SDKs.
Before the first release, create the public mirror (like the Drupal module and `zebchat-ios`),
then add `repository` (npm provenance checks it against the publishing repo) and `bugs`, and
point the podspec's `s.source` at it (it only matters for CocoaPods trunk; React Native apps
install the pod from `node_modules` by path).

## Order

The wrapper depends on the published native SDKs, so publish them **first**, with the same
version:

1. Android `com.zebchat:chat:<version>` on Maven Central (`sdks/android/PUBLISHING.md`).
2. iOS pod `ZebChat <version>` on CocoaPods trunk (`sdks/ios/PUBLISHING.md`).
3. Then this package.

Check that both are resolvable before step 3 (Maven Central can take up to an hour to sync).

## Release steps

1. Update `version` in `package.json` (the podspec reads it), `VERSION` in `src/index.ts`
   (reported as `react-native/<version>`; a test checks they match) and the `SDK` fallbacks in
   `android/.../ZebChatModule.kt` and `ios/RNZebChat.swift`. If the native SDK version
   changed, update the `zebchatAndroidVersion` fallback in `android/build.gradle` and the `ZebChat`
   dependency in `zebchat-react-native.podspec`.
2. `npm ci && npm run check` (lint, typecheck, tests, build).
3. `npm pack --dry-run` and check the file list: `src/` (without tests), `dist/`, `android/`
   (no `build/`), `ios/`, `react-native.config.js`, `zebchat-react-native.podspec`, README, LICENSE.
4. Commit, then tag `react-native-v<version>` (the podspec's `source` tag) and push the tag.
5. The publish workflow runs `npm publish --provenance --access public`.

Workflow (add as `.github/workflows/sdk-react-native-publish.yml` when the accounts are ready):

```yaml
name: Publish React Native SDK
on:
  push:
    tags: ['react-native-v*']
permissions:
  contents: read
  id-token: write # npm provenance / trusted publishing
jobs:
  publish:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: sdks/react-native
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run check
      - run: npm publish --provenance --access public
```

## After publishing

- In a fresh app (`npx @react-native-community/cli init`), `npm install @zebchat/react-native`,
  `pod install`, build both platforms and open the chat.
- `npm view @zebchat/react-native` shows the version and the provenance attestation.
- Update the version in the dashboard install snippets and the website docs (`/docs/mobile-sdk`).
- A bad release: `npm deprecate @zebchat/react-native@<version> "<reason>"` and publish a fix.
  Do not unpublish.
