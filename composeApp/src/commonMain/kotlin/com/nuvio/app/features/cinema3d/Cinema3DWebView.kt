package com.nuvio.app.features.cinema3d

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
expect fun Cinema3DPlayerScreen(
    streamUrl: String? = null,
    title: String? = null,
    seat: String = "center",
    lightsOn: Boolean = false,
    exploreOnly: Boolean = false,
    onExit: () -> Unit,
    modifier: Modifier = Modifier,
)

