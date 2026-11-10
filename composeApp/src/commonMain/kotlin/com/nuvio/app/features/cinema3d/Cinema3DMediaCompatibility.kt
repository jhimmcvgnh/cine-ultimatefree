package com.nuvio.app.features.cinema3d

import com.nuvio.app.features.streams.StreamItem

/**
 * Strict media compatibility filter for the 3D WebGL Cinema screen.
 *
 * The 3D Cinema screen renders `<video>` onto a curved `THREE.VideoTexture` with Web Audio 5.1
 * spatialization inside `WebView` + `hls.js`. Only progressive web containers (`.mp4`, `.m4v`,
 * `.webm`, `.mov`, `.ogv`) and HLS `.m3u8` streams encoded with web-compatible video/audio codecs
 * (H.264/AVC, VP8, VP9, AV1 + AAC, MP3, Opus, Vorbis) can be decoded and projected reliably.
 */
object Cinema3DMediaCompatibility {

    private val blockedSchemes = listOf(
        "magnet:",
        "torrent://",
        "rtmp://",
        "rtsp://",
        "mms://",
        "acestream://",
        "sop://",
    )

    private val blockedWebPageHostsRegex = Regex(
        pattern = """(?:youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv|netflix\.com|primevideo\.com|disneyplus\.com)""",
        option = RegexOption.IGNORE_CASE,
    )

    private val blockedExtensions = setOf(
        "avi", "wmv", "flv", "f4v", "iso", "img", "rar", "zip", "7z",
        "mpd", "vob", "rm", "rmvb", "asf", "divx", "3gp", "m2ts", "mts", "mkv",
    )

    private val allowedWebExtensions = setOf(
        "mp4", "m4v", "webm", "mov", "ogv", "m3u8",
    )

    /**
     * Codec / container / HDR / multichannel bitstream tokens that fail or play silently
     * inside `HTMLVideoElement` + `THREE.VideoTexture`.
     */
    private val incompatibleCodecTokensRegex = Regex(
        pattern = """(?i)(?:\b(?:x265|h\.?265|hevc|10-?bit|hi10p|12-?bit|dovi|bdremux|remux|vc-?1|mpeg-?2|xvid|divx|truehd|dts(?:-?hd|x)?|eac-?3|e-ac-3|ddp\b|dd\+|ac-?3|dolby\s*vision|dolby\s*truehd|atmos)\b|\.mkv\b|\.avi\b|\.wmv\b|\.flv\b|\.iso\b|\.mpd\b)""",
    )

    fun isMetadataCompatible(
        filenameHint: String? = null,
        titleHint: String? = null,
        descriptionHint: String? = null,
    ): Boolean {
        val combined = buildString {
            if (!filenameHint.isNullOrBlank()) append(filenameHint).append(' ')
            if (!titleHint.isNullOrBlank()) append(titleHint).append(' ')
            if (!descriptionHint.isNullOrBlank()) append(descriptionHint)
        }
        if (combined.isNotBlank() && incompatibleCodecTokensRegex.containsMatchIn(combined)) {
            return false
        }
        val hintExt = extractPathExtension(filenameHint)
        if (hintExt != null && hintExt in blockedExtensions) {
            return false
        }
        return true
    }

    fun isUrlCompatible(
        url: String?,
        filenameHint: String? = null,
        titleHint: String? = null,
        descriptionHint: String? = null,
    ): Boolean {
        val raw = url?.trim().orEmpty()
        if (raw.isEmpty()) return false

        val lower = raw.lowercase()
        if (blockedSchemes.any { lower.startsWith(it) }) return false

        val isAllowedScheme = lower.startsWith("http://") ||
            lower.startsWith("https://") ||
            lower.startsWith("file://") ||
            lower.startsWith("content://") ||
            lower.startsWith("blob:") ||
            lower.startsWith("movies/") ||
            lower.startsWith("/stream/") ||
            lower.startsWith("/api/")

        if (!isAllowedScheme) return false
        if (blockedWebPageHostsRegex.containsMatchIn(lower)) return false
        if (incompatibleCodecTokensRegex.containsMatchIn(raw)) return false
        if (!isMetadataCompatible(filenameHint, titleHint, descriptionHint)) return false

        val isHls = lower.contains(".m3u8") || lower.contains("mpegurl") || lower.contains("format=m3u8")
        if (isHls) return true

        val ext = extractPathExtension(raw)
        if (ext != null) {
            if (ext == "ts") return false
            if (ext in blockedExtensions) return false
            if (ext in allowedWebExtensions) return true
        }

        // Extensionless HTTP stream URLs (e.g. CDN / Debrid / Server direct endpoints):
        // check filenameHint if available; if filenameHint has an explicit extension, require it to be allowed.
        val hintExt = extractPathExtension(filenameHint)
        if (hintExt != null) {
            return hintExt in allowedWebExtensions
        }

        return true
    }

    fun extractPathExtension(pathOrUrl: String?): String? {
        val clean = pathOrUrl
            ?.trim()
            ?.substringBefore('#')
            ?.substringBefore('?')
            ?.trimEnd('/')
            .orEmpty()
        if (clean.isEmpty()) return null
        val lastSegment = clean.substringAfterLast('/')
        val dotIndex = lastSegment.lastIndexOf('.')
        if (dotIndex <= 0 || dotIndex == lastSegment.length - 1) return null
        val ext = lastSegment.substring(dotIndex + 1).lowercase()
        return ext.takeIf { it.length in 2..5 && it.all(Char::isLetterOrDigit) }
    }
}

fun StreamItem.isCompatibleWithCinema3D(debridEnabled: Boolean): Boolean {
    if (shouldOpenExternally) return false
    if (youTubeIdToResolve != null) return false

    val directUrl = playableDirectUrl
    if (!directUrl.isNullOrBlank()) {
        return Cinema3DMediaCompatibility.isUrlCompatible(
            url = directUrl,
            filenameHint = behaviorHints.filename,
            titleHint = name ?: title,
            descriptionHint = description,
        )
    }

    // Server target that prepares into an HTTP stream: allow only if metadata/filename is compatible
    if (needsServerPreparation) {
        return Cinema3DMediaCompatibility.isMetadataCompatible(
            filenameHint = behaviorHints.filename,
            titleHint = name ?: title,
            descriptionHint = description,
        )
    }

    // Torrent / Debrid candidate: only compatible if Debrid can resolve it AND filename is a web-ready MP4/WebM
    if (debridEnabled && (isAddonDebridCandidate || isCachedDebridTorrentStream)) {
        if (!Cinema3DMediaCompatibility.isMetadataCompatible(
                filenameHint = behaviorHints.filename,
                titleHint = name ?: title,
                descriptionHint = description,
            )
        ) {
            return false
        }
        val hintExt = Cinema3DMediaCompatibility.extractPathExtension(behaviorHints.filename)
        // If torrent specifies a filename, require an explicit web container (.mp4 / .m4v / .webm / .mov)
        return hintExt == null || hintExt == "mp4" || hintExt == "m4v" || hintExt == "webm" || hintExt == "mov"
    }

    return false
}

