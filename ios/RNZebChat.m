// Exports the Swift RNZebChat module to React Native (legacy bridge; New Architecture interop).
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(RNZebChat, RCTEventEmitter)

RCT_EXTERN_METHOD(configure:(NSString *)siteKey locale:(nullable NSString *)locale sdk:(nullable NSString *)sdk)
RCT_EXTERN_METHOD(setUser:(NSDictionary *)user)
RCT_EXTERN_METHOD(logout)
RCT_EXTERN_METHOD(show)
RCT_EXTERN_METHOD(trackScreen:(NSString *)name)
RCT_EXTERN_METHOD(track:(NSString *)name properties:(nullable NSDictionary *)properties)
RCT_EXTERN_METHOD(setPushToken:(NSString *)token)
RCT_EXTERN_METHOD(handleNotificationTap:(NSDictionary *)data)
RCT_EXTERN_METHOD(showNotification:(NSDictionary *)data title:(nullable NSString *)title body:(nullable NSString *)body)
RCT_EXTERN_METHOD(getUnreadCount:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(refreshUnreadCount)
RCT_EXTERN_METHOD(setLocale:(NSString *)code)

@end
