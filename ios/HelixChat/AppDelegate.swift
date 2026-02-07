import UIKit

/**
 * App Delegate
 *
 * Handles iOS app lifecycle and remote notification registration.
 * Registers device for APNs push notifications and handles token updates.
 */
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Setup remote notification handling
        setupRemoteNotifications(application)

        return true
    }

    /**
     * Setup remote notification handling.
     * Requests push notification permission and registers device.
     */
    private func setupRemoteNotifications(_ application: UIApplication) {
        // Register for remote notifications
        // This triggers didRegisterForRemoteNotificationsWithDeviceToken when successful
        application.registerForRemoteNotifications()

        print("Remote notification registration initiated")
    }

    /**
     * Called when Apple successfully registers device for remote notifications.
     * The deviceToken here is the APNs device token needed for push notifications.
     */
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        // Convert token data to string format
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()

        print("APNs device token received: \(token.prefix(20))...")

        // Register device token with push notification service
        Task { @MainActor in
            await PushNotificationService.shared.registerDeviceToken(
                deviceToken,
                with: SupabaseService()
            )
        }
    }

    /**
     * Called when remote notification registration fails.
     */
    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("Failed to register for remote notifications: \(error)")
    }

    /**
     * Called when app receives a remote notification while in foreground.
     */
    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        print("Received remote notification in foreground")

        // Parse and handle notification
        Task { @MainActor in
            // The UNUserNotificationCenterDelegate handles this in iOS 10+
            // This is here for backward compatibility
            completionHandler(.noData)
        }
    }
}

/**
 * Scenic view modifier to setup AppDelegate
 */
extension UIApplication {
    /**
     * Get the active window scene delegate.
     * Used to access app state and handle notifications.
     */
    static var keyWindowScene: UIWindowScene? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first
    }
}
