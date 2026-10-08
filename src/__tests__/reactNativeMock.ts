/** A minimal `react-native` stand-in for the unit tests: native module, event emitter, Platform. */
import { jest } from '@jest/globals';

type Handler = (event: unknown) => void;

interface EmitterModule {
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
}

export const Platform: { OS: 'ios' | 'android' } = { OS: 'ios' };

export const NativeModules: Record<string, unknown> = {};

const handlers = new Map<string, Set<Handler>>();

export class NativeEventEmitter {
  private readonly module: EmitterModule;

  constructor(module: EmitterModule) {
    this.module = module;
  }

  addListener(eventName: string, handler: Handler): { remove(): void } {
    const set = handlers.get(eventName) ?? new Set<Handler>();
    handlers.set(eventName, set);
    set.add(handler);
    this.module.addListener?.(eventName);
    return {
      remove: () => {
        if (set.delete(handler)) this.module.removeListeners?.(1);
      },
    };
  }
}

/** Deliver a native event to every JS handler. */
export const emit = (eventName: string, payload: unknown): void => {
  for (const handler of Array.from(handlers.get(eventName) ?? [])) handler(payload);
};

export const listenerCount = (eventName: string): number => handlers.get(eventName)?.size ?? 0;

export const createNativeModule = () => ({
  configure: jest.fn<(siteKey: string, locale: string | null, sdk: string) => void>(),
  setUser: jest.fn<(user: Record<string, string>) => void>(),
  logout: jest.fn<() => void>(),
  show: jest.fn<() => void>(),
  trackScreen: jest.fn<(name: string) => void>(),
  track: jest.fn<(name: string, properties: Record<string, string> | null) => void>(),
  setPushToken: jest.fn<(token: string) => void>(),
  handleNotificationTap: jest.fn<(data: Record<string, string>) => void>(),
  showNotification:
    jest.fn<(data: Record<string, string>, title: string | null, body: string | null) => void>(),
  setLocale: jest.fn<(code: string) => void>(),
  getUnreadCount: jest.fn<() => Promise<number>>(() => Promise.resolve(0)),
  refreshUnreadCount: jest.fn<() => void>(),
  addListener: jest.fn<(eventName: string) => void>(),
  removeListeners: jest.fn<(count: number) => void>(),
});

export type MockNativeModule = ReturnType<typeof createNativeModule>;
