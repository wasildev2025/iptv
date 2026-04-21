package com.iptv.player.data.api

import com.iptv.player.data.model.AppInfo
import com.iptv.player.data.model.AppsListRequest
import com.iptv.player.data.model.BindDeviceRequest
import com.iptv.player.data.model.BindDeviceResponse
import com.iptv.player.data.model.DeviceState
import com.iptv.player.data.model.VerifyPinRequest
import com.iptv.player.data.model.VerifyPinResponse
import com.iptv.player.data.model.XtreamCategoryRequest
import com.iptv.player.data.model.XtreamCategoryResponse
import com.iptv.player.data.model.XtreamHomeRequest
import com.iptv.player.data.model.XtreamHomeResponse
import com.iptv.player.data.model.XtreamSearchRequest
import com.iptv.player.data.model.XtreamSearchResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface IPTVApiService {
    /** Discovery: list apps activated for a MAC. No auth. */
    @POST("public/apps")
    suspend fun getApps(
        @Body request: AppsListRequest
    ): Response<List<AppInfo>>

    /** One-shot bind: MAC + app → device token + initial state. No auth. */
    @POST("public/bind-device")
    suspend fun bindDevice(
        @Body request: BindDeviceRequest
    ): Response<BindDeviceResponse>

    /** Refresh current state. Requires Bearer device token (added by interceptor). */
    @POST("public/check-activation")
    suspend fun checkActivation(): Response<DeviceState>

    /** Verify a PIN for a protected playlist. Requires device token. */
    @POST("public/verify-playlist-pin")
    suspend fun verifyPlaylistPin(
        @Body request: VerifyPinRequest
    ): Response<VerifyPinResponse>

    /** Revoke the calling device token (sign out). */
    @POST("public/revoke-device-token")
    suspend fun revokeDeviceToken(): Response<Unit>

    /** Lightweight Xtream home payload with featured channels and category rails. */
    @POST("public/xtream/home")
    suspend fun getXtreamHome(
        @Body request: XtreamHomeRequest
    ): Response<XtreamHomeResponse>

    /** Load one Xtream category worth of channels. */
    @POST("public/xtream/category")
    suspend fun getXtreamCategory(
        @Body request: XtreamCategoryRequest
    ): Response<XtreamCategoryResponse>

    /** Server-side Xtream live search. */
    @POST("public/xtream/search")
    suspend fun searchXtream(
        @Body request: XtreamSearchRequest
    ): Response<XtreamSearchResponse>
}
