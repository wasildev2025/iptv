package com.iptv.player.data.parser

import android.util.Xml
import com.iptv.player.data.model.EpgProgram
import org.xmlpull.v1.XmlPullParser
import java.io.InputStream
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

object XmltvParser {

    private val xmltvFormatter = DateTimeFormatter.ofPattern(
        "yyyyMMddHHmmss Z",
        Locale.US
    )

    suspend fun parsePrograms(
        inputStream: InputStream,
        windowStartMillis: Long,
        windowEndMillis: Long,
        onBatch: suspend (List<EpgProgram>) -> Unit
    ) {
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false)
        parser.setInput(inputStream, null)

        val batch = ArrayList<EpgProgram>(256)
        var eventType = parser.eventType
        while (eventType != XmlPullParser.END_DOCUMENT) {
            if (eventType == XmlPullParser.START_TAG && parser.name == "programme") {
                parseProgramme(parser)?.takeIf { program ->
                    program.endTime > windowStartMillis && program.startTime < windowEndMillis
                }?.let { program ->
                    batch.add(program)
                    if (batch.size >= 250) {
                        onBatch(batch.toList())
                        batch.clear()
                    }
                }
            }
            eventType = parser.next()
        }

        if (batch.isNotEmpty()) {
            onBatch(batch.toList())
        }
    }

    private fun parseProgramme(parser: XmlPullParser): EpgProgram? {
        val channelId = parser.getAttributeValue(null, "channel")?.trim().orEmpty()
        val startTime = parseXmltvDate(parser.getAttributeValue(null, "start"))
        val endTime = parseXmltvDate(parser.getAttributeValue(null, "stop"))
        if (channelId.isBlank() || startTime == null || endTime == null) {
            skipTag(parser)
            return null
        }

        var title = ""
        var description = ""
        val outerDepth = parser.depth

        while (!(parser.eventType == XmlPullParser.END_TAG && parser.depth == outerDepth && parser.name == "programme")) {
            if (parser.next() == XmlPullParser.START_TAG) {
                when (parser.name) {
                    "title" -> title = parser.nextText().trim()
                    "desc" -> description = parser.nextText().trim()
                    else -> skipTag(parser)
                }
            }
        }

        return EpgProgram(
            channelId = channelId,
            title = title.ifBlank { "Untitled program" },
            description = description,
            startTime = startTime,
            endTime = endTime
        )
    }

    private fun parseXmltvDate(rawValue: String?): Long? {
        val trimmed = rawValue?.trim().orEmpty()
        if (trimmed.isBlank()) return null
        val normalized = when {
            trimmed.length >= 20 -> trimmed.substring(0, 20)
            trimmed.length == 14 -> "$trimmed +0000"
            else -> return null
        }
        return runCatching {
            OffsetDateTime.parse(normalized, xmltvFormatter)
                .withOffsetSameInstant(ZoneOffset.UTC)
                .toInstant()
                .toEpochMilli()
        }.getOrNull()
    }

    private fun skipTag(parser: XmlPullParser) {
        var depth = 1
        while (depth != 0) {
            when (parser.next()) {
                XmlPullParser.START_TAG -> depth++
                XmlPullParser.END_TAG -> depth--
            }
        }
    }
}
