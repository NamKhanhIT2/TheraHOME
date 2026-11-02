const { withAndroidManifest, withMainActivity } = require('expo/config-plugins');

/**
 * Turns on picture-in-picture, so a call stays on screen after the user
 * leaves the app.
 *
 * Three things are needed and none can be done from JavaScript:
 *
 * 1. `android:supportsPictureInPicture` on MainActivity. Without it
 *    `enterPictureInPictureMode()` throws IllegalStateException, which is
 *    the whole feature failing at the last step.
 * 2. Two Activity callbacks. `onUserLeaveHint()` is the only place Android
 *    8–11 will accept a request to enter PiP from — from `onPause` it is
 *    ignored — and `onPictureInPictureModeChanged()` is how JavaScript
 *    learns it is now a small window and should draw the small view.
 * 3. A line inside React Native's OWN `invokeDefaultOnBackPressed`, which
 *    is how Back leaves the app. Back never reaches `onUserLeaveHint`:
 *    React Native answers it with `moveTaskToBack`, documented not to call
 *    that callback. So this method is EDITED rather than added — overriding
 *    it twice would not compile.
 *
 * All of it calls into `ai.therahome.callwindow.CallWindow`, which decides
 * whether a call is actually running; see that file for why Home takes a
 * different path on Android 12 and up and Back takes the same one
 * everywhere.
 *
 * Must be a config plugin, same reason as withCallkeepLabel: `expo
 * prebuild` regenerates android/ from scratch and would discard a hand edit
 * on the next native config change.
 */

const MARKER = '// @therahome-pip';

const OVERRIDES = `
  ${MARKER} — injected by plugins/withAndroidPictureInPicture.js
  // Home or Recents during a call. CallWindow ignores this on Android 12+,
  // where setAutoEnterEnabled has already done it, and done it better: no
  // visible frame of the full-screen app on the way out.
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    ai.therahome.callwindow.CallWindow.onUserLeaving(this)
  }

  // The app is now a 1-inch window, or is not any more. JavaScript draws a
  // different thing in each case, so it has to be told.
  // minSdk here is 24; the two-argument form of this callback arrived in
  // 26. Annotated rather than guarded because a callback that does not
  // exist is simply never called — there is no runtime check to write.
  @android.annotation.TargetApi(android.os.Build.VERSION_CODES.O)
  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: android.content.res.Configuration,
  ) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    ai.therahome.callwindow.CallWindow.onModeChanged(isInPictureInPictureMode)
  }
`;

const BACK_SIGNATURE = 'override fun invokeDefaultOnBackPressed() {';
const BACK_GUARD = `
      ${MARKER} Back is the way out of the app that onUserLeaveHint never
      // sees. Returning true means the call is now a floating window, and
      // the Back must stop here: backgrounding the task as well would
      // close the window it just opened.
      if (ai.therahome.callwindow.CallWindow.onBackLeaving(this)) return
`;

const withPipManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    const activities = application?.activity;
    if (!Array.isArray(activities)) {
      throw new Error(
        'withAndroidPictureInPicture: no <activity> array on <application>. Saw keys: ' +
        JSON.stringify(Object.keys(application || {})),
      );
    }
    const main = activities.find((activity) => activity.$?.['android:name'] === '.MainActivity');
    if (!main) {
      throw new Error('withAndroidPictureInPicture: .MainActivity not found in the manifest.');
    }
    main.$['android:supportsPictureInPicture'] = 'true';
    // PiP resizes the activity and changes its orientation. Every one of
    // these has to be handled by the activity itself, or Android recreates
    // it on the way into the window — which under React Native means
    // remounting the whole tree and losing the call mid-conversation. Expo
    // already lists all four; this adds any that ever go missing rather
    // than assuming they are there.
    const handled = (main.$['android:configChanges'] || '').split('|').filter(Boolean);
    const missing = ['orientation', 'screenSize', 'smallestScreenSize', 'screenLayout']
      .filter((change) => !handled.includes(change));
    if (missing.length) main.$['android:configChanges'] = [...handled, ...missing].join('|');
    return config;
  });

const withPipActivity = (config) =>
  withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error(
        'withAndroidPictureInPicture: MainActivity is ' + config.modResults.language +
        ', but the injected code is Kotlin.',
      );
    }
    let contents = config.modResults.contents;
    if (contents.includes(MARKER)) return config;

    // The two new overrides go inside the class, which is everything up to
    // the file's last closing brace.
    const end = contents.lastIndexOf('}');
    if (end === -1) {
      throw new Error('withAndroidPictureInPicture: MainActivity.kt has no closing brace to insert before.');
    }
    contents = contents.slice(0, end) + OVERRIDES + contents.slice(end);

    // The Back guard goes INSIDE React Native's existing override. If that
    // method is ever renamed upstream, fail here rather than ship a build
    // where Back silently drops the call out of sight.
    const back = contents.indexOf(BACK_SIGNATURE);
    if (back === -1) {
      throw new Error(
        'withAndroidPictureInPicture: no "' + BACK_SIGNATURE + '" in MainActivity.kt. ' +
        'React Native renamed it; the Back-leaves-the-app path needs rewiring.',
      );
    }
    const open = back + BACK_SIGNATURE.length;
    contents = contents.slice(0, open) + BACK_GUARD + contents.slice(open);

    config.modResults.contents = contents;
    return config;
  });

module.exports = (config) => withPipActivity(withPipManifest(config));
