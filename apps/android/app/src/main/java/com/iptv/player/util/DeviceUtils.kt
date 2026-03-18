package com.iptv.player.util

import android.content.Context
import android.net.wifi.WifiManager
import android.provider.Settings
import java.security.MessageDigest

object DeviceUtils {

    // Generate a unique MAC-like address for this device
    // Uses Android ID to generate a consistent pseudo-MAC
    fun getDeviceMac(context: Context): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        val hash = MessageDigest.getInstance("MD5").digest(androidId.toByteArray())

        // Format as MAC address (use first 6 bytes of MD5 hash)
        return String.format(
            "%02X:%02X:%02X:%02X:%02X:%02X",
            hash[0], hash[1], hash[2], hash[3], hash[4], hash[5]
        )
    }

    // Try to get real WiFi MAC (requires permissions, may return 02:00:00:00:00:00 on newer Android)
    @Suppress("DEPRECATION")
    fun getWifiMac(context: Context): String? {
        return try {
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val info = wifiManager.connectionInfo
            val mac = info.macAddress
            if (mac != null && mac != "02:00:00:00:00:00") mac.uppercase() else null
        } catch (e: Exception) {
            null
        }
    }
}
