// Generates the example's native projects (android/, ios/) from the React Native template that
// matches package.json, then wires them to the local ZebChat SDKs:
//   - Android resolves com.zebchat:chat from mavenLocal()
//     (run `./gradlew publishToMavenLocal` in sdks/android first);
//   - iOS uses `pod 'ZebChat', :path => '../../../ios'`.
// Usage: node scripts/setup.mjs [--force]   (--force regenerates existing folders)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_NAME = 'ZebChatExample';
const APP_ID = 'com.zebchat.example';

const example = join(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const pkg = JSON.parse(readFileSync(join(example, 'package.json'), 'utf8'));
const rnVersion = pkg.dependencies['react-native'];
const cliVersion = pkg.devDependencies['@react-native-community/cli'];

if (!force && existsSync(join(example, 'android')) && existsSync(join(example, 'ios'))) {
  console.log('android/ and ios/ already exist (use --force to regenerate).');
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), 'zebchat-rn-example-'));
const generated = join(tmp, APP_NAME);
try {
  console.log(`Generating the React Native ${rnVersion} template…`);
  execFileSync(
    'npx',
    [
      '--yes',
      `@react-native-community/cli@${cliVersion}`,
      'init',
      APP_NAME,
      '--version',
      rnVersion,
      '--package-name',
      APP_ID,
      '--directory',
      generated,
      '--skip-install',
      '--install-pods',
      'false',
      '--skip-git-init',
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );

  for (const entry of ['android', 'ios', 'Gemfile']) {
    const target = join(example, entry);
    rmSync(target, { recursive: true, force: true });
    cpSync(join(generated, entry), target, { recursive: true });
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

/** Applies `edit` to a generated file; fails loudly if the template changed shape. */
const patch = (relative, edit) => {
  const file = join(example, relative);
  const before = readFileSync(file, 'utf8');
  const after = edit(before);
  if (after === before) throw new Error(`setup: could not patch ${relative}`);
  writeFileSync(file, after);
};

// Android: the app module resolves com.zebchat:chat (a transitive dependency) from mavenLocal().
patch(
  'android/build.gradle',
  (text) =>
    `${text.trimEnd()}\n\n// ZebChat: the local SDK build (sdks/android: ./gradlew publishToMavenLocal).\n` +
    `allprojects {\n    repositories {\n        mavenLocal()\n    }\n}\n`,
);

// iOS: the ZebChat pod from the monorepo (`--package-name` already set the bundle id).
patch('ios/Podfile', (text) =>
  text.replace(
    `target '${APP_NAME}' do\n`,
    `target '${APP_NAME}' do\n  pod 'ZebChat', :path => '../../../ios'\n`,
  ),
);

console.log(
  `Done. Android: npm run android. iOS: cd ios && bundle install && bundle exec pod install.`,
);
