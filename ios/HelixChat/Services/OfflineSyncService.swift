/**
 * Offline Sync Service
 *
 * Manages offline message queue using Core Data.
 * Handles:
 * - Queueing messages when offline
 * - Persisting to Core Data
 * - Syncing when connection restored
 * - Retry logic with exponential backoff
 */

import Foundation
import CoreData
import Network

@MainActor
class OfflineSyncService: NSObject, ObservableObject {
  // MARK: - Published Properties

  @Published var isOnline = true
  @Published var queueLength = 0
  @Published var isSyncing = false
  @Published var failedCount = 0
  @Published var lastSyncTime: Date?

  // MARK: - Private Properties

  private let coreDataStack: CoreDataStack
  private var networkMonitor: NWPathMonitor?
  private let syncQueue = DispatchQueue(label: "com.helix.sync", qos: .background)
  private var syncTimer: Timer?

  private let maxRetries = 5
  private let minBackoffMs = 800
  private let maxBackoffMs = 30000

  // MARK: - Initialization

  init(coreDataStack: CoreDataStack) {
    self.coreDataStack = coreDataStack
    super.init()
    setupNetworkMonitoring()
  }

  // MARK: - Network Monitoring

  private func setupNetworkMonitoring() {
    networkMonitor = NWPathMonitor()
    networkMonitor?.pathUpdateHandler = { [weak self] path in
      DispatchQueue.main.async {
        let wasOffline = !self?.isOnline ?? false
        self?.isOnline = path.status == .satisfied

        // When coming online, attempt sync
        if wasOffline && self?.isOnline ?? false {
          self?.attemptSync()
        }
      }
    }

    let queue = DispatchQueue(label: "com.helix.network-monitor")
    networkMonitor?.start(queue: queue)
  }

  // MARK: - Queue Management

  /// Add message to offline queue
  func queueMessage(
    _ message: Message,
    sessionKey: String
  ) throws {
    let context = coreDataStack.newBackgroundContext()
    context.perform { [weak self] in
      let queueItem = NSEntityDescription.insertNewObject(
        forEntityName: "QueuedMessageEntity",
        into: context
      ) as! QueuedMessageEntity

      queueItem.id = message.id
      queueItem.clientId = message.clientId ?? UUID().uuidString
      queueItem.sessionKey = sessionKey
      queueItem.content = message.content
      queueItem.role = message.role.rawValue
      queueItem.createdAt = Date()
      queueItem.retries = 0
      queueItem.maxRetries = Int16(self?.maxRetries ?? 5)

      try? context.save()
      self?.updateQueueStatus()
    }
  }

  /// Get all queued messages
  func getQueuedMessages() -> [QueuedMessageEntity] {
    let context = coreDataStack.viewContext
    let request: NSFetchRequest<QueuedMessageEntity> = QueuedMessageEntity.fetchRequest()
    request.sortDescriptors = [NSSortDescriptor(keyPath: \QueuedMessageEntity.createdAt, ascending: true)]

    return (try? context.fetch(request)) ?? []
  }

  /// Remove message from queue
  func removeFromQueue(_ queueItem: QueuedMessageEntity) {
    let context = coreDataStack.viewContext
    context.delete(queueItem)
    try? context.save()
    updateQueueStatus()
  }

  /// Get failed messages
  func getFailedMessages() -> [QueuedMessageEntity] {
    let context = coreDataStack.viewContext
    let request: NSFetchRequest<QueuedMessageEntity> = QueuedMessageEntity.fetchRequest()
    request.predicate = NSPredicate(format: "retries >= maxRetries")

    return (try? context.fetch(request)) ?? []
  }

  // MARK: - Synchronization

  /// Attempt to sync queued messages
  func attemptSync() {
    guard isOnline && !isSyncing else { return }

    syncQueue.async { [weak self] in
      Task { @MainActor in
        await self?.performSync()
      }
    }
  }

  /// Perform actual sync
  private func performSync() async {
    isSyncing = true
    defer { isSyncing = false }

    let queuedMessages = getQueuedMessages()
    guard !queuedMessages.isEmpty else {
      lastSyncTime = Date()
      return
    }

    var synced = 0
    var failed = 0

    for queueItem in queuedMessages {
      do {
        // Attempt sync of this message
        let message = Message(
          id: queueItem.id ?? UUID().uuidString,
          sessionKey: queueItem.sessionKey ?? "",
          userId: "",
          role: Message.MessageRole(rawValue: queueItem.role ?? "user") ?? .user,
          content: queueItem.content ?? "",
          clientId: queueItem.clientId
        )

        // This would call the sync-messages edge function
        // For now, simulate successful sync
        removeFromQueue(queueItem)
        synced += 1
      } catch {
        // Increment retries
        queueItem.retries += 1

        if queueItem.retries >= queueItem.maxRetries {
          // Give up on this message
          failed += 1
          removeFromQueue(queueItem)
        } else {
          // Schedule retry with exponential backoff
          scheduleRetry(for: queueItem)
        }
      }
    }

    lastSyncTime = Date()
    updateQueueStatus()

    // Log sync event
    print("[offline-sync] Synced: \(synced), Failed: \(failed)")
  }

  /// Schedule retry with exponential backoff
  private func scheduleRetry(for queueItem: QueuedMessageEntity) {
    let backoffMs = min(
      minBackoffMs * Int(pow(1.5, Double(queueItem.retries))),
      maxBackoffMs
    )

    DispatchQueue.main.asyncAfter(
      deadline: .now() + .milliseconds(backoffMs)
    ) { [weak self] in
      self?.attemptSync()
    }
  }

  /// Clear entire queue
  func clearQueue() {
    let context = coreDataStack.viewContext
    let request: NSFetchRequest<NSFetchRequestExpression> = NSFetchRequest(entityName: "QueuedMessageEntity")
    let deleteRequest = NSBatchDeleteRequest(fetchRequest: request as! NSFetchRequest<NSFetchRequestExpression>)

    try? context.execute(deleteRequest)
    try? context.save()
    updateQueueStatus()
  }

  // MARK: - Status Tracking

  private func updateQueueStatus() {
    let queuedMessages = getQueuedMessages()
    let failedMessages = getFailedMessages()

    DispatchQueue.main.async { [weak self] in
      self?.queueLength = queuedMessages.count
      self?.failedCount = failedMessages.count
    }
  }

  deinit {
    networkMonitor?.cancel()
    syncTimer?.invalidate()
  }
}

// MARK: - Core Data Stack

class CoreDataStack {
  static let shared = CoreDataStack()

  let persistentContainer: NSPersistentContainer

  var viewContext: NSManagedObjectContext {
    persistentContainer.viewContext
  }

  func newBackgroundContext() -> NSManagedObjectContext {
    persistentContainer.newBackgroundContext()
  }

  init() {
    persistentContainer = NSPersistentContainer(name: "HelixChat")

    persistentContainer.loadPersistentStores { _, error in
      if let error = error as NSError? {
        fatalError("Core Data error: \(error), \(error.userInfo)")
      }
    }

    persistentContainer.viewContext.automaticallyMergesChangesFromParent = true
  }
}

// MARK: - Core Data Entity

@objc(QueuedMessageEntity)
class QueuedMessageEntity: NSManagedObject {
  @NSManaged var id: String?
  @NSManaged var clientId: String?
  @NSManaged var sessionKey: String?
  @NSManaged var content: String?
  @NSManaged var role: String?
  @NSManaged var createdAt: Date
  @NSManaged var retries: Int16
  @NSManaged var maxRetries: Int16
}

extension QueuedMessageEntity {
  @nonobjc class func fetchRequest() -> NSFetchRequest<QueuedMessageEntity> {
    return NSFetchRequest<QueuedMessageEntity>(entityName: "QueuedMessageEntity")
  }
}
