import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';

import { UNREAD_EVENT, useZebChatUnread } from '../index';
import type { MockNativeModule } from './reactNativeMock';

jest.mock('react-native', () => jest.requireActual('./reactNativeMock'));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const rn = jest.requireMock<typeof import('./reactNativeMock')>('react-native');

const installNative = (): MockNativeModule => {
  const native = rn.createNativeModule();
  rn.NativeModules.RNZebChat = native;
  return native;
};

function Badge(): string {
  return `unread:${useZebChatUnread()}`;
}

const render = (element: ReactElement): ReactTestRenderer => {
  const rendered: ReactTestRenderer[] = [];
  act(() => {
    rendered.push(create(element));
  });
  const [renderer] = rendered;
  if (!renderer) throw new Error('not rendered');
  return renderer;
};

let mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    for (const renderer of mounted) renderer.unmount();
  });
  mounted = [];
});

describe('useZebChatUnread', () => {
  it('starts at 0, re-renders on native counts and ignores invalid events', () => {
    const native = installNative();
    const badge = render(<Badge />);
    mounted.push(badge);
    expect(badge.toJSON()).toBe('unread:0');
    expect(native.addListener).toHaveBeenCalledWith(UNREAD_EVENT);

    act(() => rn.emit(UNREAD_EVENT, { count: 2 }));
    expect(badge.toJSON()).toBe('unread:2');

    act(() => rn.emit(UNREAD_EVENT, { count: 1.5 }));
    expect(badge.toJSON()).toBe('unread:2');
  });

  it('subscribes once for many components and unsubscribes on the last unmount', () => {
    const native = installNative();
    const first = render(<Badge />);
    const second = render(<Badge />);
    expect(native.addListener).toHaveBeenCalledTimes(1);
    // A late subscriber starts from the last known count.
    expect(second.toJSON()).toBe(first.toJSON());

    act(() => rn.emit(UNREAD_EVENT, { count: 5 }));
    expect(first.toJSON()).toBe('unread:5');
    expect(second.toJSON()).toBe('unread:5');

    act(() => first.unmount());
    expect(native.removeListeners).not.toHaveBeenCalled();
    act(() => second.unmount());
    expect(native.removeListeners).toHaveBeenCalledWith(1);
    expect(rn.listenerCount(UNREAD_EVENT)).toBe(0);
  });
});
