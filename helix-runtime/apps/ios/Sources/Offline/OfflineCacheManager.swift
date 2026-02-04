import Foundation
import SQLite

/**
 * Offline Cache Manager for iOS
 *
 * Implements Phase 1A: Conservative read-only offline access
 * Caches recent emails, calendar events, and tasks for offline viewing
 * Automatically syncs when reconnected
 */

final class OfflineCacheManager {
    private var db: Connection?
    private let logger = Logger(subsystem: "ai.openclaw.ios", category: "offline")
    private let maxCachedEmails = 500
    private let maxCachedEvents = 365
    private let maxCachedTasks = 1000

    static let shared = OfflineCacheManager()

    init() {
        setupDatabase()
    }

    // MARK: - Database Setup

    private func setupDatabase() {
        do {
            let path = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true).first!
            let dbPath = "\(path)/helix_cache.sqlite3"

            db = try Connection(dbPath)
            db?.busyTimeout = 5.0

            try createTables()
            logger.info("Offline database initialized at: \(dbPath)")
        } catch {
            logger.error("Failed to initialize offline database: \(error.localizedDescription)")
        }
    }

    private func createTables() throws {
        guard let db = db else { return }

        // Cached emails table
        try db.run("""
            CREATE TABLE IF NOT EXISTS cached_emails (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              subject TEXT,
              from_address TEXT,
              body TEXT,
              received_at TEXT,
              is_read INTEGER,
              is_starred INTEGER,
              labels TEXT,
              thread_id TEXT,
              account_id TEXT,
              sync_meta TEXT,
              cached_at INTEGER,
              expires_at INTEGER
            )
        """)

        try db.run("""
            CREATE INDEX IF NOT EXISTS idx_cached_emails_user_received
            ON cached_emails(user_id, received_at DESC)
        """)

        try db.run("""
            CREATE INDEX IF NOT EXISTS idx_cached_emails_unread
            ON cached_emails(user_id, is_read, received_at DESC)
        """)

        // Cached calendar events table
        try db.run("""
            CREATE TABLE IF NOT EXISTS cached_calendar_events (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              title TEXT,
              description TEXT,
              start_time TEXT,
              end_time TEXT,
              calendar_id TEXT,
              attendees TEXT,
              location TEXT,
              is_all_day INTEGER,
              sync_meta TEXT,
              cached_at INTEGER,
              expires_at INTEGER
            )
        """)

        try db.run("""
            CREATE INDEX IF NOT EXISTS idx_cached_events_user_time
            ON cached_calendar_events(user_id, start_time DESC)
        """)

        // Cached tasks table
        try db.run("""
            CREATE TABLE IF NOT EXISTS cached_tasks (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              title TEXT,
              description TEXT,
              status TEXT,
              priority TEXT,
              due_date TEXT,
              board_id TEXT,
              tags TEXT,
              sync_meta TEXT,
              cached_at INTEGER,
              expires_at INTEGER
            )
        """)

        try db.run("""
            CREATE INDEX IF NOT EXISTS idx_cached_tasks_user_status
            ON cached_tasks(user_id, status)
        """)

        try db.run("""
            CREATE INDEX IF NOT EXISTS idx_cached_tasks_overdue
            ON cached_tasks(user_id, due_date)
        """)

        // Cache metadata table
        try db.run("""
            CREATE TABLE IF NOT EXISTS cache_metadata (
              key TEXT PRIMARY KEY,
              value TEXT,
              updated_at INTEGER
            )
        """)

        try db.run("""
            CREATE INDEX IF NOT EXISTS idx_cache_metadata_updated
            ON cache_metadata(updated_at DESC)
        """)

        logger.debug("Offline database tables created/verified")
    }

    // MARK: - Email Caching

    func cacheEmails(_ emails: [Email], userId: String) async throws {
        guard let db = db else {
            throw OfflineCacheError.databaseNotInitialized
        }

        let expiresAt = Int(Date().addingTimeInterval(7 * 24 * 3600).timeIntervalSince1970)

        for email in emails {
            try db.run("""
                INSERT OR REPLACE INTO cached_emails VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            """,
                email.id,
                userId,
                email.subject,
                email.from.email,
                email.body,
                email.receivedAt.iso8601String,
                email.isRead ? 1 : 0,
                email.isStarred ? 1 : 0,
                email.labels.joined(separator: ","),
                email.threadId,
                email.accountId,
                try JSONEncoder().encode(email.syncMeta).jsonString,
                Int(Date().timeIntervalSince1970),
                expiresAt
            )
        }

        // Enforce max cache size
        try enforceCacheLimit("cached_emails", max: maxCachedEmails, userId: userId)

        logger.debug("Cached \(emails.count) emails for user: \(userId)")
    }

    func getCachedEmails(userId: String, limit: Int = 50) async throws -> [CachedEmail] {
        guard let db = db else {
            throw OfflineCacheError.databaseNotInitialized
        }

        let query = """
            SELECT * FROM cached_emails
            WHERE user_id = ? AND expires_at > ?
            ORDER BY received_at DESC
            LIMIT ?
        """

        var result: [CachedEmail] = []

        for row in try db.prepare(query, userId, Int(Date().timeIntervalSince1970), limit) {
            result.append(CachedEmail(
                id: row[0] as! String,
                subject: row[2] as? String ?? "",
                from: row[3] as? String ?? "",
                body: row[4] as? String ?? "",
                receivedAt: row[5] as? String ?? "",
                isRead: (row[6] as? Int ?? 0) != 0,
                isStarred: (row[7] as? Int ?? 0) != 0
            ))
        }

        logger.debug("Retrieved \(result.count) cached emails")
        return result
    }

    func getCachedEmail(id: String) async throws -> CachedEmail? {
        guard let db = db else {
            throw OfflineCacheError.databaseNotInitialized
        }

        let query = "SELECT * FROM cached_emails WHERE id = ? AND expires_at > ?"

        for row in try db.prepare(query, id, Int(Date().timeIntervalSince1970)) {
            return CachedEmail(
                id: row[0] as! String,
                subject: row[2] as? String ?? "",
                from: row[3] as? String ?? "",
                body: row[4] as? String ?? "",
                receivedAt: row[5] as? String ?? "",
                isRead: (row[6] as? Int ?? 0) != 0,
                isStarred: (row[7] as? Int ?? 0) != 0
            )
        }

        return nil
    }

    // MARK: - Calendar Caching

    func cacheCalendarEvents(_ events: [CalendarEvent], userId: String) async throws {
        guard let db = db else {
            throw OfflineCacheError.databaseNotInitialized
        }

        let expiresAt = Int(Date().addingTimeInterval(30 * 24 * 3600).timeIntervalSince1970)

        for event in events {
            try db.run("""
                INSERT OR REPLACE INTO cached_calendar_events VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            """,
                event.id,
                userId,
                event.title,
                event.description,
                event.startTime.iso8601String,
                event.endTime.iso8601String,
                event.calendarId,
                event.attendees.joined(separator: ","),
                event.location,
                event.isAllDay ? 1 : 0,
                try JSONEncoder().encode(event.syncMeta).jsonString,
                Int(Date().timeIntervalSince1970),
                expiresAt
            )
        }

        try enforceCacheLimit("cached_calendar_events", max: maxCachedEvents, userId: userId)
        logger.debug("Cached \(events.count) calendar events for user: \(userId)")
    }

    func getCachedCalendarEvents(userId: String, startDate: Date, endDate: Date) async throws -> [CachedCalendarEvent] {
        guard let db = db else {
            throw OfflineCacheError.databaseNotInitialized
        }

        let query = """
            SELECT * FROM cached_calendar_events
            WHERE user_id = ?
              AND expires_at > ?
              AND start_time >= ?
              AND start_time <= ?
            ORDER BY start_time ASC
        """

        var result: [CachedCalendarEvent] = []

        for row in try db.prepare(
            query,
            userId,
            Int(Date().timeIntervalSince1970),
            startDate.iso8601String,
            endDate.iso8601String
        ) {
            result.append(CachedCalendarEvent(
                id: row[0] as! String,
                title: row[2] as? String ?? "",
                description: row[3] as? String ?? "",
                startTime: row[4] as? String ?? "",
                endTime: row[5] as? String ?? "",
                location: row[8] as? String ?? ""
            ))
        }

        logger.debug("Retrieved \(result.count) cached calendar events")
        return result
    }

    // MARK: - Task Caching

    func cacheTasks(_ tasks: [Task], userId: String) async throws {
        guard let db = db else {
            throw OfflineCacheError.databaseNotInitialized
        }

        let expiresAt = Int(Date().addingTimeInterval(14 * 24 * 3600).timeIntervalSince1970)

        for task in tasks {
            try db.run("""
                INSERT OR REPLACE INTO cached_tasks VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            """,
                task.id,
                userId,
                task.title,
                task.description,
                task.status,
                task.priority,
                task.dueDate?.iso8601String,
                task.boardId,
                task.tags.joined(separator: ","),
                try JSONEncoder().encode(task.syncMeta).jsonString,
                Int(Date().timeIntervalSince1970),
                expiresAt
            )
        }

        try enforceCacheLimit("cached_tasks", max: maxCachedTasks, userId: userId)
        logger.debug("Cached \(tasks.count) tasks for user: \(userId)")
    }

    func getCachedTasks(userId: String, status: String? = nil) async throws -> [CachedTask] {
        guard let db = db else {
            throw OfflineCacheError.databaseNotInitialized
        }

        let whereClause = status.map { " AND status = '\($0)'" } ?? ""
        let query = """
            SELECT * FROM cached_tasks
            WHERE user_id = ? AND expires_at > ?\(whereClause)
            ORDER BY due_date ASC
        """

        var result: [CachedTask] = []

        for row in try db.prepare(query, userId, Int(Date().timeIntervalSince1970)) {
            result.append(CachedTask(
                id: row[0] as! String,
                title: row[2] as? String ?? "",
                status: row[4] as? String ?? "todo",
                priority: row[5] as? String ?? "medium",
                dueDate: row[6] as? String
            ))
        }

        logger.debug("Retrieved \(result.count) cached tasks")
        return result
    }

    // MARK: - Cache Management

    private func enforceCacheLimit(_ table: String, max: Int, userId: String) throws {
        guard let db = db else { return }

        let countQuery = "SELECT COUNT(*) FROM \(table) WHERE user_id = ?"

        for row in try db.prepare(countQuery, userId) {
            let count = row[0] as? Int ?? 0

            if count > max {
                let deleteQuery = """
                    DELETE FROM \(table) WHERE id IN (
                      SELECT id FROM \(table)
                      WHERE user_id = ?
                      ORDER BY cached_at ASC
                      LIMIT ?
                    )
                """
                try db.run(deleteQuery, userId, count - max)
                logger.debug("Enforced cache limit on \(table): deleted \(count - max) old entries")
            }
        }
    }

    func clearExpiredEntries() async throws {
        guard let db = db else { return }

        let now = Int(Date().timeIntervalSince1970)

        try db.run("DELETE FROM cached_emails WHERE expires_at <= ?", now)
        try db.run("DELETE FROM cached_calendar_events WHERE expires_at <= ?", now)
        try db.run("DELETE FROM cached_tasks WHERE expires_at <= ?", now)

        logger.info("Cleared expired cache entries")
    }

    func clearAllCache() async throws {
        guard let db = db else { return }

        try db.run("DELETE FROM cached_emails")
        try db.run("DELETE FROM cached_calendar_events")
        try db.run("DELETE FROM cached_tasks")
        try db.run("DELETE FROM cache_metadata")

        logger.info("Cleared all offline cache")
    }

    func getCacheSize() async throws -> Int {
        guard let db = db else { return 0 }

        var totalSize = 0

        for row in try db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()") {
            totalSize = row[0] as? Int ?? 0
        }

        return totalSize
    }
}

// MARK: - Supporting Types

struct CachedEmail {
    let id: String
    let subject: String
    let from: String
    let body: String
    let receivedAt: String
    let isRead: Bool
    let isStarred: Bool
}

struct CachedCalendarEvent {
    let id: String
    let title: String
    let description: String
    let startTime: String
    let endTime: String
    let location: String
}

struct CachedTask {
    let id: String
    let title: String
    let status: String
    let priority: String
    let dueDate: String?
}

// MARK: - Error Handling

enum OfflineCacheError: LocalizedError {
    case databaseNotInitialized
    case failedToEncode
    case failedToDecode
    case entryNotFound

    var errorDescription: String? {
        switch self {
        case .databaseNotInitialized:
            return "Offline cache database not initialized"
        case .failedToEncode:
            return "Failed to encode data for caching"
        case .failedToDecode:
            return "Failed to decode cached data"
        case .entryNotFound:
            return "Cache entry not found"
        }
    }
}

// MARK: - Extensions

extension Data {
    var jsonString: String {
        String(data: self, encoding: .utf8) ?? "{}"
    }
}

extension Date {
    var iso8601String: String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: self)
    }
}
