/**
 * Secure Preferences Manager - EncryptedSharedPreferences for Android
 * CRITICAL FIX 1.1: Instance keys stored in EncryptedSharedPreferences only
 */

package com.helix.utils

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecurePrefsManager(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "helix_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    /**
     * Save a string value to encrypted storage
     * @param key Unique identifier for the value
     * @param value String value to save
     */
    fun putString(key: String, value: String) {
        sharedPreferences.edit().putString(key, value).apply()
    }

    /**
     * Retrieve a string value from encrypted storage
     * @param key Unique identifier for the value
     * @param defaultValue Default value if not found
     * @return Stored string value or default
     */
    fun getString(key: String, defaultValue: String = ""): String {
        return sharedPreferences.getString(key, defaultValue) ?: defaultValue
    }

    /**
     * Save a boolean value to encrypted storage
     * @param key Unique identifier for the value
     * @param value Boolean value to save
     */
    fun putBoolean(key: String, value: Boolean) {
        sharedPreferences.edit().putBoolean(key, value).apply()
    }

    /**
     * Retrieve a boolean value from encrypted storage
     * @param key Unique identifier for the value
     * @param defaultValue Default value if not found
     * @return Stored boolean value or default
     */
    fun getBoolean(key: String, defaultValue: Boolean = false): Boolean {
        return sharedPreferences.getBoolean(key, defaultValue)
    }

    /**
     * Save an integer value to encrypted storage
     * @param key Unique identifier for the value
     * @param value Integer value to save
     */
    fun putInt(key: String, value: Int) {
        sharedPreferences.edit().putInt(key, value).apply()
    }

    /**
     * Retrieve an integer value from encrypted storage
     * @param key Unique identifier for the value
     * @param defaultValue Default value if not found
     * @return Stored integer value or default
     */
    fun getInt(key: String, defaultValue: Int = 0): Int {
        return sharedPreferences.getInt(key, defaultValue)
    }

    /**
     * Delete a value from encrypted storage
     * @param key Unique identifier for the value
     */
    fun remove(key: String) {
        sharedPreferences.edit().remove(key).apply()
    }

    /**
     * Check if a key exists in encrypted storage
     * @param key Unique identifier to check
     * @return true if key exists
     */
    fun contains(key: String): Boolean {
        return sharedPreferences.contains(key)
    }

    /**
     * Clear all values from encrypted storage
     */
    fun clear() {
        sharedPreferences.edit().clear().apply()
    }

    companion object {
        @Volatile
        private var instance: SecurePrefsManager? = null

        /**
         * Get singleton instance of SecurePrefsManager
         * @param context Application context
         * @return SecurePrefsManager singleton
         */
        fun getInstance(context: Context): SecurePrefsManager {
            return instance ?: synchronized(this) {
                instance ?: SecurePrefsManager(context).also { instance = it }
            }
        }
    }
}
