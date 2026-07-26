const { withMainActivity } = require('@expo/config-plugins');

// React Native New Architecture bug: ReactActivityDelegate.onUserLeaveHint() calls
// Objects.requireNonNull(mReactDelegate) and NPEs if it fires before the delegate finishes
// initializing (e.g. a system permission dialog steals focus right after launch). This wraps
// the call so a premature focus loss doesn't crash the app.
const OVERRIDE = `
  override fun onUserLeaveHint() {
    try {
      super.onUserLeaveHint()
    } catch (e: NullPointerException) {
      // Known upstream RN bug — see withUserLeaveHintFix.js for details. Safe to ignore.
    }
  }
`;

module.exports = function withUserLeaveHintFix(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withUserLeaveHintFix only supports a Kotlin MainActivity');
    }
    if (!config.modResults.contents.includes('onUserLeaveHint')) {
      config.modResults.contents = config.modResults.contents.replace(
        /override fun getMainComponentName\(\): String = "main"/,
        (match) => `${match}\n${OVERRIDE}`,
      );
    }
    return config;
  });
};
