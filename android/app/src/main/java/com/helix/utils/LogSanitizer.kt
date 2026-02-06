/**
 * Log Sanitizer - Redact sensitive data from logs
 * HIGH FIX 6.1: Sanitizes logs to prevent credential leakage
 * Removes tokens, keys, passwords, and other sensitive information
 */

package com.helix.utils

import android.util.Log

object LogSanitizer {
    // Regular expression patterns for sensitive data
    private val patterns = mapOf(
        // JWT tokens (eyJ... format)
        "jwt" to Regex("eyJ[A-Za-z0-9_-]+"),

        // Bearer tokens
        "bearer" to Regex("Bearer\\s+([A-Za-z0-9_-]+)", RegexOption.IGNORE_CASE),

        // API Keys (generic)
        "apikey" to Regex("api[_-]?key['\"]?\\s*[:=]\\s*['\"]?([a-zA-Z0-9_-]+)", RegexOption.IGNORE_CASE),

        // Supabase keys
        "supabase" to Regex("supabase[._-]?(anon|service)[._-]?key['\"]?\\s*[:=]\\s*['\"]?([a-zA-Z0-9_-]+)", RegexOption.IGNORE_CASE),

        // Database URLs with credentials
        "database_url" to Regex("postgres://[^:]+:[^@]+@", RegexOption.IGNORE_CASE),

        // Instance keys (UUIDs)
        "instance_key" to Regex("instance[._-]?key['\"]?\\s*[:=]\\s*['\"]?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})", RegexOption.IGNORE_CASE),

        // Password assignments
        "password" to Regex("password['\"]?\\s*[:=]\\s*['\"]?([^'\"\\s,}\\]]+)", RegexOption.IGNORE_CASE),

        // Authorization headers
        "auth_header" to Regex("Authorization['\"]?\\s*[:=]\\s*['\"]?([^'\"\\s,}\\]]+)", RegexOption.IGNORE_CASE),

        // Session tokens
        "session" to Regex("session[._-]?token['\"]?\\s*[:=]\\s*['\"]?([a-zA-Z0-9_-]+)", RegexOption.IGNORE_CASE),

        // Refresh tokens
        "refresh" to Regex("refresh[._-]?token['\"]?\\s*[:=]\\s*['\"]?([a-zA-Z0-9_-]+)", RegexOption.IGNORE_CASE),

        // Access tokens
        "access" to Regex("access[._-]?token['\"]?\\s*[:=]\\s*['\"]?([a-zA-Z0-9_-]+)", RegexOption.IGNORE_CASE),
    )

    /**
     * Sanitize a log message by redacting sensitive information
     * @param message Log message to sanitize
     * @return Sanitized message with sensitive data redacted
     */
    fun sanitize(message: String): String {
        var sanitized = message

        for ((category, regex) in patterns) {
            sanitized = sanitized.replace(regex) { "[REDACTED:${category.uppercase()}]" }
        }

        return sanitized
    }

    /**
     * Sanitize an error message
     * @param error Error to sanitize
     * @return Error message with sensitive data redacted
     */
    fun sanitize(error: Throwable): String {
        val message = error.message ?: error.toString()
        return sanitize(message)
    }

    /**
     * Safe logging with automatic sanitization
     * @param tag Log tag
     * @param msg Message to log (will be sanitized)
     * @param level Log level (e.g., Log.DEBUG, Log.INFO, Log.WARN, Log.ERROR)
     */
    fun log(tag: String, msg: String, level: Int = Log.INFO) {
        val sanitized = sanitize(msg)
        Log.println(level, tag, sanitized)
    }

    /**
     * Safe logging of exceptions
     * @param tag Log tag
     * @param msg Message prefix
     * @param tr Exception to log (message will be sanitized)
     * @param level Log level
     */
    fun log(tag: String, msg: String, tr: Throwable, level: Int = Log.ERROR) {
        val sanitized = sanitize(msg)
        val errorMsg = sanitize(tr.message ?: "Unknown error")
        Log.println(level, tag, "$sanitized: $errorMsg")

        // Also log stack trace with sanitized messages if needed
        if (level >= Log.WARN) {
            tr.stackTrace.forEach { element ->
                Log.println(level, tag, element.toString())
            }
        }
    }

    /**
     * Create a safe logger wrapper
     */
    class SafeLogger(private val tag: String) {
        fun d(msg: String) = log(tag, msg, Log.DEBUG)
        fun i(msg: String) = log(tag, msg, Log.INFO)
        fun w(msg: String) = log(tag, msg, Log.WARN)
        fun w(msg: String, tr: Throwable) = log(tag, msg, tr, Log.WARN)
        fun e(msg: String) = log(tag, msg, Log.ERROR)
        fun e(msg: String, tr: Throwable) = log(tag, msg, tr, Log.ERROR)
    }
}

/**
 * Create a safe logger for a class
 */
fun Any.safeLogger(): LogSanitizer.SafeLogger {
    return LogSanitizer.SafeLogger(this::class.java.simpleName)
}
