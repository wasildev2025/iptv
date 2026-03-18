package com.iptv.player.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = Red80,
    onPrimary = Red20,
    primaryContainer = Red30,
    onPrimaryContainer = Red90,
    secondary = DarkRed80,
    onSecondary = DarkRed20,
    secondaryContainer = DarkRed30,
    onSecondaryContainer = DarkRed90,
    tertiary = Orange80,
    onTertiary = Orange20,
    tertiaryContainer = Orange30,
    onTertiaryContainer = Orange90,
    error = Red80,
    onError = Red20,
    errorContainer = Red30,
    onErrorContainer = Red90,
    background = SurfaceDark,
    onBackground = Grey90,
    surface = SurfaceDark,
    onSurface = Grey90,
    surfaceVariant = SurfaceDarkVariant,
    onSurfaceVariant = Grey80,
    outline = Grey40,
    inverseSurface = Grey90,
    inverseOnSurface = Grey20,
    inversePrimary = Red40,
    surfaceTint = Red80,
)

private val LightColorScheme = lightColorScheme(
    primary = Red40,
    onPrimary = Color.White,
    primaryContainer = Red90,
    onPrimaryContainer = Red10,
    secondary = DarkRed40,
    onSecondary = Color.White,
    secondaryContainer = DarkRed90,
    onSecondaryContainer = DarkRed10,
    tertiary = Orange40,
    onTertiary = Color.White,
    tertiaryContainer = Orange90,
    onTertiaryContainer = Orange10,
    error = Red40,
    onError = Color.White,
    errorContainer = Red90,
    onErrorContainer = Red10,
    background = Grey99,
    onBackground = Grey10,
    surface = Grey99,
    onSurface = Grey10,
    surfaceVariant = Grey95,
    onSurfaceVariant = Grey30,
    outline = Grey40,
    inverseSurface = Grey20,
    inverseOnSurface = Grey95,
    inversePrimary = Red80,
    surfaceTint = Red40,
)

@Composable
fun IPTVPlayerTheme(
    darkTheme: Boolean = true, // Default to dark for media app
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Color.Transparent.toArgb()
            window.navigationBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
