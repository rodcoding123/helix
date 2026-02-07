package com.helix.chat.services

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.room.Database
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Delete
import androidx.room.Query
import com.helix.chat.models.Message
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import java.time.Instant

/**
 * Offline Sync Service
 *
 * Manages offline message queue with Core Data (Room) persistence.
 * Handles network monitoring, automatic sync, and retry logic.
 */
class OfflineSyncService(private val context: Context) {
    // State
    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _queueLength = MutableStateFlow(0)
    val queueLength: StateFlow<Int> = _queueLength.asStateFlow()

    private val _failedCount = MutableStateFlow(0)
    val failedCount: StateFlow<Int> = _failedCount.asStateFlow()

    private val _lastSyncTime = MutableStateFlow<Long?>(null)
    val lastSyncTime: StateFlow<Long?> = _lastSyncTime.asStateFlow()

    // Database
    private val database = Room.databaseBuilder(
        context,
        HelixDatabase::class.java,
        "helix_database"
    ).build()

    private val queueDao = database.queuedMessageDao()
    private val scope = CoroutineScope(Dispatchers.IO)

    // Connectivity monitoring
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    init {
        setupNetworkMonitoring()
        loadQueueState()
    }

    /**
     * Monitor network connectivity
     */
    private fun setupNetworkMonitoring() {
        scope.launch {
            val callback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: android.net.Network) {
                    scope.launch {
                        _isOnline.emit(true)
                        // Attempt sync when connection restored
                        attemptSync()
                    }
                }

                override fun onLost(network: android.net.Network) {
                    scope.launch {
                        _isOnline.emit(false)
                    }
                }
            }

            connectivityManager.registerDefaultNetworkCallback(callback)
        }
    }

    /**
     * Check if device is online
     */
    private fun isDeviceOnline(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /**
     * Queue a message for offline storage
     */
    suspend fun queueMessage(message: Message, sessionKey: String) {
        try {
            val queuedMessage = QueuedMessageEntity(
                messageId = message.id,
                content = message.content,
                sessionKey = sessionKey,
                timestamp = Instant.now().toEpochMilli(),
                retries = 0
            )

            queueDao.insert(queuedMessage)
            updateQueueState()
        } catch (e: Exception) {
            Timber.e(e, "Failed to queue message")
        }
    }

    /**
     * Remove message from queue
     */
    suspend fun removeFromQueue(messageId: String) {
        try {
            queueDao.deleteByMessageId(messageId)
            updateQueueState()
        } catch (e: Exception) {
            Timber.e(e, "Failed to remove message from queue")
        }
    }

    /**
     * Get all queued messages
     */
    suspend fun getQueuedMessages(): List<Message> {
        return try {
            queueDao.getAllQueued().map { entity ->
                Message(
                    id = entity.messageId,
                    sessionKey = entity.sessionKey,
                    userId = "",
                    role = Message.MessageRole.USER,
                    content = entity.content,
                    timestamp = Instant.ofEpochMilli(entity.timestamp).toString(),
                    clientId = entity.messageId,
                    isPending = true
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to get queued messages")
            emptyList()
        }
    }

    /**
     * Get failed messages
     */
    suspend fun getFailedMessages(): List<Message> {
        return try {
            queueDao.getFailedMessages().map { entity ->
                Message(
                    id = entity.messageId,
                    sessionKey = entity.sessionKey,
                    userId = "",
                    role = Message.MessageRole.USER,
                    content = entity.content,
                    timestamp = Instant.ofEpochMilli(entity.timestamp).toString(),
                    clientId = entity.messageId,
                    isPending = true
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to get failed messages")
            emptyList()
        }
    }

    /**
     * Clear entire queue
     */
    suspend fun clearQueue() {
        try {
            queueDao.deleteAll()
            updateQueueState()
        } catch (e: Exception) {
            Timber.e(e, "Failed to clear queue")
        }
    }

    /**
     * Attempt sync with automatic retry
     */
    suspend fun attemptSync() {
        if (!isDeviceOnline() || _isSyncing.value) return

        val queuedMessages = getQueuedMessages()
        if (queuedMessages.isEmpty()) return

        performSync()
    }

    /**
     * Perform sync with exponential backoff
     */
    suspend fun performSync() {
        if (_isSyncing.value) return

        _isSyncing.emit(true)
        try {
            val queuedMessages = getQueuedMessages()
            if (queuedMessages.isEmpty()) {
                _isSyncing.emit(false)
                return
            }

            // Sync would be called from ViewModel with SupabaseService
            // Here we just mark state
            _lastSyncTime.emit(System.currentTimeMillis())
        } catch (e: Exception) {
            Timber.e(e, "Sync failed")
        } finally {
            _isSyncing.emit(false)
        }
    }

    /**
     * Schedule retry for failed message
     */
    suspend fun scheduleRetry(messageId: String) {
        try {
            val message = queueDao.getByMessageId(messageId) ?: return

            // Exponential backoff: 800 * 1.5^retries, max 30s
            val backoffMs = minOf(
                (800L * Math.pow(1.5, message.retries.toDouble())).toLong(),
                30000L
            )

            Timber.d("Scheduling retry for $messageId in ${backoffMs}ms (retry ${message.retries})")

            delay(backoffMs)

            if (message.retries < 3) {
                queueDao.updateRetries(messageId, message.retries + 1)
                performSync()
            } else {
                Timber.w("Message $messageId exceeded max retries")
                _failedCount.emit(_failedCount.value + 1)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to schedule retry")
        }
    }

    /**
     * Update queue state from database
     */
    private suspend fun loadQueueState() {
        scope.launch {
            updateQueueState()
        }
    }

    /**
     * Recalculate queue state
     */
    private suspend fun updateQueueState() {
        try {
            val queued = queueDao.count()
            val failed = queueDao.countFailed()

            _queueLength.emit(queued)
            _failedCount.emit(failed)
        } catch (e: Exception) {
            Timber.e(e, "Failed to update queue state")
        }
    }
}

/**
 * Room Entity for queued messages
 */
@Entity(tableName = "queued_messages")
data class QueuedMessageEntity(
    @PrimaryKey
    val messageId: String,
    val content: String,
    val sessionKey: String,
    val timestamp: Long,
    val retries: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * Room DAO for queue operations
 */
@Dao
interface QueuedMessageDao {
    @Insert
    suspend fun insert(message: QueuedMessageEntity)

    @Delete
    suspend fun delete(message: QueuedMessageEntity)

    @Query("DELETE FROM queued_messages WHERE messageId = :messageId")
    suspend fun deleteByMessageId(messageId: String)

    @Query("DELETE FROM queued_messages")
    suspend fun deleteAll()

    @Query("SELECT * FROM queued_messages ORDER BY timestamp DESC")
    suspend fun getAllQueued(): List<QueuedMessageEntity>

    @Query("SELECT * FROM queued_messages WHERE retries >= 3 ORDER BY timestamp DESC")
    suspend fun getFailedMessages(): List<QueuedMessageEntity>

    @Query("SELECT * FROM queued_messages WHERE messageId = :messageId")
    suspend fun getByMessageId(messageId: String): QueuedMessageEntity?

    @Query("UPDATE queued_messages SET retries = :newRetries WHERE messageId = :messageId")
    suspend fun updateRetries(messageId: String, newRetries: Int)

    @Query("SELECT COUNT(*) FROM queued_messages")
    suspend fun count(): Int

    @Query("SELECT COUNT(*) FROM queued_messages WHERE retries >= 3")
    suspend fun countFailed(): Int
}

/**
 * Room Database
 */
@Database(entities = [QueuedMessageEntity::class], version = 1)
abstract class HelixDatabase : RoomDatabase() {
    abstract fun queuedMessageDao(): QueuedMessageDao
}
