import Foundation
import UserNotifications
import Combine

/**
 * Push Notification Service
 *
 * Manages Apple Push Notifications (APNs) for iOS.
 * Handles device token registration, notification handling, and preferences.
 *
 * Phase 4.5 Implementation
 */
@MainActor
class PushNotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationService()

    private let notificationCenter = UNUserNotificationCenter.current()

    // Published state
    @Published var deviceToken: String?
    @Published var isEnabled = false
    @Published var lastNotification: HelixPushNotification?
    @Published var notificationCount = 0

    override init() {
        super.init()
        setupNotificationHandling()
    }

    /**
     * Request user permission for push notifications.
     * Should be called during app initialization after authentication.
     */
    @MainActor
    func requestUserPermission() async -> Bool {
        do {
            let granted = try await notificationCenter.requestAuthorization(
                options: [.alert, .sound, .badge]
            )

            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
                return true
            } else {
                print("User denied push notification permission")
                return false
            }
        } catch {
            print("Failed to request notification permission: \(error)")
            return false
        }
    }

    /**
     * Setup notification handling for both foreground and background.
     */
    private func setupNotificationHandling() {
        notificationCenter.delegate = self

        // Create notification categories for actions (if needed)
        setupNotificationCategories()
    }

    /**
     * Setup notification categories and actions.
     * Allows custom actions on notifications (mark as read, delete, etc).
     */
    private func setupNotificationCategories() {
        // Message notification actions
        let replyAction = UNTextInputNotificationAction(
            identifier: "com.helix.chat.reply",
            title: "Reply",
            options: [],
            textInputButtonTitle: "Send",
            textInputPlaceholder: "Type a message..."
        )

        let openAction = UNNotificationAction(
            identifier: "com.helix.chat.open",
            title: "Open",
            options: .foreground
        )

        let muteAction = UNNotificationAction(
            identifier: "com.helix.chat.mute",
            title: "Mute",
            options: []
        )

        let messageCategory = UNNotificationCategory(
            identifier: "com.helix.chat.message",
            actions: [replyAction, openAction, muteAction],
            intentIdentifiers: [],
            options: []
        )

        notificationCenter.setNotificationCategories([messageCategory])
    }

    /**
     * Handle incoming remote notification when app is in foreground.
     */
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let userInfo = notification.request.content.userInfo

        // Parse push notification
        if let pushNotification = parsePushNotification(from: userInfo) {
            // Handle notification in foreground
            Task { @MainActor in
                await handleIncomingNotification(pushNotification)
            }
        }

        // Show notification even in foreground (iOS 10+)
        let options: UNNotificationPresentationOptions = [.banner, .sound, .badge]
        completionHandler(options)
    }

    /**
     * Handle notification action responses (user tapped notification or action button).
     */
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let actionIdentifier = response.actionIdentifier

        // Parse push notification
        if let pushNotification = parsePushNotification(from: userInfo) {
            // Handle action
            Task { @MainActor in
                await handleNotificationAction(actionIdentifier, for: pushNotification)
            }
        }

        completionHandler()
    }

    /**
     * Register device token with backend.
     * Called by AppDelegate when remote notification registration succeeds.
     */
    @MainActor
    func registerDeviceToken(_ tokenData: Data, with supabaseService: SupabaseService) async {
        let token = tokenData.map { String(format: "%02.2hhx", $0) }.joined()

        deviceToken = token
        print("APNs device token: \(token.prefix(20))...")

        // Register with backend (Phase 4.5)
        let success = await supabaseService.registerPushDevice(
            deviceToken: token,
            platform: "ios"
        )

        if success {
            print("Device token registered with backend")
            isEnabled = true
        } else {
            print("Failed to register device token, will retry")
        }
    }

    /**
     * Unregister device from push notifications (called on sign out).
     */
    @MainActor
    func unregisterDevice(with supabaseService: SupabaseService) async {
        do {
            let success = await supabaseService.unregisterPushDevice()
            if success {
                deviceToken = nil
                isEnabled = false
                print("Device unregistered from push notifications")
            }
        }
    }

    /**
     * Update user notification preferences.
     */
    @MainActor
    func updatePreferences(
        enablePush: Bool = true,
        enableSound: Bool = true,
        enableBadge: Bool = true,
        quietHoursStart: String? = nil,
        quietHoursEnd: String? = nil,
        with supabaseService: SupabaseService
    ) async {
        let success = await supabaseService.updateNotificationPreferences(
            enablePush: enablePush,
            enableSound: enableSound,
            enableBadge: enableBadge,
            quietHoursStart: quietHoursStart,
            quietHoursEnd: quietHoursEnd
        )

        if success {
            print("Notification preferences updated")
        } else {
            print("Failed to update notification preferences")
        }
    }

    // MARK: - Private Helpers

    /**
     * Parse incoming remote notification to HelixPushNotification.
     */
    private func parsePushNotification(from userInfo: [AnyHashable: Any]) -> HelixPushNotification? {
        guard let title = userInfo["title"] as? String,
              let body = userInfo["body"] as? String else {
            return nil
        }

        let conversationId = userInfo["conversation_id"] as? String
        let messageId = userInfo["message_id"] as? String
        let triggerType = userInfo["trigger_type"] as? String ?? "message"

        return HelixPushNotification(
            title: title,
            body: body,
            conversationId: conversationId,
            messageId: messageId,
            triggerType: triggerType,
            data: userInfo.filter { !["title", "body", "conversation_id", "message_id", "trigger_type"].contains($0.key as? String ?? "") }
                .mapValues { "\($0.value)" }
        )
    }

    /**
     * Handle incoming notification in foreground.
     */
    @MainActor
    private func handleIncomingNotification(_ notification: HelixPushNotification) async {
        print("Received push notification: \(notification.title)")

        // Update state
        lastNotification = notification
        notificationCount += 1

        // Could trigger app state changes, sounds, haptics, etc.
        // For now, just log and store
    }

    /**
     * Handle notification action (user interaction).
     */
    @MainActor
    private func handleNotificationAction(_ actionId: String, for notification: HelixPushNotification) async {
        switch actionId {
        case "com.helix.chat.open":
            // Navigate to conversation
            print("Opening notification: \(notification.conversationId ?? "unknown")")
            // This would be handled by app routing/state

        case "com.helix.chat.reply":
            // Handle reply action
            print("Reply to notification: \(notification.conversationId ?? "unknown")")

        case "com.helix.chat.mute":
            // Mute notifications from this conversation
            print("Muting notifications for: \(notification.conversationId ?? "unknown")")

        default:
            // Default action: open app
            if let conversationId = notification.conversationId {
                print("Navigating to conversation: \(conversationId)")
            }
        }
    }
}

/**
 * Extension to SupabaseService for push notification methods
 */
extension SupabaseService {
    /**
     * Register device for push notifications (iOS APNs).
     */
    @MainActor
    func registerPushDevice(
        deviceToken: String,
        platform: String = "ios"
    ) async -> Bool {
        do {
            guard let userId = currentUser?.id else {
                print("Not authenticated, cannot register push device")
                return false
            }

            let deviceData: [String: Any] = [
                "user_id": userId.uuidString,
                "device_id": UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString,
                "platform": platform,
                "device_token": deviceToken,
                "is_enabled": true,
                "metadata": [
                    "os_version": UIDevice.current.systemVersion,
                    "app_version": Bundle.main.appVersion,
                    "device_model": UIDevice.current.model,
                    "device_name": UIDevice.current.name
                ]
            ]

            // Call register_push_device edge function
            try await supabaseClient.rpc(
                "register_push_device",
                parameters: deviceData
            )

            print("Push device registered successfully")
            return true
        } catch {
            print("Failed to register push device: \(error)")
            return false
        }
    }

    /**
     * Unregister device from push notifications.
     */
    @MainActor
    func unregisterPushDevice() async -> Bool {
        do {
            guard let userId = currentUser?.id else {
                return true // Already logged out
            }

            let deviceData: [String: Any] = [
                "user_id": userId.uuidString,
                "device_id": UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
            ]

            // Call unregister_push_device edge function
            try await supabaseClient.rpc(
                "unregister_push_device",
                parameters: deviceData
            )

            print("Push device unregistered")
            return true
        } catch {
            print("Failed to unregister push device: \(error)")
            return false
        }
    }

    /**
     * Update notification preferences.
     */
    @MainActor
    func updateNotificationPreferences(
        enablePush: Bool = true,
        enableSound: Bool = true,
        enableBadge: Bool = true,
        quietHoursStart: String? = nil,
        quietHoursEnd: String? = nil
    ) async -> Bool {
        do {
            guard let userId = currentUser?.id else {
                return false
            }

            let prefs: [String: Any] = [
                "user_id": userId.uuidString,
                "enable_push": enablePush,
                "enable_sound": enableSound,
                "enable_badge": enableBadge,
                "quiet_hours_start": quietHoursStart as Any,
                "quiet_hours_end": quietHoursEnd as Any,
                "notify_on_types": ["message", "mention"],
                "max_notifications_per_hour": 20
            ]

            // Call update_notification_preferences edge function
            try await supabaseClient.rpc(
                "update_notification_preferences",
                parameters: prefs
            )

            print("Notification preferences updated")
            return true
        } catch {
            print("Failed to update notification preferences: \(error)")
            return false
        }
    }

    /**
     * Get current notification preferences.
     */
    @MainActor
    func getNotificationPreferences() async -> [String: Any]? {
        do {
            guard let userId = currentUser?.id else {
                return nil
            }

            let result: [String: Any] = try await supabaseClient
                .from("notification_preferences")
                .select()
                .eq("user_id", value: userId.uuidString)
                .single()
                .execute()
                .value

            return result
        } catch {
            print("Failed to get notification preferences: \(error)")
            return nil
        }
    }
}

/**
 * Extension for Bundle helpers
 */
extension Bundle {
    var appVersion: String {
        infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
    }
}

/**
 * Push Notification Data Model
 */
struct HelixPushNotification: Codable {
    let title: String
    let body: String
    let conversationId: String?
    let messageId: String?
    let triggerType: String?
    let data: [String: String]

    enum CodingKeys: String, CodingKey {
        case title
        case body
        case conversationId = "conversation_id"
        case messageId = "message_id"
        case triggerType = "trigger_type"
        case data
    }
}
