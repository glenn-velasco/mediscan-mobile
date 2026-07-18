const { withAndroidStyles } = require('@expo/config-plugins');

module.exports = function withSplashWindowBackground(config) {
  return withAndroidStyles(config, (config) => {
    const appTheme = config.modResults.resources.style?.find((style) => style.$.name === 'AppTheme');
    if (appTheme && !appTheme.item.some((item) => item.$.name === 'android:windowBackground')) {
      appTheme.item.push({
        $: { name: 'android:windowBackground' },
        _: '@color/splashscreen_background',
      });
    }
    return config;
  });
};
