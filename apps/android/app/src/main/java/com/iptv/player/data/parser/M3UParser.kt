package com.iptv.player.data.parser

import com.iptv.player.data.model.M3UChannel
import com.iptv.player.data.model.M3UPlaylist

object M3UParser {

    fun parse(content: String): M3UPlaylist {
        val channels = mutableListOf<M3UChannel>()
        val groups = mutableSetOf<String>()
        val lines = content.lines()

        var i = 0
        while (i < lines.size) {
            val line = lines[i].trim()

            if (line.startsWith("#EXTINF:")) {
                // Parse channel info line
                val name = extractName(line)
                val groupTitle = extractAttribute(line, "group-title") ?: "Uncategorized"
                val logoUrl = extractAttribute(line, "tvg-logo") ?: ""
                val tvgId = extractAttribute(line, "tvg-id") ?: ""
                val tvgName = extractAttribute(line, "tvg-name") ?: name

                // Next non-empty, non-comment line is the URL
                i++
                while (i < lines.size && (lines[i].isBlank() || lines[i].trim().startsWith("#"))) {
                    i++
                }

                if (i < lines.size) {
                    val streamUrl = lines[i].trim()
                    // Skip rtsp:// — ExoPlayer's DefaultHttpDataSource can't play it without RtspMediaSource.
                    if (streamUrl.isNotEmpty() && (streamUrl.startsWith("http") || streamUrl.startsWith("rtmp"))) {
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
            i++
        }

        return M3UPlaylist(
            channels = channels,
            groups = groups.sorted()
        )
    }

    private fun extractName(line: String): String {
        val commaIndex = line.lastIndexOf(',')
        return if (commaIndex >= 0) line.substring(commaIndex + 1).trim() else "Unknown"
    }

    private fun extractAttribute(line: String, key: String): String? {
        val pattern = Regex("""$key="([^"]*?)"""")
        return pattern.find(line)?.groupValues?.get(1)
    }

    // Parse from URL (download then parse)
    suspend fun parseFromUrl(url: String): M3UPlaylist {
        val client = okhttp3.OkHttpClient.Builder()
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
            .build()

        val request = okhttp3.Request.Builder().url(url).build()
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("Empty playlist response")
        return parse(body)
    }
}
