package tech.geektoshi.signet.data.api

import tech.geektoshi.signet.data.model.AdminActivityEntry
import tech.geektoshi.signet.data.model.AdminActivityResponse
import tech.geektoshi.signet.data.model.ApproveRequestBody
import tech.geektoshi.signet.data.model.AppsResponse
import tech.geektoshi.signet.data.model.ConnectionTokenResponse
import tech.geektoshi.signet.data.model.SuspendAppBody
import tech.geektoshi.signet.data.model.DashboardResponse
import tech.geektoshi.signet.data.model.DeadManSwitchActionBody
import tech.geektoshi.signet.data.model.DeadManSwitchResponse
import tech.geektoshi.signet.data.model.DeadManSwitchStatus
import tech.geektoshi.signet.data.model.DisableDeadManSwitchBody
import tech.geektoshi.signet.data.model.EnableDeadManSwitchBody
import tech.geektoshi.signet.data.model.HealthStatus
import tech.geektoshi.signet.data.model.KeysResponse
import tech.geektoshi.signet.data.model.NostrconnectRequest
import tech.geektoshi.signet.data.model.NostrconnectResponse
import tech.geektoshi.signet.data.model.OperationResponse
import tech.geektoshi.signet.data.model.RelaysResponse
import tech.geektoshi.signet.data.model.RequestsResponse
import tech.geektoshi.signet.data.model.UpdateDeadManSwitchBody
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.header
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import tech.geektoshi.signet.BuildConfig

class SignetApiClient(
    private val baseUrl: String
) {
    private val client = HttpClient(OkHttp) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                explicitNulls = false
            })
        }
        defaultRequest {
            url(baseUrl)
            contentType(ContentType.Application.Json)
            // Bearer auth skips CSRF checks (token value doesn't matter when requireAuth=false)
            bearerAuth("android-client")
            // Identify client for admin activity logging
            header("X-Signet-Client", "Signet Android/${BuildConfig.VERSION_NAME}")
        }
    }

    /**
     * Get dashboard stats and recent activity
     */
    suspend fun getDashboard(): DashboardResponse {
        return client.get("/dashboard").body()
    }

    /**
     * Get list of requests
     * @param excludeAdmin When true with status="all", excludes admin events from response
     */
    suspend fun getRequests(
        status: String = "pending",
        limit: Int = 50,
        offset: Int = 0,
        excludeAdmin: Boolean = false
    ): RequestsResponse {
        return client.get("/requests") {
            parameter("status", status)
            parameter("limit", limit)
            parameter("offset", offset)
            if (excludeAdmin) {
                parameter("excludeAdmin", "true")
            }
        }.body()
    }

    /**
     * Approve a request
     */
    suspend fun approveRequest(
        id: String,
        trustLevel: String? = null,
        alwaysAllow: Boolean = false,
        appName: String? = null,
        passphrase: String? = null
    ): OperationResponse {
        return client.post("/requests/$id") {
            setBody(ApproveRequestBody(
                trustLevel = trustLevel,
                alwaysAllow = if (alwaysAllow) true else null,
                appName = appName?.ifBlank { null },
                passphrase = passphrase?.ifBlank { null }
            ))
        }.body()
    }

    /**
     * Deny a request
     */
    suspend fun denyRequest(id: String): OperationResponse {
        return client.delete("/requests/$id").body()
    }

    /**
     * Get list of keys
     */
    suspend fun getKeys(): KeysResponse {
        return client.get("/keys").body()
    }

    /**
     * Create a new key
     */
    suspend fun createKey(
        keyName: String,
        passphrase: String? = null,
        nsec: String? = null
    ): OperationResponse {
        return client.post("/keys") {
            setBody(mapOf(
                "keyName" to keyName,
                "passphrase" to passphrase,
                "nsec" to nsec
            ).filterValues { it != null })
        }.body()
    }

    /**
     * Delete a key
     */
    suspend fun deleteKey(
        keyName: String,
        passphrase: String? = null
    ): OperationResponse {
        return client.delete("/keys/$keyName") {
            setBody(mapOf(
                "passphrase" to passphrase
            ).filterValues { it != null })
        }.body()
    }

    /**
     * Unlock an encrypted key
     */
    suspend fun unlockKey(
        keyName: String,
        passphrase: String
    ): OperationResponse {
        return client.post("/keys/$keyName/unlock") {
            setBody(mapOf("passphrase" to passphrase))
        }.body()
    }

    /**
     * Lock an active key, removing it from memory.
     * The key remains encrypted on disk; all apps and permissions are preserved.
     */
    suspend fun lockKey(keyName: String): OperationResponse {
        return client.post("/keys/$keyName/lock") {
            setBody(emptyMap<String, String>())
        }.body()
    }

    /**
     * Generate a one-time connection token for a key.
     * Returns a bunker URI with a token that expires in 5 minutes and can only be used once.
     */
    suspend fun generateConnectionToken(keyName: String): ConnectionTokenResponse {
        return client.post("/keys/$keyName/connection-token") {
            setBody(emptyMap<String, String>())
        }.body()
    }

    /**
     * Get list of connected apps
     */
    suspend fun getApps(): AppsResponse {
        return client.get("/apps").body()
    }

    /**
     * Revoke an app
     */
    suspend fun revokeApp(id: Int): OperationResponse {
        return client.post("/apps/$id/revoke") {
            setBody(emptyMap<String, String>())
        }.body()
    }

    /**
     * Update an app's name or trust level
     */
    suspend fun updateApp(
        id: Int,
        description: String? = null,
        trustLevel: String? = null
    ): OperationResponse {
        return client.patch("/apps/$id") {
            setBody(mapOf(
                "description" to description,
                "trustLevel" to trustLevel
            ).filterValues { it != null })
        }.body()
    }

    /**
     * Suspend an app, preventing all requests until unsuspended.
     * @param until Optional ISO8601 timestamp when the suspension should automatically end
     */
    suspend fun suspendApp(id: Int, until: String? = null): OperationResponse {
        return client.post("/apps/$id/suspend") {
            setBody(SuspendAppBody(until = until))
        }.body()
    }

    /**
     * Unsuspend an app, allowing requests again.
     */
    suspend fun unsuspendApp(id: Int): OperationResponse {
        return client.post("/apps/$id/unsuspend") {
            setBody(emptyMap<String, String>())
        }.body()
    }

    /**
     * Connect to an app via nostrconnect:// URI.
     */
    suspend fun connectViaNostrconnect(
        uri: String,
        keyName: String,
        trustLevel: String,
        description: String? = null
    ): NostrconnectResponse {
        return client.post("/nostrconnect") {
            setBody(NostrconnectRequest(
                uri = uri,
                keyName = keyName,
                trustLevel = trustLevel,
                description = description
            ))
        }.body()
    }

    /**
     * Get relay status
     */
    suspend fun getRelays(): RelaysResponse {
        return client.get("/relays").body()
    }

    /**
     * Get full health status from daemon
     */
    suspend fun getHealth(): HealthStatus {
        return client.get("/health").body()
    }

    /**
     * Get admin activity (key lock/unlock, app suspend/resume, daemon start events)
     */
    suspend fun getAdminActivity(
        limit: Int = 50,
        offset: Int = 0
    ): List<AdminActivityEntry> {
        return client.get("/requests") {
            parameter("status", "admin")
            parameter("limit", limit)
            parameter("offset", offset)
        }.body<AdminActivityResponse>().requests
    }

    /**
     * Check if the daemon is reachable
     */
    suspend fun healthCheck(): Boolean {
        return try {
            client.get("/health")
            true
        } catch (e: Exception) {
            false
        }
    }

    // ==================== Dead Man's Switch (Inactivity Lock) ====================

    /**
     * Get Dead Man's Switch status
     */
    suspend fun getDeadManSwitchStatus(): DeadManSwitchStatus {
        return client.get("/dead-man-switch").body()
    }

    /**
     * Enable the Dead Man's Switch
     */
    suspend fun enableDeadManSwitch(timeframeSec: Int? = null): DeadManSwitchResponse {
        return client.put("/dead-man-switch") {
            setBody(EnableDeadManSwitchBody(
                enabled = true,
                timeframeSec = timeframeSec
            ))
        }.body()
    }

    /**
     * Disable the Dead Man's Switch
     */
    suspend fun disableDeadManSwitch(
        keyName: String,
        passphrase: String
    ): DeadManSwitchResponse {
        return client.put("/dead-man-switch") {
            setBody(DisableDeadManSwitchBody(
                enabled = false,
                keyName = keyName,
                passphrase = passphrase
            ))
        }.body()
    }

    /**
     * Update the Dead Man's Switch timeframe
     */
    suspend fun updateDeadManSwitchTimeframe(
        keyName: String,
        passphrase: String,
        timeframeSec: Int
    ): DeadManSwitchResponse {
        return client.put("/dead-man-switch") {
            setBody(UpdateDeadManSwitchBody(
                timeframeSec = timeframeSec,
                keyName = keyName,
                passphrase = passphrase
            ))
        }.body()
    }

    /**
     * Reset the Dead Man's Switch timer
     */
    suspend fun resetDeadManSwitch(
        keyName: String,
        passphrase: String
    ): DeadManSwitchResponse {
        return client.post("/dead-man-switch/reset") {
            setBody(DeadManSwitchActionBody(
                keyName = keyName,
                passphrase = passphrase
            ))
        }.body()
    }

    /**
     * Test the panic functionality (for testing)
     */
    suspend fun testDeadManSwitchPanic(
        keyName: String,
        passphrase: String
    ): DeadManSwitchResponse {
        return client.post("/dead-man-switch/test-panic") {
            setBody(DeadManSwitchActionBody(
                keyName = keyName,
                passphrase = passphrase
            ))
        }.body()
    }

    /**
     * Close the client
     */
    fun close() {
        client.close()
    }
}
