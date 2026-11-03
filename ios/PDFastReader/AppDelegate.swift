import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var initialLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    initialLaunchOptions = launchOptions


    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

// Xcode 27 / iOS 27 require the UIKit scene life cycle. Keep Expo's factory
// and subscriber callbacks while creating the window for the connected scene.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  private var appDelegate: AppDelegate? { UIApplication.shared.delegate as? AppDelegate }

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
    guard let scene = scene as? UIWindowScene, let app = appDelegate, let factory = app.reactNativeFactory else { return }
    let window = UIWindow(windowScene: scene)
    self.window = window
    app.window = window
    var launchOptions = app.initialLaunchOptions ?? [:]
    if let context = options.urlContexts.first { launchOptions[.url] = context.url }
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)
    window.makeKeyAndVisible()
    for context in options.urlContexts {
      _ = app.application(UIApplication.shared, open: context.url, options: [:])
    }
    for activity in options.userActivities {
      _ = app.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
  }

  func sceneDidBecomeActive(_ scene: UIScene) { appDelegate?.applicationDidBecomeActive(UIApplication.shared) }
  func sceneWillResignActive(_ scene: UIScene) { appDelegate?.applicationWillResignActive(UIApplication.shared) }
  func sceneDidEnterBackground(_ scene: UIScene) { appDelegate?.applicationDidEnterBackground(UIApplication.shared) }
  func sceneWillEnterForeground(_ scene: UIScene) { appDelegate?.applicationWillEnterForeground(UIApplication.shared) }

  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    for context in contexts { _ = appDelegate?.application(UIApplication.shared, open: context.url, options: [:]) }
  }
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
