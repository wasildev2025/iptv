package com.iptv.player.data.api

import com.iptv.player.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface IPTVApiService {
    // Public activation check — no auth required
    @POST("public/check-activation")
    suspend fun checkDeviceStatus(
        @Body request: ActivationRequest
    ): Response<DeviceCheckResponse>

    // Public list of active apps — no auth required
    @POST("public/apps")
    suspend fun getApps(): Response<List<AppInfo>>
}
