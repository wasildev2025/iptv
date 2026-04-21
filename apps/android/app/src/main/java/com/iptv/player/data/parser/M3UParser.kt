package com.iptv.player.data.parser

import com.iptv.player.data.model.M3UChannel
import com.iptv.player.data.model.M3UPlaylist
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.BufferedReader
import java.io.StringReader
import java.util.concurrent.TimeUnit

object M3UParser {

    private val nameRegex = Regex(""",([^,]*)$""")
    private val groupTitleRegex = Regex("""group-title="([^"]*?)"""")
    private val logoRegex = Regex("""tvg-logo="([^"]*?)"""")
    private val tvgIdRegex = Regex("""tvg-id="([^"]*?)"""")
    private val tvgNameRegex = Regex("""tvg-name="([^"]*?)"""")

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
                val groupTitle = groupTitleRegex.find(infoLine)?.groupValues?.get(1) ?: "Uncategorized"
                val logoUrl = logoRegex.find(infoLine)?.groupValues?.get(1) ?: ""
                val tvgId = tvgIdRegex.find(infoLine)?.groupValues?.get(1) ?: ""
                val tvgName = tvgNameRegex.find(infoLine)?.groupValues?.get(1) ?: name

                // Next non-empty, non-comment line is the URL
                var streamUrlLine = reader.readLine()
                while (streamUrlLine != null && (streamUrlLine.isBlank() || streamUrlLine.trim().startsWith("#"))) {
                    streamUrlLine = reader.readLine()
                }

                if (streamUrlLine != null) {
                    val streamUrl = streamUrlLine.trim()
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

        val request = Request.Builder().url(url).build()
        val response = client.newCall(request).execute()
        
        if (!response.isSuccessful) throw Exception("Failed to download playlist: ${response.code}")
        
        val bodyReader = response.body?.charStream()?.buffered() ?: throw Exception("Empty playlist response")
        return bodyReader.use { parseFromReader(it) }
    }
}
