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

        // Fallback: deterministic pseudo-MAC derived from ANDROID_ID.
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        val hash = MessageDigest.getInstance("MD5").digest(androidId.toByteArray())

        return (0..5).joinToString(":") { i ->
            String.format("%02X", hash[i].toInt() and 0xFF)
        }
    }

    private fun getRealMacAddress(): String? {
        return try {
            val all = Collections.list(NetworkInterface.getNetworkInterfaces())
            for (nif in all) {
                if (!nif.name.equals("wlan0", ignoreCase = true)) continue

                val macBytes = nif.hardwareAddress ?: return null
                if (macBytes.isEmpty()) return null

                return macBytes.joinToString(":") { b ->
                    String.format("%02X", b.toInt() and 0xFF)
                }
            }
            null
        } catch (ex: Exception) {
            null
        }
    }
}
