/**
 * Gateway Configuration Storage - Helix Android
 * Persists gateway config (instance key, URL) using EncryptedSharedPreferences
 */

package com.helix.core.gateway

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class GatewayConnectionConfig(
    val instanceKey: String,
    val gatewayUrl: String? = null
)

class GatewayConfigStorage(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "helix_gateway_config",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private val json = Json { ignoreUnknownKeys = true }

    fun saveConfig(config: GatewayConnectionConfig) {
        val configJson = json.encodeToString(config)
        prefs.edit()
            .putString(KEY_CONFIG, configJson)
            .apply()
    }

    fun loadConfig(): GatewayConnectionConfig? {
        val configJson = prefs.getString(KEY_CONFIG, null) ?: return null
        return try {
            json.decodeFromString<GatewayConnectionConfig>(configJson)
        } catch (e: Exception) {
            null
        }
    }

    fun clearConfig() {
        prefs.edit()
            .remove(KEY_CONFIG)
            .apply()
    }

    fun updateInstanceKey(key: String) {
        val currentConfig = loadConfig()
        val updated = GatewayConnectionConfig(
            instanceKey = key,
            gatewayUrl = currentConfig?.gatewayUrl
        )
        saveConfig(updated)
    }

    fun updateGatewayUrl(url: String) {
        val currentConfig = loadConfig() ?: throw GatewayConnectionError(
            code = GatewayErrorCode.CONNECTION_FAILED,
            message = "No existing config found"
        )
        val updated = GatewayConnectionConfig(
            instanceKey = currentConfig.instanceKey,
            gatewayUrl = url
        )
        saveConfig(updated)
    }

    companion object {
        private const val KEY_CONFIG = "gateway_config"
    }
}
