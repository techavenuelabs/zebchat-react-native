/** Autolinking for @zebchat/react-native (the Kotlin module and package share one file). */
module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.zebchat.reactnative.ZebChatPackage;',
        packageInstance: 'new ZebChatPackage()',
      },
      ios: {},
    },
  },
};
