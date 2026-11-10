package com.nuvio.app.features.cinema3d

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ActivityInfo
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.nuvio.app.features.player.HidePlayerSystemBars
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FilterInputStream
import java.io.InputStream
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

private const val CINEMA_HOST = "cinema3d.cineultimate.local"

private val cinemaProxyHttpClient: OkHttpClient by lazy {
    OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()
}

private class AndroidCinemaJsBridge(
    private val mainHandler: Handler,
    private val onCloseRequested: () -> Unit,
    private val onToggleOrientationRequested: () -> Unit,
) {
    @JavascriptInterface
    fun closeCinema() {
        mainHandler.post(onCloseRequested)
    }

    @JavascriptInterface
    fun toggleOrientation() {
        mainHandler.post(onToggleOrientationRequested)
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
actual fun Cinema3DPlayerScreen(
    streamUrl: String?,
    title: String?,
    seat: String,
    lightsOn: Boolean,
    exploreOnly: Boolean,
    onExit: () -> Unit,
    modifier: Modifier,
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findCinemaActivity() }
    val currentOnExit by rememberUpdatedState(onExit)
    var isLandscapeLocked by remember { mutableStateOf(true) }
    var pendingFileCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    HidePlayerSystemBars()

    DisposableEffect(activity) {
        val prevOrientation = activity?.requestedOrientation ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        onDispose {
            activity?.requestedOrientation = prevOrientation
        }
    }

    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        val callback = pendingFileCallback
        pendingFileCallback = null
        if (uri != null) {
            callback?.onReceiveValue(arrayOf(uri))
        } else {
            callback?.onReceiveValue(null)
        }
    }

    BackHandler {
        webViewRef?.evaluateJavascript("try { document.getElementById('cinema-video')?.pause(); } catch(e) {}", null)
        currentOnExit()
    }

    val entryUrl = remember(streamUrl, title, seat, lightsOn, exploreOnly) {
        buildString {
            append("https://$CINEMA_HOST/index.html?seat=")
            append(URLEncoder.encode(seat, "UTF-8"))
            if (lightsOn) append("&lights=on")
            if (exploreOnly) append("&explore=1")
            if (!streamUrl.isNullOrBlank()) {
                append("&streamUrl=")
                append(URLEncoder.encode(streamUrl, "UTF-8"))
            }
            if (!title.isNullOrBlank()) {
                append("&title=")
                append(URLEncoder.encode(title, "UTF-8"))
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                val mainHandler = Handler(Looper.getMainLooper())
                WebView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                    setBackgroundColor(AndroidColor.BLACK)
                    setLayerType(View.LAYER_TYPE_HARDWARE, null)
                    keepScreenOn = true

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        databaseEnabled = true
                        mediaPlaybackRequiresUserGesture = false
                        allowFileAccess = true
                        allowContentAccess = true
                        mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                        cacheMode = WebSettings.LOAD_DEFAULT
                        useWideViewPort = true
                        loadWithOverviewMode = true
                        setSupportZoom(false)
                        builtInZoomControls = false
                        displayZoomControls = false
                    }

                    addJavascriptInterface(
                        AndroidCinemaJsBridge(
                            mainHandler = mainHandler,
                            onCloseRequested = {
                                evaluateJavascript("try { document.getElementById('cinema-video')?.pause(); } catch(e) {}", null)
                                currentOnExit()
                            },
                            onToggleOrientationRequested = {
                                isLandscapeLocked = !isLandscapeLocked
                                activity?.requestedOrientation = if (isLandscapeLocked) {
                                    ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                                } else {
                                    ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                                }
                            },
                        ),
                        "AndroidCinemaBridge",
                    )

                    webChromeClient = object : WebChromeClient() {
                        override fun onShowFileChooser(
                            webView: WebView?,
                            filePathCallback: ValueCallback<Array<Uri>>?,
                            fileChooserParams: FileChooserParams?,
                        ): Boolean {
                            pendingFileCallback?.onReceiveValue(null)
                            pendingFileCallback = filePathCallback
                            val acceptRaw = fileChooserParams?.acceptTypes?.joinToString(",")?.lowercase().orEmpty()
                            val mimeFilter = if (acceptRaw.contains("srt") || acceptRaw.contains("vtt")) {
                                arrayOf("application/x-subrip", "text/vtt", "text/plain", "application/octet-stream")
                            } else {
                                // Strict WebGL 3D screen compatible video formats only
                                arrayOf("video/mp4", "video/webm", "video/quicktime", "video/ogg")
                            }
                            return runCatching {
                                filePickerLauncher.launch(mimeFilter)
                                true
                            }.getOrElse {
                                pendingFileCallback = null
                                false
                            }
                        }
                    }

                    webViewClient = object : WebViewClient() {
                        override fun shouldInterceptRequest(
                            view: WebView?,
                            request: WebResourceRequest?,
                        ): WebResourceResponse? {
                            val req = request ?: return null
                            val uri = req.url ?: return null
                            if (!uri.host.equals(CINEMA_HOST, ignoreCase = true)) {
                                return super.shouldInterceptRequest(view, request)
                            }
                            return serveCinemaLocalOrProxiedResource(ctx, req)
                        }
                    }

                    webViewRef = this
                    loadUrl(entryUrl)
                }
            },
            onRelease = { webView ->
                webViewRef = null
                runCatching {
                    webView.loadUrl("about:blank")
                    webView.stopLoading()
                    webView.destroy()
                }
            },
        )
    }
}

private fun serveCinemaLocalOrProxiedResource(
    context: Context,
    request: WebResourceRequest,
): WebResourceResponse {
    val uri = request.url
    val rawPath = uri.path?.trimStart('/').orEmpty().ifBlank { "index.html" }
    val corsHeaders = mutableMapOf(
        "Access-Control-Allow-Origin" to "*",
        "Access-Control-Allow-Methods" to "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers" to "Range, Content-Type",
        "Access-Control-Expose-Headers" to "Content-Length, Content-Range, Accept-Ranges",
        "Cache-Control" to "no-store",
    )

    if (request.method.equals("OPTIONS", ignoreCase = true)) {
        return WebResourceResponse("text/plain", "UTF-8", 204, "No Content", corsHeaders, ByteArrayInputStream(ByteArray(0)))
    }

    // 1. Native App Compatible Catalog & Stream Resolver Endpoints
    if (rawPath == "api/cinema-catalog") {
        val json = Cinema3DCatalogBridge.buildCatalogJson().toByteArray(Charsets.UTF_8)
        return WebResourceResponse("application/json", "UTF-8", 200, "OK", corsHeaders, ByteArrayInputStream(json))
    }

    if (rawPath == "api/cinema-episodes") {
        val seriesId = uri.getQueryParameter("id").orEmpty()
        val json = Cinema3DCatalogBridge.buildEpisodesJson(seriesId).toByteArray(Charsets.UTF_8)
        return WebResourceResponse("application/json", "UTF-8", 200, "OK", corsHeaders, ByteArrayInputStream(json))
    }

    if (rawPath == "api/cinema-streams") {
        val type = uri.getQueryParameter("type").orEmpty().ifBlank { "movie" }
        val metaId = uri.getQueryParameter("id").orEmpty()
        val videoId = uri.getQueryParameter("videoId").orEmpty()
        val season = uri.getQueryParameter("season")?.toIntOrNull()
        val episode = uri.getQueryParameter("episode")?.toIntOrNull()
        val json = Cinema3DCatalogBridge.buildStreamsJson(
            type = type,
            metaId = metaId,
            videoId = videoId,
            season = season,
            episode = episode,
        ).toByteArray(Charsets.UTF_8)
        return WebResourceResponse("application/json", "UTF-8", 200, "OK", corsHeaders, ByteArrayInputStream(json))
    }

    if (rawPath == "api/local-download") {
        val downloadId = uri.getQueryParameter("id").orEmpty()
        val resolved = Cinema3DCatalogBridge.resolveDownloadedFileById(downloadId)
            ?: return WebResourceResponse(
                "text/plain",
                "UTF-8",
                404,
                "Not Found",
                corsHeaders,
                ByteArrayInputStream("Download file not found".toByteArray()),
            )
        return serveLocalFileWithRange(
            file = resolved.first,
            fileName = resolved.second,
            incomingHeaders = request.requestHeaders,
            baseCorsHeaders = corsHeaders,
        )
    }

    if (rawPath == "api/movies") {
        val json = """["Cinema_Demo_Test.mp4"]""".toByteArray(Charsets.UTF_8)
        return WebResourceResponse("application/json", "UTF-8", 200, "OK", corsHeaders, ByteArrayInputStream(json))
    }

    if (rawPath.startsWith("api/metadata/")) {
        val json = """{"audioTracks":[],"subtitleTracks":[]}""".toByteArray(Charsets.UTF_8)
        return WebResourceResponse("application/json", "UTF-8", 200, "OK", corsHeaders, ByteArrayInputStream(json))
    }

    // 2. Built-in OkHttp CORS Video Stream Proxy for external MP4 / WebM / HLS URLs
    if (rawPath == "api/proxy-video") {
        val targetUrl = uri.getQueryParameter("url")
        val customHeaders = Cinema3DCatalogBridge.decodeCustomProxyHeaders(uri.getQueryParameter("h"))
        if (!targetUrl.isNullOrBlank()) {
            return proxyRemoteVideoStream(targetUrl, request.requestHeaders, customHeaders, corsHeaders)
        }
    }

    // 3. Map /thumbnail/* and /stream/* to bundled assets
    val mappedAssetPath = when {
        rawPath.startsWith("thumbnail/") -> {
            val name = Uri.decode(rawPath.removePrefix("thumbnail/"))
            "cinema3d/thumbnails/$name.jpg"
        }
        rawPath.startsWith("stream/") -> {
            val name = Uri.decode(rawPath.removePrefix("stream/"))
            "cinema3d/movies/$name"
        }
        else -> "cinema3d/$rawPath"
    }

    val mimeType = guessCinemaMimeType(mappedAssetPath)

    // Support HTTP Range (206 Partial Content) for local MP4 video seeking
    if (mimeType.startsWith("video/")) {
        runCatching {
            context.assets.openFd(mappedAssetPath).use { afd ->
                val totalLength = afd.length
                val rangeHeader = request.requestHeaders["Range"] ?: request.requestHeaders["range"]
                var start = 0L
                var end = totalLength - 1L
                var isPartial = false

                if (!rangeHeader.isNullOrBlank() && rangeHeader.startsWith("bytes=")) {
                    val parts = rangeHeader.removePrefix("bytes=").split("-")
                    start = parts.getOrNull(0)?.toLongOrNull() ?: 0L
                    end = parts.getOrNull(1)?.takeIf { it.isNotBlank() }?.toLongOrNull() ?: (totalLength - 1L)
                    start = start.coerceIn(0L, (totalLength - 1L).coerceAtLeast(0L))
                    end = end.coerceIn(start, (totalLength - 1L).coerceAtLeast(0L))
                    isPartial = true
                }

                val contentLength = (end - start + 1L).coerceAtLeast(0L)
                val rawStream = context.assets.open(mappedAssetPath)
                if (start > 0L) rawStream.skip(start)
                val boundedStream = BoundedInputStream(rawStream, contentLength)

                val headers = HashMap(corsHeaders).apply {
                    put("Accept-Ranges", "bytes")
                    put("Content-Length", contentLength.toString())
                    if (isPartial) {
                        put("Content-Range", "bytes $start-$end/$totalLength")
                    }
                }
                return WebResourceResponse(
                    mimeType,
                    null,
                    if (isPartial) 206 else 200,
                    if (isPartial) "Partial Content" else "OK",
                    headers,
                    boundedStream,
                )
            }
        }
    }

    return runCatching {
        val stream = context.assets.open(mappedAssetPath)
        val encoding = if (mimeType.startsWith("text/") || mimeType.contains("javascript") || mimeType.contains("json")) "UTF-8" else null
        WebResourceResponse(mimeType, encoding, 200, "OK", corsHeaders, stream)
    }.getOrElse {
        WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", corsHeaders, ByteArrayInputStream("Not found: $mappedAssetPath".toByteArray()))
    }
}

private fun serveLocalFileWithRange(
    file: File,
    fileName: String,
    incomingHeaders: Map<String, String>,
    baseCorsHeaders: Map<String, String>,
): WebResourceResponse {
    return runCatching {
        val totalLength = file.length()
        val mimeType = guessCinemaMimeType(fileName).takeIf { it.startsWith("video/") } ?: "video/mp4"
        val rangeHeader = incomingHeaders["Range"] ?: incomingHeaders["range"]
        var start = 0L
        var end = (totalLength - 1L).coerceAtLeast(0L)
        var isPartial = false

        if (!rangeHeader.isNullOrBlank() && rangeHeader.startsWith("bytes=") && totalLength > 0L) {
            val parts = rangeHeader.removePrefix("bytes=").split("-")
            start = parts.getOrNull(0)?.toLongOrNull() ?: 0L
            end = parts.getOrNull(1)?.takeIf { it.isNotBlank() }?.toLongOrNull() ?: (totalLength - 1L)
            start = start.coerceIn(0L, totalLength - 1L)
            end = end.coerceIn(start, totalLength - 1L)
            isPartial = true
        }

        val contentLength = if (totalLength > 0L) (end - start + 1L).coerceAtLeast(0L) else 0L
        val fis = FileInputStream(file)
        if (start > 0L) {
            var remainingSkip = start
            while (remainingSkip > 0L) {
                val skipped = fis.skip(remainingSkip)
                if (skipped <= 0L) break
                remainingSkip -= skipped
            }
        }
        val bounded = BoundedInputStream(fis, contentLength)
        val headers = HashMap(baseCorsHeaders).apply {
            put("Accept-Ranges", "bytes")
            put("Content-Length", contentLength.toString())
            if (isPartial) {
                put("Content-Range", "bytes $start-$end/$totalLength")
            }
        }
        WebResourceResponse(
            mimeType,
            null,
            if (isPartial) 206 else 200,
            if (isPartial) "Partial Content" else "OK",
            headers,
            bounded,
        )
    }.getOrElse { err ->
        WebResourceResponse(
            "text/plain",
            "UTF-8",
            500,
            "Internal Server Error",
            baseCorsHeaders,
            ByteArrayInputStream(("Local file read error: ${err.message}").toByteArray()),
        )
    }
}

private fun proxyRemoteVideoStream(
    targetUrl: String,
    incomingHeaders: Map<String, String>,
    customStreamHeaders: Map<String, String>,
    baseCorsHeaders: Map<String, String>,
): WebResourceResponse {
    return runCatching {
        val reqBuilder = Request.Builder()
            .url(targetUrl)
            .header(
                "User-Agent",
                customStreamHeaders["User-Agent"]
                    ?: incomingHeaders["User-Agent"]
                    ?: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
            )

        customStreamHeaders.forEach { (k, v) ->
            if (!k.equals("User-Agent", ignoreCase = true) && !k.equals("Range", ignoreCase = true)) {
                reqBuilder.header(k, v)
            }
        }

        val range = incomingHeaders["Range"] ?: incomingHeaders["range"]
        if (!range.isNullOrBlank()) {
            reqBuilder.header("Range", range)
        }

        val response = cinemaProxyHttpClient.newCall(reqBuilder.build()).execute()
        val rawBody = response.body
        val contentTypeHeader = response.header("Content-Type") ?: "video/mp4"
        val mimeType = contentTypeHeader.substringBefore(";").trim().ifBlank { "video/mp4" }

        val responseHeaders = HashMap(baseCorsHeaders)
        listOf("Content-Length", "Content-Range", "Accept-Ranges").forEach { headerName ->
            response.header(headerName)?.let { value ->
                responseHeaders[headerName] = value
            }
        }
        if ("Accept-Ranges" !in responseHeaders) {
            responseHeaders["Accept-Ranges"] = "bytes"
        }

        val stream: InputStream = if (rawBody != null) {
            object : FilterInputStream(rawBody.byteStream()) {
                override fun close() {
                    super.close()
                    rawBody.close()
                    response.close()
                }
            }
        } else {
            response.close()
            ByteArrayInputStream(ByteArray(0))
        }

        WebResourceResponse(
            mimeType,
            null,
            response.code,
            response.message.ifBlank { "OK" },
            responseHeaders,
            stream,
        )
    }.getOrElse { err ->
        WebResourceResponse(
            "text/plain",
            "UTF-8",
            502,
            "Bad Gateway",
            baseCorsHeaders,
            ByteArrayInputStream(("Stream proxy error: ${err.message}").toByteArray()),
        )
    }
}

private class BoundedInputStream(
    private val delegate: InputStream,
    private var remaining: Long,
) : InputStream() {
    override fun read(): Int {
        if (remaining <= 0L) return -1
        val b = delegate.read()
        if (b != -1) remaining--
        return b
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
        if (remaining <= 0L) return -1
        val toRead = minOf(len.toLong(), remaining).toInt()
        val count = delegate.read(b, off, toRead)
        if (count > 0) remaining -= count
        return count
    }

    override fun close() {
        delegate.close()
    }
}

private fun guessCinemaMimeType(path: String): String = when {
    path.endsWith(".html", ignoreCase = true) -> "text/html"
    path.endsWith(".css", ignoreCase = true) -> "text/css"
    path.endsWith(".js", ignoreCase = true) || path.endsWith(".mjs", ignoreCase = true) -> "text/javascript"
    path.endsWith(".json", ignoreCase = true) -> "application/json"
    path.endsWith(".mp4", ignoreCase = true) || path.endsWith(".m4v", ignoreCase = true) -> "video/mp4"
    path.endsWith(".webm", ignoreCase = true) -> "video/webm"
    path.endsWith(".mov", ignoreCase = true) -> "video/quicktime"
    path.endsWith(".ogv", ignoreCase = true) -> "video/ogg"
    path.endsWith(".m3u8", ignoreCase = true) -> "application/vnd.apple.mpegurl"
    path.endsWith(".jpg", ignoreCase = true) || path.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
    path.endsWith(".png", ignoreCase = true) -> "image/png"
    path.endsWith(".svg", ignoreCase = true) -> "image/svg+xml"
    path.endsWith(".vtt", ignoreCase = true) -> "text/vtt"
    else -> "application/octet-stream"
}

private tailrec fun Context.findCinemaActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findCinemaActivity()
    else -> null
}
