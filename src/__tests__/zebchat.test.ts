import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => jest.requireActual('./reactNativeMock'));

type Api = typeof import('../index');
type ReactNativeMock = typeof import('./reactNativeMock');

interface Loaded {
  api: Api;
  rn: ReactNativeMock;
  native: ReturnType<ReactNativeMock['createNativeModule']>;
}

/** A fresh copy of the module (its unread state and "not linked" warning are module-level). */
const load = async (os: 'ios' | 'android' = 'ios', linked = true): Promise<Loaded> => {
  let loaded: Loaded | undefined;
  await jest.isolateModulesAsync(async () => {
    const rn = jest.requireMock<ReactNativeMock>('react-native');
    const native = rn.createNativeModule();
    rn.Platform.OS = os;
    if (linked) rn.NativeModules.RNZebChat = native;
    else delete rn.NativeModules.RNZebChat;
    const api = await import('../index');
    loaded = { api, rn, native };
  });
  if (!loaded) throw new Error('module did not load');
  return loaded;
};

const pushData = { zebchat: '1', conversationId: 'conv_1', siteKey: 'zc_test' };

let consoleError: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('ZebChat calls forward to the native module', () => {
  it('configure passes the site key, locale (null when not set) and sdk name', async () => {
    const { api, native } = await load();
    api.ZebChat.configure({ siteKey: ' zc_abc ', locale: 'fr' });
    api.ZebChat.configure({ siteKey: 'zc_abc' });
    expect(api.SDK_NAME).toBe('react-native/1.0.0');
    expect(native.configure.mock.calls).toEqual([
      ['zc_abc', 'fr', 'react-native/1.0.0'],
      ['zc_abc', null, 'react-native/1.0.0'],
    ]);
  });

  it('the sdk version matches package.json', async () => {
    const { api } = await load();
    const pkg = jest.requireActual<unknown>('../../package.json');
    expect(pkg).toMatchObject({ version: api.VERSION });
  });

  it('configure without a site key logs and does not call native', async () => {
    const { api, native } = await load();
    api.ZebChat.configure({ siteKey: '  ' });
    expect(native.configure).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('ZebChat.configure: siteKey is required.');
  });

  it('setUser sends only the fields that were set', async () => {
    const { api, native } = await load();
    api.ZebChat.setUser({
      id: '42',
      email: 'ana@example.com',
      name: ' Ana ',
      phone: '',
      hash: 'h',
    });
    expect(native.setUser).toHaveBeenCalledWith({
      id: '42',
      email: 'ana@example.com',
      name: 'Ana',
      hash: 'h',
    });
  });

  it('logout, show, trackScreen, setPushToken and setLocale forward', async () => {
    const { api, native } = await load();
    api.ZebChat.logout();
    api.ZebChat.show();
    api.ZebChat.trackScreen(' Checkout ');
    api.ZebChat.setPushToken('fcm-token');
    api.ZebChat.setLocale('de');
    expect(native.logout).toHaveBeenCalledTimes(1);
    expect(native.show).toHaveBeenCalledTimes(1);
    expect(native.trackScreen).toHaveBeenCalledWith('Checkout');
    expect(native.setPushToken).toHaveBeenCalledWith('fcm-token');
    expect(native.setLocale).toHaveBeenCalledWith('de');
  });

  it('track forwards the event name and string properties', async () => {
    const { api, native } = await load();
    api.ZebChat.track(' added_to_cart ', { sku: 'A1' });
    api.ZebChat.track('signed_up');
    api.ZebChat.track('odd', { n: 1 } as unknown as Record<string, string>);
    api.ZebChat.track(' ');
    expect(native.track.mock.calls).toEqual([
      ['added_to_cart', { sku: 'A1' }],
      ['signed_up', null],
      ['odd', null],
    ]);
  });

  it('ignores empty screen names, tokens and locales', async () => {
    const { api, native } = await load();
    api.ZebChat.trackScreen('');
    api.ZebChat.setPushToken(' ');
    api.ZebChat.setLocale('');
    expect(native.trackScreen).not.toHaveBeenCalled();
    expect(native.setPushToken).not.toHaveBeenCalled();
    expect(native.setLocale).not.toHaveBeenCalled();
  });

  it('handleNotificationTap forwards ZebChat pushes with string values only', async () => {
    const { api, native } = await load();
    expect(api.ZebChat.handleNotificationTap({ ...pushData, nested: { a: 1 } })).toBe(true);
    expect(native.handleNotificationTap).toHaveBeenCalledWith(pushData);
    expect(api.ZebChat.handleNotificationTap({ other: 'app' })).toBe(false);
    expect(api.ZebChat.handleNotificationTap(undefined)).toBe(false);
    expect(native.handleNotificationTap).toHaveBeenCalledTimes(1);
  });

  it('showNotification forwards ZebChat pushes (true on Android, false on iOS)', async () => {
    const android = await load('android');
    expect(android.api.ZebChat.showNotification(pushData)).toBe(true);
    expect(android.native.showNotification).toHaveBeenCalledWith(pushData, null, null);
    expect(android.api.ZebChat.showNotification({ zebchat: '0' })).toBe(false);
    expect(android.native.showNotification).toHaveBeenCalledTimes(1);

    const ios = await load('ios');
    expect(ios.api.ZebChat.showNotification(pushData)).toBe(false);
    expect(ios.native.showNotification).toHaveBeenCalledWith(pushData, null, null);
  });

  it('showNotification passes the title and body overrides', async () => {
    const { api, native } = await load('android');
    api.ZebChat.showNotification(pushData, { title: 'Support', body: ' ' });
    expect(native.showNotification).toHaveBeenCalledWith(pushData, 'Support', null);
  });

  it('fetchUnreadCount reads the native count and rejects bad values', async () => {
    const { api, native } = await load();
    native.getUnreadCount.mockResolvedValueOnce(5);
    await expect(api.ZebChat.fetchUnreadCount()).resolves.toBe(5);
    native.getUnreadCount.mockResolvedValueOnce(-2);
    await expect(api.ZebChat.fetchUnreadCount()).resolves.toBe(0);
    const unlinked = await load('ios', false);
    await expect(unlinked.api.ZebChat.fetchUnreadCount()).resolves.toBe(0);
  });

  it('refreshUnreadCount forwards', async () => {
    const { api, native } = await load();
    api.ZebChat.refreshUnreadCount();
    expect(native.refreshUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('is a logged no-op when the native module is not linked', async () => {
    const { api } = await load('android', false);
    expect(() => {
      api.ZebChat.configure({ siteKey: 'zc_abc' });
      api.ZebChat.show();
      api.ZebChat.addUnreadListener(() => undefined).remove();
    }).not.toThrow();
    expect(api.ZebChat.handleNotificationTap(pushData)).toBe(true);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0]?.[0])).toContain('is not linked');
  });

  it('exposes the same API as the default export', async () => {
    const { api } = await load();
    expect(api.default).toBe(api.ZebChat);
  });
});

describe('isZebChatNotification', () => {
  it('matches data.zebchat === "1" only', async () => {
    const { api } = await load();
    expect(api.isZebChatNotification(pushData)).toBe(true);
    expect(api.ZebChat.isZebChatNotification({ zebchat: '1' })).toBe(true);
    for (const data of [
      { zebchat: 1 },
      { zebchat: 'true' },
      { zebchat: '0' },
      {},
      null,
      undefined,
      'zebchat',
      ['1'],
    ]) {
      expect(api.isZebChatNotification(data)).toBe(false);
    }
  });
});

describe('addUnreadListener', () => {
  it('shares one native subscription and delivers valid counts', async () => {
    const { api, rn, native } = await load();
    const first = jest.fn<(count: number) => void>();
    const second = jest.fn<(count: number) => void>();
    const a = api.ZebChat.addUnreadListener(first);
    const b = api.ZebChat.addUnreadListener(second);
    expect(native.addListener).toHaveBeenCalledTimes(1);
    expect(native.addListener).toHaveBeenCalledWith(api.UNREAD_EVENT);

    rn.emit(api.UNREAD_EVENT, { count: 3 });
    rn.emit(api.UNREAD_EVENT, { count: -1 });
    rn.emit(api.UNREAD_EVENT, { count: '4' });
    rn.emit(api.UNREAD_EVENT, null);
    expect(first.mock.calls).toEqual([[3]]);
    expect(second.mock.calls).toEqual([[3]]);
    expect(api.ZebChat.getUnreadCount()).toBe(3);

    a.remove();
    a.remove();
    rn.emit(api.UNREAD_EVENT, { count: 0 });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenLastCalledWith(0);
    expect(native.removeListeners).not.toHaveBeenCalled();

    b.remove();
    expect(native.removeListeners).toHaveBeenCalledWith(1);
    expect(rn.listenerCount(api.UNREAD_EVENT)).toBe(0);

    api.ZebChat.addUnreadListener(first);
    expect(native.addListener).toHaveBeenCalledTimes(2);
  });
});
