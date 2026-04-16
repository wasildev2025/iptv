package com.iptv.player.util

import android.content.Context
import android.provider.Settings
import java.net.NetworkInterface
import java.security.MessageDigest
import java.util.Collections

object DeviceUtils {

    /**
     * Tries to get the real WiFi MAC address by iterating through network interfaces.
     * Fallback to pseudo-MAC generated from Android ID if real MAC is unavailable.
     */
    fun getDeviceMac(context: Context): String {
        val realMac = getRealMacAddress()
        if (realMac != null && realMac != "02:00:00:00:00:00") {
            return realMac
        }

        // Fallback to pseudo-MAC
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        val hash = MessageDigest.getInstance("MD5").digest(androidId.toByteArray())

        // Format as MAC address (use first 6 bytes of MD5 hash)
        return String.format(
            "%02X:%02X:%02X:%02X:%02X:%02X",
            hash[0], hash[1], hash[2], hash[3], hash[4], hash[5]
        )
    }

    private fun getRealMacAddress(): String? {
        return try {
            val all = Collections.list(NetworkInterface.getNetworkInterfaces())
            for (nif in all) {
                if (!nif.name.equals("wlan0", ignoreCase = true)) continue

                val macBytes = nif.hardwareAddress ?: return null

                val res1 = StringBuilder()
                for (b in macBytes) {
                    res1.append(String.format("%02X:", b))
                }

                if (res1.isNotEmpty()) {
                    res1.deleteCharAt(res1.length - 1)
                }
                return res1.toString()
            }
            null
        } catch (ex: Exception) {
            null
        }
    }
}
