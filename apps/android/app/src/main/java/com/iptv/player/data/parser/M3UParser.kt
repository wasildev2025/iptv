package com.iptv.player.data.parser

import com.iptv.player.data.model.M3UChannel
import com.iptv.player.data.model.M3UPlaylist
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.BufferedReader
import java.io.StringReader
import java.util.concurrent.TimeUnit

object M3UParser {

    private val nameRegex = Regex(""",([^,]*)$""")
    private val groupTitleRegex = Regex("""group-title=["'](.*?)["']""")
    private val logoRegex = Regex("""tvg-logo=["'](.*?)["']""")
    private val tvgIdRegex = Regex("""tvg-id=["'](.*?)["']""")
    private val tvgNameRegex = Regex("""tvg-name=["'](.*?)["']""")

    fun parse(content: String): M3UPlaylist {
        return parseFromReader(BufferedReader(StringReader(content)))
    }

    private fun parseFromReader(reader: BufferedReader): M3UPlaylist {
        val channels = mutableListOf<M3UChannel>()
        val groups = mutableSetOf<String>()

        var line: String? = reader.readLine()
        while (line != null) {
            val trimmedLine = line.trim()

            if (trimmedLine.startsWith("#EXTINF:")) {
                val infoLine = trimmedLine
                val name = extractName(infoLine)
                var groupTitle = groupTitleRegex.find(infoLine)?.groupValues?.get(1) ?: "Uncategorized"
                val logoUrl = logoRegex.find(infoLine)?.groupValues?.get(1) ?: ""
                val tvgId = tvgIdRegex.find(infoLine)?.groupValues?.get(1) ?: ""
                val tvgName = tvgNameRegex.find(infoLine)?.groupValues?.get(1) ?: name

                // Look for #EXTGRP: on the following lines
                var nextLine = reader.readLine()
                while (nextLine != null && (nextLine.isBlank() || nextLine.trim().startsWith("#"))) {
                    val trimmedNext = nextLine.trim()
                    if (trimmedNext.startsWith("#EXTGRP:")) {
                        groupTitle = trimmedNext.substringAfter("#EXTGRP:").trim()
                    }
                    if (!trimmedNext.startsWith("#")) break // Found the URL line
                    nextLine = reader.readLine()
                }

                if (nextLine != null) {
                    val streamUrl = nextLine.trim()
                    val isPlayable = streamUrl.isNotEmpty() &&
                        (streamUrl.startsWith("http") || streamUrl.startsWith("rtmp")) &&
                        !streamUrl.contains("youtube.com", ignoreCase = true) &&
                        !streamUrl.contains("youtu.be", ignoreCase = true)
                    
                    if (isPlayable) {
                        val isLive = !groupTitle.contains("VOD", ignoreCase = true) &&
                                    !groupTitle.contains("Movie", ignoreCase = true) &&
                                    !groupTitle.contains("Series", ignoreCase = true)

                        channels.add(
                            M3UChannel(
                                name = name,
                                groupTitle = groupTitle,
                                logoUrl = logoUrl,
                                streamUrl = streamUrl,
                                tvgId = tvgId,
                                tvgName = tvgName,
                                isLive = isLive
                            )
                        )
                        groups.add(groupTitle)
                    }
                }
            }
            line = reader.readLine()
        }

        return M3UPlaylist(
            channels = channels,
            groups = groups.sorted()
        )
    }

    private fun extractName(line: String): String {
        return nameRegex.find(line)?.groupValues?.get(1)?.trim() ?: "Unknown"
    }

    suspend fun parseFromUrl(url: String): M3UPlaylist {
        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()

        val request = Request.Builder().url(normalizeXtreamPlaylistUrl(url)).build()
        val response = client.newCall(request).execute()

        if (!response.isSuccessful) throw Exception("Failed to download playlist: ${response.code}")

        val bodyReader = response.body?.charStream()?.buffered() ?: throw Exception("Empty playlist response")
        return bodyReader.use { parseFromReader(it) }
    }

    /**
     * Upgrade Xtream Codes `get.php?...&type=m3u` URLs to `type=m3u_plus` so
     * we receive group-title and tvg-logo. Backend already normalises server-side
     * but this protects manually-pasted URLs from the Activation screen.
     */
    internal fun normalizeXtreamPlaylistUrl(rawUrl: String): String {
        if (rawUrl.isBlank()) return rawUrl
        val httpUrl = rawUrl.toHttpUrlOrNull() ?: return rawUrl
        val looksXtream = httpUrl.encodedPath.endsWith("/get.php") &&
            httpUrl.queryParameter("username") != null &&
            httpUrl.queryParameter("password") != null
        if (!looksXtream) return rawUrl

        val type = httpUrl.queryParameter("type")
        return when (type) {
            "m3u", null -> httpUrl.newBuilder()
                .setQueryParameter("type", "m3u_plus")
                .build()
                .toString()
            else -> rawUrl
        }
    }
}
