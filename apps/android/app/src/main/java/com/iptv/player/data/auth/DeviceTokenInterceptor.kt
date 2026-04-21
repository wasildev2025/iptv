package com.iptv.player.data.auth

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Attaches the stored device token as `Authorization: Bearer <token>` to every
 * outgoing request. Requests that already carry an Authorization header (or that
 * explicitly skip auth via the `X-No-Device-Auth` marker) are left alone.
 */
@Singleton
class DeviceTokenInterceptor @Inject constructor(
    private val authStore: DeviceAuthStore
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()

        if (original.header("Authorization") != null) {
            return chain.proceed(original)
        }
        if (original.header(NO_AUTH_HEADER) != null) {
            return chain.proceed(original.newBuilder().removeHeader(NO_AUTH_HEADER).build())
        }

        val token = authStore.readTokenBlocking()
        val next = if (token.isNullOrBlank()) {
            original
        } else {
            original.newBuilder().header("Authorization", "Bearer $token").build()
        }
        return chain.proceed(next)
    }

    companion object {
        const val NO_AUTH_HEADER = "X-No-Device-Auth"
    }
}
