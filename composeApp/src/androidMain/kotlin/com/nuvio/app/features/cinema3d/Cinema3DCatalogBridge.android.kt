package com.nuvio.app.features.cinema3d

import android.net.Uri
import android.util.Base64
import com.nuvio.app.core.build.AppFeaturePolicy
import com.nuvio.app.features.addons.AddonRepository
import com.nuvio.app.features.addons.buildAddonResourceUrl
import com.nuvio.app.features.addons.enabledAddons
import com.nuvio.app.features.addons.fetchAddonResponseText
import com.nuvio.app.features.addons.supportsResource
import com.nuvio.app.features.debrid.DebridSettingsRepository
import com.nuvio.app.features.debrid.DirectDebridPlayableResult
import com.nuvio.app.features.debrid.DirectDebridPlaybackResolver
import com.nuvio.app.features.details.MetaDetailsRepository
import com.nuvio.app.features.downloads.DownloadItem
import com.nuvio.app.features.downloads.DownloadStatus
import com.nuvio.app.features.downloads.DownloadsRepository
import com.nuvio.app.features.home.HomeRepository
import com.nuvio.app.features.home.MetaPreview
import com.nuvio.app.features.library.LibraryRepository
import com.nuvio.app.features.library.toMetaPreview
import com.nuvio.app.features.plugins.PluginRepository
import com.nuvio.app.features.plugins.pluginContentId
import com.nuvio.app.features.servers.ServerPlayback
import com.nuvio.app.features.servers.ServerRepository
import com.nuvio.app.features.servers.ServerStreams
import com.nuvio.app.features.streams.StreamItem
import com.nuvio.app.features.streams.StreamParser
import com.nuvio.app.features.streams.streamAddonInstanceId
import com.nuvio.app.features.streams.toStreamItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URI
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap

internal data class CinemaResolvedStreamOption(
    val label: String,
    val subtitle: String?,
    val playbackUrl: String,
    val isDirectLocalOrHls: Boolean,
)

private data class BuiltinEpisode(
    val videoId: String,
    val season: Int,
    val episode: Int,
    val title: String,
    val overview: String,
    val thumbnail: String,
    val streamUrl: String,
    val isDirectLocal: Boolean = false,
)

private data class BuiltinCatalogEntry(
    val id: String,
    val type: String, // "movie" or "series"
    val title: String,
    val badge: String,
    val year: String,
    val description: String,
    val thumb: String,
    val directUrl: String? = null,
    val isDirectLocal: Boolean = false,
    val episodes: List<BuiltinEpisode> = emptyList(),
)

internal object Cinema3DCatalogBridge {

    private data class CachedProbe(
        val compatible: Boolean,
        val timestampMs: Long,
    )

    private val probeCache = ConcurrentHashMap<String, CachedProbe>()
    private const val PROBE_TTL_MS = 10 * 60 * 1000L

    private val builtinCatalog: List<BuiltinCatalogEntry> = listOf(
        BuiltinCatalogEntry(
            id = "builtin_movie_demo_3d",
            type = "movie",
            title = "Sessão Demo IMAX 3D",
            badge = "FILME • LOCAL",
            year = "2025",
            description = "Sessão de demonstração embutida no app para teste imediato no telão curvo IMAX 3D.",
            thumb = "thumbnails/Cinema_Demo_Test.mp4.jpg",
            directUrl = "movies/Cinema_Demo_Test.mp4",
            isDirectLocal = true,
        ),
        BuiltinCatalogEntry(
            id = "builtin_movie_tears_of_steel",
            type = "movie",
            title = "Tears of Steel",
            badge = "FILME • SCI-FI HD",
            year = "2012",
            description = "Ficção científica em Amsterdã futurista com projeção panorâmica e áudio espacial 5.1.",
            thumb = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg",
            directUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        ),
        BuiltinCatalogEntry(
            id = "builtin_movie_sintel",
            type = "movie",
            title = "Sintel — Edição Cinema",
            badge = "FILME • FANTASIA",
            year = "2010",
            description = "Uma guerreira solitária atravessa terras místicas em busca de seu jovem dragão Scales.",
            thumb = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg",
            directUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        ),
        BuiltinCatalogEntry(
            id = "builtin_movie_big_buck_bunny",
            type = "movie",
            title = "Big Buck Bunny",
            badge = "FILME • ANIMAÇÃO",
            year = "2008",
            description = "Comédia de animação em alta definição compatível com projeção WebGL e som surround.",
            thumb = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
            directUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        ),
        BuiltinCatalogEntry(
            id = "builtin_movie_elephants_dream",
            type = "movie",
            title = "Elephants Dream",
            badge = "FILME • SCI-FI",
            year = "2006",
            description = "Dois personagens exploram o interior surreal de uma imensa máquina viva.",
            thumb = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
            directUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        ),
        BuiltinCatalogEntry(
            id = "builtin_movie_oceans",
            type = "movie",
            title = "Oceans — Documentário IMAX",
            badge = "FILME • DOC",
            year = "2015",
            description = "Mergulho cinematográfico pela vida marinha projetado na tela curva do Cinema 3D.",
            thumb = "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&q=80",
            directUrl = "https://vjs.zencdn.net/v/oceans.mp4",
        ),
        BuiltinCatalogEntry(
            id = "builtin_series_cronicas_imax",
            type = "series",
            title = "Crônicas IMAX: Mundos Fantásticos",
            badge = "SÉRIE • 2 TEMP",
            year = "2024",
            description = "Antologia de ficção científica e fantasia com temporadas e episódios compatíveis com o telão 3D.",
            thumb = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg",
            episodes = listOf(
                BuiltinEpisode(
                    videoId = "builtin_series_cronicas_imax:1:1",
                    season = 1,
                    episode = 1,
                    title = "A Resistência em Amsterdã",
                    overview = "Cientistas e guerreiros tentam reverter a crise dos robôs no domo central.",
                    thumbnail = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg",
                    streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                ),
                BuiltinEpisode(
                    videoId = "builtin_series_cronicas_imax:1:2",
                    season = 1,
                    episode = 2,
                    title = "A Guardiã do Dragão",
                    overview = "A travessia pelas montanhas geladas até o covil ancestral.",
                    thumbnail = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg",
                    streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
                ),
                BuiltinEpisode(
                    videoId = "builtin_series_cronicas_imax:1:3",
                    season = 1,
                    episode = 3,
                    title = "Engrenagens da Mente",
                    overview = "Proog e Emo confrontam os limites da máquina infinita.",
                    thumbnail = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
                    streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                ),
                BuiltinEpisode(
                    videoId = "builtin_series_cronicas_imax:2:1",
                    season = 2,
                    episode = 1,
                    title = "Transmissão Especial HLS",
                    overview = "Episódio transmitido via protocolo adaptativo HLS (.m3u8) na tela curva.",
                    thumbnail = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
                    streamUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                    isDirectLocal = true,
                ),
                BuiltinEpisode(
                    videoId = "builtin_series_cronicas_imax:2:2",
                    season = 2,
                    episode = 2,
                    title = "A Floresta em Festa",
                    overview = "Aventura completa em alta taxa de quadros e som espacial.",
                    thumbnail = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
                    streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                ),
            ),
        ),
        BuiltinCatalogEntry(
            id = "builtin_series_motores_expedicoes",
            type = "series",
            title = "Motores & Expedições HD",
            badge = "SÉRIE • 1 TEMP",
            year = "2023",
            description = "Série documental automotiva com múltiplos episódios prontos para reprodução no telão 3D.",
            thumb = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg",
            episodes = listOf(
                BuiltinEpisode(
                    videoId = "builtin_series_motores_expedicoes:1:1",
                    season = 1,
                    episode = 1,
                    title = "Asfalto & Terra Off-Road",
                    overview = "Teste completo em trilhas e estradas de montanha.",
                    thumbnail = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg",
                    streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
                ),
                BuiltinEpisode(
                    videoId = "builtin_series_motores_expedicoes:1:2",
                    season = 1,
                    episode = 2,
                    title = "Rota Bullrun Coast-to-Coast",
                    overview = "Preparação e largada do rali pelas rodovias.",
                    thumbnail = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/WeAreGoingOnBullrun.jpg",
                    streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
                ),
                BuiltinEpisode(
                    videoId = "builtin_series_motores_expedicoes:1:3",
                    season = 1,
                    episode = 3,
                    title = "Especial Pista GTI",
                    overview = "Análise dinâmica em circuito fechado.",
                    thumbnail = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/VolkswagenGTIReview.jpg",
                    streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
                ),
            ),
        ),
    )

    fun buildCatalogJson(): String = runBlocking(Dispatchers.IO) {
        ensureRepositoriesInitialized()
        val debridEnabled = DebridSettingsRepository.snapshot().canResolvePlayableLinks
        val itemsArray = JSONArray()
        val seenKeys = LinkedHashSet<String>()

        // 1. Compatible local downloads from DownloadsRepository (Movies + Grouped Series)
        val completedDownloads = DownloadsRepository.uiState.value.completedItems
        val compatibleMovieDownloads = mutableListOf<DownloadItem>()
        val compatibleSeriesDownloads = LinkedHashMap<String, MutableList<DownloadItem>>()

        for (download in completedDownloads) {
            val file = resolveDownloadedFile(download) ?: continue
            if (!Cinema3DMediaCompatibility.isUrlCompatible(
                    url = "file://${file.absolutePath}",
                    filenameHint = download.fileName,
                    titleHint = download.streamTitle,
                    descriptionHint = download.streamSubtitle,
                )
            ) {
                continue
            }
            if (download.isEpisode) {
                compatibleSeriesDownloads.getOrPut(download.parentMetaId) { mutableListOf() }.add(download)
            } else {
                compatibleMovieDownloads.add(download)
            }
        }

        for (movieDl in compatibleMovieDownloads) {
            val key = "movie:${movieDl.parentMetaId}"
            seenKeys.add(key)
            val dlUrl = "/api/local-download?id=${URLEncoder.encode(movieDl.id, "UTF-8")}"
            itemsArray.put(
                JSONObject().apply {
                    put("id", movieDl.parentMetaId)
                    put("videoId", movieDl.videoId)
                    put("type", "movie")
                    put("title", movieDl.title)
                    put("badge", "BAIXADO • FILME")
                    put("thumb", movieDl.poster ?: movieDl.background ?: "")
                    put("description", movieDl.streamSubtitle ?: "Arquivo compatível salvo no aparelho.")
                    put("directUrl", dlUrl)
                    put("isDirectLocal", true)
                },
            )
        }

        for ((seriesId, epDownloads) in compatibleSeriesDownloads) {
            val first = epDownloads.first()
            val key = "series:$seriesId"
            seenKeys.add(key)
            itemsArray.put(
                JSONObject().apply {
                    put("id", seriesId)
                    put("type", "series")
                    put("title", first.title)
                    put("badge", "BAIXADO • SÉRIE (${epDownloads.size} EP)")
                    put("thumb", first.poster ?: first.background ?: first.episodeThumbnail ?: "")
                    put("description", "Episódios compatíveis salvos no aparelho.")
                },
            )
        }

        // 2. App Catalog Items (Library + Home sections), strictly filtered by stream compatibility
        val hasOnlineCapableProviders = hasCompatibleStreamProviders(debridEnabled)
        if (hasOnlineCapableProviders) {
            val candidates = collectAppCatalogCandidates(seenKeys)
            if (candidates.isNotEmpty()) {
                val semaphore = Semaphore(6)
                val verified = coroutineScope {
                    candidates.map { candidate ->
                        async {
                            semaphore.withPermit {
                                val ok = isCatalogItemCompatibleCached(candidate, debridEnabled)
                                if (ok) candidate else null
                            }
                        }
                    }.awaitAll().filterNotNull()
                }

                for (item in verified) {
                    val normalizedType = normalizeMediaType(item.type) ?: continue
                    val key = "$normalizedType:${item.id}"
                    if (!seenKeys.add(key)) continue
                    itemsArray.put(
                        JSONObject().apply {
                            put("id", item.id)
                            put("type", normalizedType)
                            put("title", item.name)
                            put(
                                "badge",
                                if (normalizedType == "series") "SÉRIE • CATÁLOGO" else "FILME • CATÁLOGO",
                            )
                            put("year", item.releaseInfo.orEmpty())
                            put("thumb", item.landscapePoster ?: item.poster ?: item.banner ?: "")
                            put("description", item.description.orEmpty())
                        },
                    )
                }
            }
        }

        // 3. Built-in 100% WebGL-Compatible Filmes & Séries
        for (entry in builtinCatalog) {
            if (entry.directUrl != null && !Cinema3DMediaCompatibility.isUrlCompatible(entry.directUrl)) {
                continue
            }
            itemsArray.put(
                JSONObject().apply {
                    put("id", entry.id)
                    put("type", entry.type)
                    put("title", entry.title)
                    put("badge", entry.badge)
                    put("year", entry.year)
                    put("thumb", entry.thumb)
                    put("description", entry.description)
                    if (entry.directUrl != null) {
                        put("directUrl", entry.directUrl)
                        put("isDirectLocal", entry.isDirectLocal)
                    }
                },
            )
        }

        JSONObject().apply {
            put("hasCompatibleProviders", hasOnlineCapableProviders || completedDownloads.isNotEmpty())
            put("items", itemsArray)
        }.toString()
    }

    fun buildEpisodesJson(seriesId: String): String = runBlocking(Dispatchers.IO) {
        ensureRepositoriesInitialized()
        val debridEnabled = DebridSettingsRepository.snapshot().canResolvePlayableLinks
        val episodesArray = JSONArray()

        // 1. Check Built-in Series
        builtinCatalog.firstOrNull { it.id == seriesId && it.type == "series" }?.let { builtin ->
            for (ep in builtin.episodes) {
                if (!Cinema3DMediaCompatibility.isUrlCompatible(ep.streamUrl)) continue
                episodesArray.put(
                    JSONObject().apply {
                        put("videoId", ep.videoId)
                        put("season", ep.season)
                        put("episode", ep.episode)
                        put("title", ep.title)
                        put("overview", ep.overview)
                        put("thumbnail", ep.thumbnail)
                        put("directUrl", ep.streamUrl)
                        put("isDirectLocal", ep.isDirectLocal)
                    },
                )
            }
            return@runBlocking JSONObject().apply {
                put("id", builtin.id)
                put("title", builtin.title)
                put("episodes", episodesArray)
            }.toString()
        }

        // 2. Check Downloaded Episodes for this series
        val downloadedBySeasonEp = LinkedHashMap<Pair<Int, Int>, DownloadItem>()
        for (dl in DownloadsRepository.uiState.value.completedItems) {
            if (!dl.isEpisode || dl.parentMetaId != seriesId) continue
            val file = resolveDownloadedFile(dl) ?: continue
            if (!Cinema3DMediaCompatibility.isUrlCompatible(
                    url = "file://${file.absolutePath}",
                    filenameHint = dl.fileName,
                    titleHint = dl.streamTitle,
                    descriptionHint = dl.streamSubtitle,
                )
            ) {
                continue
            }
            val s = dl.seasonNumber ?: continue
            val e = dl.episodeNumber ?: continue
            downloadedBySeasonEp[s to e] = dl
        }

        val hasOnlineProviders = hasCompatibleStreamProviders(debridEnabled)
        val meta = if (hasOnlineProviders) {
            withTimeoutOrNull(10_000L) {
                runCatching { MetaDetailsRepository.fetch("series", seriesId) }.getOrNull()
            }
        } else {
            MetaDetailsRepository.peek("series", seriesId)
        }

        if (meta != null && meta.videos.isNotEmpty()) {
            val sortedVideos = meta.videos
                .filter { (it.season ?: 0) > 0 && (it.episode ?: 0) > 0 }
                .sortedWith(compareBy<com.nuvio.app.features.details.MetaVideo> { it.season ?: 1 }.thenBy { it.episode ?: 1 })

            for (video in sortedVideos) {
                val s = video.season ?: 1
                val e = video.episode ?: 1
                val dl = downloadedBySeasonEp[s to e]

                // If the video only has embedded streams (and no external stream providers), verify compatibility
                if (dl == null && video.streams.isNotEmpty()) {
                    val hasCompatibleEmbedded = video.streams.any { it.isCompatibleWithCinema3D(debridEnabled) }
                    if (!hasCompatibleEmbedded && !hasExternalStreamProvidersForSeries(video.id, debridEnabled)) {
                        continue
                    }
                } else if (dl == null && !hasOnlineProviders) {
                    continue
                }

                episodesArray.put(
                    JSONObject().apply {
                        put("videoId", video.id.ifBlank { "$seriesId:$s:$e" })
                        put("season", s)
                        put("episode", e)
                        put("title", video.title.ifBlank { "Episódio $e" })
                        put("overview", video.overview.orEmpty())
                        put("thumbnail", video.thumbnail ?: video.seasonPoster ?: meta.poster ?: "")
                        if (dl != null) {
                            put("directUrl", "/api/local-download?id=${URLEncoder.encode(dl.id, "UTF-8")}")
                            put("isDirectLocal", true)
                            put("downloaded", true)
                        }
                    },
                )
            }
        } else {
            // Offline / Download-only series episodes
            val sortedDownloads = downloadedBySeasonEp.values.sortedWith(
                compareBy<DownloadItem> { it.seasonNumber ?: 1 }.thenBy { it.episodeNumber ?: 1 },
            )
            for (dl in sortedDownloads) {
                val s = dl.seasonNumber ?: 1
                val e = dl.episodeNumber ?: 1
                episodesArray.put(
                    JSONObject().apply {
                        put("videoId", dl.videoId)
                        put("season", s)
                        put("episode", e)
                        put("title", dl.episodeTitle?.takeIf { it.isNotBlank() } ?: "Episódio $e")
                        put("overview", dl.streamSubtitle.orEmpty())
                        put("thumbnail", dl.episodeThumbnail ?: dl.poster ?: "")
                        put("directUrl", "/api/local-download?id=${URLEncoder.encode(dl.id, "UTF-8")}")
                        put("isDirectLocal", true)
                        put("downloaded", true)
                    },
                )
            }
        }

        JSONObject().apply {
            put("id", seriesId)
            put("title", meta?.name ?: downloadedBySeasonEp.values.firstOrNull()?.title ?: "Série")
            put("episodes", episodesArray)
        }.toString()
    }

    fun buildStreamsJson(
        type: String,
        metaId: String,
        videoId: String,
        season: Int?,
        episode: Int?,
    ): String = runBlocking(Dispatchers.IO) {
        ensureRepositoriesInitialized()
        val normalizedType = normalizeMediaType(type) ?: "movie"
        val effectiveVideoId = videoId.ifBlank {
            if (normalizedType == "series" && season != null && episode != null) "$metaId:$season:$episode" else metaId
        }

        // Check built-in items first
        builtinCatalog.firstOrNull { it.id == metaId }?.let { builtin ->
            val streamsArr = JSONArray()
            if (builtin.type == "movie" && builtin.directUrl != null) {
                streamsArr.put(
                    JSONObject().apply {
                        put("label", builtin.badge)
                        put("subtitle", builtin.title)
                        put("url", wrapForCinemaPlayback(builtin.directUrl, emptyMap(), builtin.isDirectLocal))
                        put("direct", true)
                    },
                )
            } else if (builtin.type == "series") {
                val ep = builtin.episodes.firstOrNull {
                    it.videoId == effectiveVideoId || (it.season == season && it.episode == episode)
                }
                if (ep != null) {
                    streamsArr.put(
                        JSONObject().apply {
                            put("label", "T${ep.season}:E${ep.episode} • HD Compatível")
                            put("subtitle", ep.title)
                            put("url", wrapForCinemaPlayback(ep.streamUrl, emptyMap(), ep.isDirectLocal))
                            put("direct", true)
                        },
                    )
                }
            }
            return@runBlocking JSONObject().apply {
                put("streams", streamsArr)
            }.toString()
        }

        val options = resolveCompatibleStreamOptions(
            type = normalizedType,
            metaId = metaId,
            videoId = effectiveVideoId,
            season = season,
            episode = episode,
            resolveDebridNow = true,
            timeoutMs = 12_000L,
        )

        val streamsArr = JSONArray()
        for (opt in options) {
            streamsArr.put(
                JSONObject().apply {
                    put("label", opt.label)
                    put("subtitle", opt.subtitle.orEmpty())
                    put("url", opt.playbackUrl)
                    put("direct", opt.isDirectLocalOrHls)
                },
            )
        }

        JSONObject().apply {
            put("streams", streamsArr)
        }.toString()
    }

    fun resolveDownloadedFileById(downloadId: String): Pair<File, String>? {
        DownloadsRepository.ensureLoaded()
        val item = DownloadsRepository.uiState.value.items.firstOrNull {
            it.id == downloadId && it.status == DownloadStatus.Completed
        } ?: return null
        val file = resolveDownloadedFile(item) ?: return null
        return file to item.fileName
    }

    fun decodeCustomProxyHeaders(encodedHeaders: String?): Map<String, String> {
        if (encodedHeaders.isNullOrBlank()) return emptyMap()
        return runCatching {
            val jsonBytes = Base64.decode(encodedHeaders, Base64.URL_SAFE or Base64.NO_WRAP)
            val obj = JSONObject(String(jsonBytes, Charsets.UTF_8))
            val map = LinkedHashMap<String, String>()
            val keys = obj.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                val v = obj.optString(k, "")
                if (k.isNotBlank() && v.isNotBlank()) {
                    map[k] = v
                }
            }
            map
        }.getOrDefault(emptyMap())
    }

    private fun resolveDownloadedFile(item: DownloadItem): File? {
        val localUri = DownloadsRepository.playableLocalFileUri(item) ?: item.localFileUri ?: return null
        val trimmed = localUri.trim()
        val file = runCatching {
            if (trimmed.startsWith("file://", ignoreCase = true)) {
                File(URI(trimmed))
            } else {
                File(trimmed)
            }
        }.getOrNull() ?: return null
        return file.takeIf { it.exists() && it.isFile && it.length() > 0L }
    }

    private suspend fun ensureRepositoriesInitialized() {
        AddonRepository.initialize()
        DownloadsRepository.ensureLoaded()
        LibraryRepository.ensureLoaded()
        ServerRepository.ensureLoaded()
        DebridSettingsRepository.ensureLoaded()
        if (AppFeaturePolicy.pluginsEnabled) {
            PluginRepository.initialize()
        }

        val addonsState = AddonRepository.uiState.value
        val enabled = addonsState.addons.enabledAddons()
        if (enabled.isNotEmpty() && HomeRepository.uiState.value.sections.isEmpty() && !HomeRepository.uiState.value.isLoading) {
            HomeRepository.refresh(enabled, force = false)
        }
        if (HomeRepository.uiState.value.sections.isEmpty() && HomeRepository.uiState.value.isLoading) {
            var waited = 0L
            while (HomeRepository.uiState.value.sections.isEmpty() && HomeRepository.uiState.value.isLoading && waited < 2_200L) {
                delay(150L)
                waited += 150L
            }
        }
    }

    private fun hasCompatibleStreamProviders(debridEnabled: Boolean): Boolean {
        if (ServerRepository.enabledConnections().isNotEmpty()) return true
        if (AppFeaturePolicy.pluginsEnabled) {
            if (PluginRepository.getEnabledScrapersForType("movie").isNotEmpty() ||
                PluginRepository.getEnabledScrapersForType("series").isNotEmpty()
            ) {
                return true
            }
        }
        val enabledAddons = AddonRepository.uiState.value.addons.enabledAddons()
        return enabledAddons.any { addon ->
            val manifest = addon.manifest ?: return@any false
            val hasStreamResource = manifest.resources.any { it.name == "stream" }
            if (!hasStreamResource) return@any false
            if (manifest.behaviorHints.p2p && !debridEnabled) return@any false
            true
        }
    }

    private fun hasExternalStreamProvidersForSeries(videoId: String, debridEnabled: Boolean): Boolean {
        if (ServerStreams.canServe("series", videoId)) return true
        if (AppFeaturePolicy.pluginsEnabled && PluginRepository.getEnabledScrapersForType("series").isNotEmpty()) {
            return true
        }
        val enabledAddons = AddonRepository.uiState.value.addons.enabledAddons()
        return enabledAddons.any { addon ->
            val manifest = addon.manifest ?: return@any false
            if (manifest.behaviorHints.p2p && !debridEnabled) return@any false
            manifest.supportsResource("stream", "series", videoId)
        }
    }

    private fun collectAppCatalogCandidates(alreadyIncluded: Set<String>): List<MetaPreview> {
        val result = ArrayList<MetaPreview>(24)
        val seen = HashSet(alreadyIncluded)

        for (libItem in LibraryRepository.uiState.value.items) {
            val normType = normalizeMediaType(libItem.type) ?: continue
            val key = "$normType:${libItem.id}"
            if (seen.add(key)) {
                result.add(libItem.toMetaPreview().copy(type = normType))
                if (result.size >= 24) return result
            }
        }

        for (section in HomeRepository.uiState.value.sections) {
            for (item in section.items) {
                val normType = normalizeMediaType(item.type) ?: continue
                val key = "$normType:${item.id}"
                if (seen.add(key)) {
                    result.add(item.copy(type = normType))
                    if (result.size >= 24) return result
                }
            }
        }

        return result
    }

    private suspend fun isCatalogItemCompatibleCached(item: MetaPreview, debridEnabled: Boolean): Boolean {
        val normType = normalizeMediaType(item.type) ?: return false
        val cacheKey = "$normType:${item.id}:debrid=$debridEnabled"
        val now = System.currentTimeMillis()
        probeCache[cacheKey]?.let { cached ->
            if (now - cached.timestampMs < PROBE_TTL_MS) {
                return cached.compatible
            }
        }

        val compatible = if (normType == "movie") {
            val options = resolveCompatibleStreamOptions(
                type = "movie",
                metaId = item.id,
                videoId = item.id,
                season = null,
                episode = null,
                resolveDebridNow = false,
                timeoutMs = 3_800L,
            )
            options.isNotEmpty()
        } else {
            val meta = withTimeoutOrNull(3_500L) {
                runCatching { MetaDetailsRepository.fetch("series", item.id) }.getOrNull()
            }
            val firstVideo = meta?.videos
                ?.filter { (it.season ?: 0) > 0 && (it.episode ?: 0) > 0 }
                ?.minWithOrNull(compareBy<com.nuvio.app.features.details.MetaVideo> { it.season ?: 1 }.thenBy { it.episode ?: 1 })

            if (firstVideo != null && firstVideo.streams.any { it.isCompatibleWithCinema3D(debridEnabled) }) {
                true
            } else {
                val probeVideoId = firstVideo?.id?.takeIf { it.isNotBlank() } ?: "${item.id}:1:1"
                val probeSeason = firstVideo?.season ?: 1
                val probeEpisode = firstVideo?.episode ?: 1
                val options = resolveCompatibleStreamOptions(
                    type = "series",
                    metaId = item.id,
                    videoId = probeVideoId,
                    season = probeSeason,
                    episode = probeEpisode,
                    resolveDebridNow = false,
                    timeoutMs = 3_800L,
                )
                options.isNotEmpty()
            }
        }

        probeCache[cacheKey] = CachedProbe(compatible = compatible, timestampMs = now)
        return compatible
    }

    private suspend fun resolveCompatibleStreamOptions(
        type: String,
        metaId: String,
        videoId: String,
        season: Int?,
        episode: Int?,
        resolveDebridNow: Boolean,
        timeoutMs: Long,
    ): List<CinemaResolvedStreamOption> {
        val debridEnabled = DebridSettingsRepository.snapshot().canResolvePlayableLinks
        val results = ArrayList<CinemaResolvedStreamOption>()

        // 1. Local Download check
        val localDl = DownloadsRepository.findPlayableDownload(
            parentMetaId = metaId,
            seasonNumber = season,
            episodeNumber = episode,
            videoId = videoId,
        )
        if (localDl != null) {
            val file = resolveDownloadedFile(localDl)
            if (file != null && Cinema3DMediaCompatibility.isUrlCompatible(
                    url = "file://${file.absolutePath}",
                    filenameHint = localDl.fileName,
                    titleHint = localDl.streamTitle,
                    descriptionHint = localDl.streamSubtitle,
                )
            ) {
                results.add(
                    CinemaResolvedStreamOption(
                        label = "No Aparelho • ${localDl.providerName}",
                        subtitle = localDl.streamTitle,
                        playbackUrl = "/api/local-download?id=${URLEncoder.encode(localDl.id, "UTF-8")}",
                        isDirectLocalOrHls = true,
                    ),
                )
            }
        }

        // 2. Gather Raw StreamItems from Embedded Meta, Servers, Addons, and Plugins
        val rawStreams = withTimeoutOrNull(timeoutMs) {
            coroutineScope {
                val deferredList = mutableListOf<kotlinx.coroutines.Deferred<List<StreamItem>>>()

                deferredList += async {
                    val activeEmbedded = MetaDetailsRepository.findEmbeddedStreams(videoId)
                    if (activeEmbedded.isNotEmpty()) {
                        activeEmbedded
                    } else {
                        val fetched = runCatching { MetaDetailsRepository.peek(type, metaId) }.getOrNull()
                        fetched?.videos
                            ?.firstOrNull { it.id == videoId || (season != null && it.season == season && it.episode == episode) }
                            ?.streams
                            .orEmpty()
                    }
                }

                val isNativeServer = ServerStreams.isNativeRequest(videoId)
                val serverSources = ServerStreams.sources(type, videoId, season, episode, forceRefresh = false)
                for (source in serverSources) {
                    deferredList += async {
                        runCatching { source.load().streams }.getOrDefault(emptyList())
                    }
                }

                if (!isNativeServer) {
                    val enabledAddons = AddonRepository.uiState.value.addons.enabledAddons()
                    for (addon in enabledAddons) {
                        val manifest = addon.manifest ?: continue
                        if (manifest.behaviorHints.p2p && !debridEnabled) continue
                        if (!manifest.supportsResource("stream", type, videoId)) continue
                        deferredList += async {
                            runCatching {
                                val url = buildAddonResourceUrl(
                                    manifestUrl = manifest.transportUrl,
                                    resource = "stream",
                                    type = type,
                                    id = videoId,
                                )
                                val payload = fetchAddonResponseText(url = url, forceRefresh = false)
                                StreamParser.parse(
                                    payload = payload,
                                    addonName = addon.displayTitle.ifBlank { manifest.name },
                                    addonId = addon.streamAddonInstanceId(manifest.id),
                                    addonLogo = manifest.logoUrl,
                                )
                            }.getOrDefault(emptyList())
                        }
                    }

                    if (AppFeaturePolicy.pluginsEnabled) {
                        val scrapers = PluginRepository.getEnabledScrapersForType(type)
                        for (scraper in scrapers) {
                            deferredList += async {
                                runCatching {
                                    PluginRepository.executeScraper(
                                        scraper = scraper,
                                        tmdbId = pluginContentId(videoId = videoId, season = season, episode = episode),
                                        mediaType = type,
                                        season = season,
                                        episode = episode,
                                    ).getOrNull()?.map { it.toStreamItem(scraper = scraper) }.orEmpty()
                                }.getOrDefault(emptyList())
                            }
                        }
                    }
                }

                deferredList.awaitAll().flatten()
            }
        }.orEmpty()

        val compatibleCandidates = rawStreams.filter { it.isCompatibleWithCinema3D(debridEnabled) }

        var debridResolvedCount = 0
        for (stream in compatibleCandidates) {
            var directUrl = stream.playableDirectUrl
            var effectiveHeaders = stream.behaviorHints.proxyHeaders?.request.orEmpty()
            var effectiveFilename = stream.behaviorHints.filename

            if (directUrl == null && stream.needsServerPreparation) {
                if (!resolveDebridNow) {
                    results.add(
                        CinemaResolvedStreamOption(
                            label = "${stream.addonName} • ${stream.streamLabel}",
                            subtitle = stream.streamSubtitle,
                            playbackUrl = "",
                            isDirectLocalOrHls = false,
                        ),
                    )
                    continue
                }
                val prepared = runCatching { ServerPlayback.prepare(stream) }.getOrNull() ?: continue
                directUrl = prepared.playableDirectUrl
                effectiveHeaders = prepared.behaviorHints.proxyHeaders?.request.orEmpty()
                effectiveFilename = prepared.behaviorHints.filename
            } else if (directUrl == null && debridEnabled && DirectDebridPlaybackResolver.shouldResolveToPlayableStream(stream)) {
                if (!resolveDebridNow) {
                    results.add(
                        CinemaResolvedStreamOption(
                            label = "${stream.addonName} • ${stream.streamLabel}",
                            subtitle = stream.streamSubtitle,
                            playbackUrl = "",
                            isDirectLocalOrHls = false,
                        ),
                    )
                    continue
                }
                if (debridResolvedCount >= 2) continue
                debridResolvedCount++
                val resolved = runCatching {
                    DirectDebridPlaybackResolver.resolveToPlayableStream(
                        stream = stream,
                        season = season,
                        episode = episode,
                    )
                }.getOrNull()
                if (resolved is DirectDebridPlayableResult.Success) {
                    directUrl = resolved.stream.playableDirectUrl
                    effectiveHeaders = resolved.stream.behaviorHints.proxyHeaders?.request.orEmpty()
                    effectiveFilename = resolved.stream.behaviorHints.filename
                }
            }

            if (directUrl.isNullOrBlank()) continue
            if (!Cinema3DMediaCompatibility.isUrlCompatible(
                    url = directUrl,
                    filenameHint = effectiveFilename,
                    titleHint = stream.name ?: stream.title,
                    descriptionHint = stream.description,
                )
            ) {
                continue
            }

            val isHls = directUrl.contains(".m3u8", ignoreCase = true) || directUrl.contains("mpegurl", ignoreCase = true)
            val wrappedUrl = wrapForCinemaPlayback(
                rawUrl = directUrl,
                requestHeaders = effectiveHeaders,
                isDirectLocal = isHls && effectiveHeaders.isEmpty(),
            )
            results.add(
                CinemaResolvedStreamOption(
                    label = "${stream.addonName} • ${stream.streamLabel}",
                    subtitle = stream.streamSubtitle,
                    playbackUrl = wrappedUrl,
                    isDirectLocalOrHls = true,
                ),
            )
        }

        return results
    }

    private fun wrapForCinemaPlayback(
        rawUrl: String,
        requestHeaders: Map<String, String>,
        isDirectLocal: Boolean,
    ): String {
        val trimmed = rawUrl.trim()
        if (isDirectLocal || trimmed.startsWith("movies/") || trimmed.startsWith("/api/") || trimmed.startsWith("/stream/")) {
            return trimmed
        }
        val encodedUrl = URLEncoder.encode(trimmed, "UTF-8")
        if (requestHeaders.isEmpty()) {
            return "/api/proxy-video?url=$encodedUrl"
        }
        val headersJson = JSONObject()
        requestHeaders.forEach { (k, v) ->
            if (k.isNotBlank() && v.isNotBlank() && !k.equals("Range", ignoreCase = true)) {
                headersJson.put(k, v)
            }
        }
        val encodedHeaders = Base64.encodeToString(
            headersJson.toString().toByteArray(Charsets.UTF_8),
            Base64.URL_SAFE or Base64.NO_WRAP,
        )
        return "/api/proxy-video?url=$encodedUrl&h=${URLEncoder.encode(encodedHeaders, "UTF-8")}"
    }

    private fun normalizeMediaType(raw: String?): String? = when (raw?.trim()?.lowercase()) {
        "movie", "film" -> "movie"
        "series", "show", "tv", "tvshow" -> "series"
        else -> null
    }
}

