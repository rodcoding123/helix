package com.helix.offline

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow
import java.util.*

/**
 * Offline Database for Android
 *
 * Implements Phase 1A: Conservative read-only offline access using Room ORM
 * Caches recent emails, calendar events, and tasks for offline viewing
 */

// MARK: - Entities

@Entity(
    tableName = "cached_emails",
    indices = [
        Index(value = ["userId", "receivedAt"], name = "idx_cached_emails_user_received"),
        Index(value = ["userId", "isRead", "receivedAt"], name = "idx_cached_emails_unread"),
    ]
)
@Serializable
data class CachedEmail(
    @PrimaryKey
    val id: String,
    val userId: String,
    val subject: String,
    val fromAddress: String,
    val body: String,
    val receivedAt: String,
    val isRead: Boolean,
    val isStarred: Boolean,
    val labels: String = "",
    val threadId: String? = null,
    val accountId: String? = null,
    val syncMeta: String = "{}",
    val cachedAt: Long = System.currentTimeMillis(),
    val expiresAt: Long = System.currentTimeMillis() + (7 * 24 * 60 * 60 * 1000)
)

@Entity(
    tableName = "cached_calendar_events",
    indices = [
        Index(value = ["userId", "startTime"], name = "idx_cached_events_user_time"),
    ]
)
@Serializable
data class CachedCalendarEvent(
    @PrimaryKey
    val id: String,
    val userId: String,
    val title: String,
    val description: String,
    val startTime: String,
    val endTime: String,
    val calendarId: String,
    val attendees: String = "",
    val location: String = "",
    val isAllDay: Boolean = false,
    val syncMeta: String = "{}",
    val cachedAt: Long = System.currentTimeMillis(),
    val expiresAt: Long = System.currentTimeMillis() + (30 * 24 * 60 * 60 * 1000)
)

@Entity(
    tableName = "cached_tasks",
    indices = [
        Index(value = ["userId", "status"], name = "idx_cached_tasks_user_status"),
        Index(value = ["userId", "dueDate"], name = "idx_cached_tasks_overdue"),
    ]
)
@Serializable
data class CachedTask(
    @PrimaryKey
    val id: String,
    val userId: String,
    val title: String,
    val description: String,
    val status: String,
    val priority: String,
    val dueDate: String? = null,
    val boardId: String,
    val tags: String = "",
    val syncMeta: String = "{}",
    val cachedAt: Long = System.currentTimeMillis(),
    val expiresAt: Long = System.currentTimeMillis() + (14 * 24 * 60 * 60 * 1000)
)

@Entity(tableName = "cache_metadata")
data class CacheMetadata(
    @PrimaryKey
    val key: String,
    val value: String,
    val updatedAt: Long = System.currentTimeMillis()
)

// MARK: - DAOs

@Dao
interface EmailDao {
    @Query("SELECT * FROM cached_emails WHERE userId = ? AND expiresAt > ? ORDER BY receivedAt DESC LIMIT ?")
    suspend fun getCachedEmails(userId: String, now: Long, limit: Int = 50): List<CachedEmail>

    @Query("SELECT * FROM cached_emails WHERE id = ? AND expiresAt > ?")
    suspend fun getCachedEmail(id: String, now: Long): CachedEmail?

    @Query("SELECT * FROM cached_emails WHERE userId = ? AND isRead = 0 AND expiresAt > ? ORDER BY receivedAt DESC LIMIT ?")
    suspend fun getUnreadEmails(userId: String, now: Long, limit: Int = 50): List<CachedEmail>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveEmails(emails: List<CachedEmail>)

    @Delete
    suspend fun deleteEmails(emails: List<CachedEmail>)

    @Query("DELETE FROM cached_emails WHERE expiresAt <= ?")
    suspend fun clearExpired(now: Long)

    @Query("DELETE FROM cached_emails WHERE userId = ?")
    suspend fun clearUserEmails(userId: String)

    @Query("SELECT COUNT(*) FROM cached_emails WHERE userId = ?")
    suspend fun getEmailCount(userId: String): Int
}

@Dao
interface CalendarEventDao {
    @Query("""
        SELECT * FROM cached_calendar_events
        WHERE userId = ?
        AND expiresAt > ?
        AND startTime >= ?
        AND startTime <= ?
        ORDER BY startTime ASC
    """)
    suspend fun getEventsInRange(
        userId: String,
        now: Long,
        startDate: String,
        endDate: String
    ): List<CachedCalendarEvent>

    @Query("SELECT * FROM cached_calendar_events WHERE id = ? AND expiresAt > ?")
    suspend fun getEvent(id: String, now: Long): CachedCalendarEvent?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveEvents(events: List<CachedCalendarEvent>)

    @Delete
    suspend fun deleteEvents(events: List<CachedCalendarEvent>)

    @Query("DELETE FROM cached_calendar_events WHERE expiresAt <= ?")
    suspend fun clearExpired(now: Long)

    @Query("DELETE FROM cached_calendar_events WHERE userId = ?")
    suspend fun clearUserEvents(userId: String)

    @Query("SELECT COUNT(*) FROM cached_calendar_events WHERE userId = ?")
    suspend fun getEventCount(userId: String): Int
}

@Dao
interface TaskDao {
    @Query("""
        SELECT * FROM cached_tasks
        WHERE userId = ?
        AND expiresAt > ?
        ORDER BY dueDate ASC
    """)
    suspend fun getTasks(userId: String, now: Long): List<CachedTask>

    @Query("""
        SELECT * FROM cached_tasks
        WHERE userId = ?
        AND status = ?
        AND expiresAt > ?
        ORDER BY dueDate ASC
    """)
    suspend fun getTasksByStatus(userId: String, status: String, now: Long): List<CachedTask>

    @Query("""
        SELECT * FROM cached_tasks
        WHERE userId = ?
        AND dueDate < ?
        AND status != 'done'
        AND expiresAt > ?
    """)
    suspend fun getOverdueTasks(userId: String, now: String, expiresAt: Long): List<CachedTask>

    @Query("SELECT * FROM cached_tasks WHERE id = ? AND expiresAt > ?")
    suspend fun getTask(id: String, now: Long): CachedTask?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveTasks(tasks: List<CachedTask>)

    @Delete
    suspend fun deleteTasks(tasks: List<CachedTask>)

    @Query("DELETE FROM cached_tasks WHERE expiresAt <= ?")
    suspend fun clearExpired(now: Long)

    @Query("DELETE FROM cached_tasks WHERE userId = ?")
    suspend fun clearUserTasks(userId: String)

    @Query("SELECT COUNT(*) FROM cached_tasks WHERE userId = ?")
    suspend fun getTaskCount(userId: String): Int
}

@Dao
interface MetadataDao {
    @Query("SELECT * FROM cache_metadata WHERE key = ?")
    suspend fun get(key: String): CacheMetadata?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun set(metadata: CacheMetadata)

    @Query("DELETE FROM cache_metadata WHERE key = ?")
    suspend fun delete(key: String)
}

// MARK: - Database

@Database(
    entities = [
        CachedEmail::class,
        CachedCalendarEvent::class,
        CachedTask::class,
        CacheMetadata::class
    ],
    version = 1,
    exportSchema = false
)
abstract class OfflineDatabase : RoomDatabase() {
    abstract fun emailDao(): EmailDao
    abstract fun calendarDao(): CalendarEventDao
    abstract fun taskDao(): TaskDao
    abstract fun metadataDao(): MetadataDao

    companion object {
        @Volatile
        private var instance: OfflineDatabase? = null

        fun getInstance(context: Context): OfflineDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    OfflineDatabase::class.java,
                    "helix_offline.db"
                )
                    .build()
                    .also { instance = it }
            }
        }
    }
}

// MARK: - Repository

class OfflineCacheRepository(context: Context) {
    private val db = OfflineDatabase.getInstance(context)
    private val emailDao = db.emailDao()
    private val calendarDao = db.calendarDao()
    private val taskDao = db.taskDao()
    private val metadataDao = db.metadataDao()

    private val now: Long
        get() = System.currentTimeMillis()

    // MARK: - Email Cache

    suspend fun cacheEmails(emails: List<CachedEmail>, userId: String) {
        emailDao.saveEmails(emails)
        enforceCacheLimit("emails", maxEmails, userId)
    }

    suspend fun getCachedEmails(userId: String, limit: Int = 50): List<CachedEmail> {
        return emailDao.getCachedEmails(userId, now, limit)
    }

    suspend fun getCachedEmail(id: String): CachedEmail? {
        return emailDao.getCachedEmail(id, now)
    }

    suspend fun getUnreadEmails(userId: String): List<CachedEmail> {
        return emailDao.getUnreadEmails(userId, now, 50)
    }

    // MARK: - Calendar Cache

    suspend fun cacheCalendarEvents(
        events: List<CachedCalendarEvent>,
        userId: String
    ) {
        calendarDao.saveEvents(events)
        enforceCacheLimit("events", maxEvents, userId)
    }

    suspend fun getCalendarEvents(
        userId: String,
        startDate: String,
        endDate: String
    ): List<CachedCalendarEvent> {
        return calendarDao.getEventsInRange(userId, now, startDate, endDate)
    }

    suspend fun getCalendarEvent(id: String): CachedCalendarEvent? {
        return calendarDao.getEvent(id, now)
    }

    // MARK: - Task Cache

    suspend fun cacheTasks(tasks: List<CachedTask>, userId: String) {
        taskDao.saveTasks(tasks)
        enforceCacheLimit("tasks", maxTasks, userId)
    }

    suspend fun getCachedTasks(userId: String): List<CachedTask> {
        return taskDao.getTasks(userId, now)
    }

    suspend fun getCachedTasksByStatus(userId: String, status: String): List<CachedTask> {
        return taskDao.getTasksByStatus(userId, status, now)
    }

    suspend fun getOverdueTasks(userId: String): List<CachedTask> {
        val today = java.text.SimpleDateFormat("yyyy-MM-dd").format(Date())
        return taskDao.getOverdueTasks(userId, today, now)
    }

    suspend fun getCachedTask(id: String): CachedTask? {
        return taskDao.getTask(id, now)
    }

    // MARK: - Cache Management

    private suspend fun enforceCacheLimit(type: String, max: Int, userId: String) {
        val count = when (type) {
            "emails" -> emailDao.getEmailCount(userId)
            "events" -> calendarDao.getEventCount(userId)
            "tasks" -> taskDao.getTaskCount(userId)
            else -> 0
        }

        if (count > max) {
            when (type) {
                "emails" -> {
                    val emails = emailDao.getCachedEmails(userId, now, count - max + 1)
                    emailDao.deleteEmails(emails.takeLast(count - max))
                }
                "events" -> {
                    val events = calendarDao.getEventsInRange(
                        userId,
                        now,
                        "1970-01-01T00:00:00Z",
                        "2099-12-31T23:59:59Z"
                    )
                    calendarDao.deleteEvents(events.takeLast(count - max))
                }
                "tasks" -> {
                    val tasks = taskDao.getTasks(userId, now)
                    taskDao.deleteTasks(tasks.takeLast(count - max))
                }
            }
        }
    }

    suspend fun clearExpiredEntries() {
        emailDao.clearExpired(now)
        calendarDao.clearExpired(now)
        taskDao.clearExpired(now)
    }

    suspend fun clearAllCache() {
        db.clearAllTables()
    }

    suspend fun clearUserCache(userId: String) {
        emailDao.clearUserEmails(userId)
        calendarDao.clearUserEvents(userId)
        taskDao.clearUserTasks(userId)
    }

    companion object {
        private const val maxEmails = 500
        private const val maxEvents = 365
        private const val maxTasks = 1000
    }
}

// MARK: - Error Handling

class OfflineCacheException(message: String, cause: Throwable? = null) :
    Exception(message, cause)
