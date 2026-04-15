package com.iptv.player.data.api

import com.iptv.player.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface IPTVApiService {
    // Check if device (MAC) is activated
    @POST("devices/check-status")
    suspend fun checkDeviceStatus(
        @Body request: ActivationRequest
    ): Response<DeviceCheckResponse>

    // Check device across multiple apps
    @POST("devices/check-status-multi")
    suspend fun checkDeviceStatusMulti(
        @Body request: Map<String, @JvmSuppressWildcards Any>
    ): Response<Map<String, Any>>

    // Get allowed apps list for a specific device
    @GET("apps/allowed/{macAddress}")
    suspend fun getAllowedApps(
        @Path("macAddress") macAddress: String
    ): Response<List<AppInfo>>

    // Get all active apps
    @GET("apps")
    suspend fun getApps(): Response<List<AppInfo>>

    // Get playlists for a device
    @POST("playlists/check-status")
    suspend fun getDevicePlaylists(
        @Body request: ActivationRequest
    ): Response<Map<String, Any>>
}
