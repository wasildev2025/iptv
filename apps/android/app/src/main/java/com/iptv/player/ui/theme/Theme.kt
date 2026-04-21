package com.iptv.player.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val PremiumColorScheme = darkColorScheme(
    primary = BrandAccent,
    onPrimary = BrandBackground,
    secondary = BrandNavyDeep,
    onSecondary = BrandTextPrimary,
    tertiary = BrandAccentGlow,
    background = BrandBackground,
    onBackground = BrandTextPrimary,
    surface = BrandNavyDeep,
    onSurface = BrandTextPrimary,
    surfaceVariant = BrandNavyDeep,
    onSurfaceVariant = BrandTextSecondary,
    error = Red40,
    outline = BrandTextSecondary
)

@Composable
fun IPTVPlayerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    // We force dark/premium theme for streaming experience
    MaterialTheme(
        colorScheme = PremiumColorScheme,
        typography = Typography, // Assuming Typography is defined in another file
        content = content
    )
}
