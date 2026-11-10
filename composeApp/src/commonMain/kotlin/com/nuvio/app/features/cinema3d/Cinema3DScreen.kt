package com.nuvio.app.features.cinema3d

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.SurroundSound
import androidx.compose.material.icons.rounded.VideoFile
import androidx.compose.material.icons.rounded.ViewInAr
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nuvio.app.core.ui.LocalNuvioBottomNavigationOverlayPadding
import kotlinx.coroutines.flow.Flow

private val CinemaGold = Color(0xFFC8A96E)
private val CinemaGoldBright = Color(0xFFE5C98B)
private val CinemaVelvet = Color(0xFF4B0B14)
private val CinemaVelvetDark = Color(0xFF1A0408)
private val CinemaBorder = Color(0x38C8A96E)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun Cinema3DLobbyScreen(
    onEnterCinema: (streamUrl: String?, title: String?, seat: String, lightsOn: Boolean, exploreOnly: Boolean) -> Unit,
    scrollToTopRequests: Flow<Unit>? = null,
    listState: LazyListState = rememberLazyListState(),
    modifier: Modifier = Modifier,
) {
    val bottomOverlayPadding = LocalNuvioBottomNavigationOverlayPadding.current
    val topStatusPadding = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    LaunchedEffect(scrollToTopRequests) {
        scrollToTopRequests?.collect {
            listState.animateScrollToItem(0)
        }
    }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0A080C)),
    ) {
        val isTabletOrLandscapeBar = maxWidth >= 768.dp
        val topClearance = if (isTabletOrLandscapeBar) {
            topStatusPadding + 78.dp
        } else {
            topStatusPadding + 20.dp
        }

        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = topClearance,
                bottom = bottomOverlayPadding + 28.dp,
                start = 16.dp,
                end = 16.dp,
            ),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            item(key = "cinema3d_main_card") {
                Box(
                    modifier = Modifier
                        .widthIn(max = 720.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(26.dp))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(CinemaVelvet, CinemaVelvetDark, Color(0xFF0E0B14)),
                            ),
                        )
                        .border(1.dp, CinemaBorder, RoundedCornerShape(26.dp))
                        .padding(horizontal = 24.dp, vertical = 26.dp),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(CinemaGold.copy(alpha = 0.16f))
                                    .border(1.dp, CinemaGold.copy(alpha = 0.45f), RoundedCornerShape(50))
                                    .padding(horizontal = 12.dp, vertical = 4.dp),
                            ) {
                                Text(
                                    text = "CINE ULTIMATE • SALA IMAX 3D",
                                    color = CinemaGoldBright,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.2.sp,
                                )
                            }
                        }

                        Text(
                            text = "Sala de Cinema 3D",
                            style = MaterialTheme.typography.headlineMedium.copy(
                                fontWeight = FontWeight.Black,
                                letterSpacing = (-0.5).sp,
                            ),
                            color = Color.White,
                        )

                        Text(
                            text = "Assista filmes e séries compatíveis do catálogo, vídeos do seu aparelho ou links diretos projetados no telão curvo IMAX com áudio espacial 5.1 e visão 360°.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFFD5CFC7),
                            lineHeight = 20.sp,
                        )

                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            CinemaSpecChip(icon = Icons.Rounded.Movie, label = "Filmes & Séries Compatíveis")
                            CinemaSpecChip(icon = Icons.Rounded.VideoFile, label = "Do Aparelho & Links")
                            CinemaSpecChip(icon = Icons.Rounded.SurroundSound, label = "Áudio 5.1 Surround")
                            CinemaSpecChip(icon = Icons.Rounded.ViewInAr, label = "Visão 360° Touch")
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Button(
                            onClick = {
                                onEnterCinema(null, "Sala de Cinema 3D", "center", false, false)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CinemaGold,
                                contentColor = Color(0xFF120B04),
                            ),
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.PlayArrow,
                                contentDescription = null,
                                modifier = Modifier.size(22.dp),
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Entrar na Sala de Cinema",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 15.sp,
                            )
                        }

                        OutlinedButton(
                            onClick = {
                                onEnterCinema(null, "Explorar Arquitetura 3D", "center", true, true)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, CinemaGold.copy(alpha = 0.45f)),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = CinemaGoldBright),
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.ViewInAr,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Explorar Arquitetura",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.5.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CinemaSpecChip(
    icon: ImageVector,
    label: String,
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(Color.Black.copy(alpha = 0.36f))
            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = CinemaGold,
            modifier = Modifier.size(14.dp),
        )
        Text(
            text = label.trim(),
            color = Color(0xFFEAE4DC),
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}
