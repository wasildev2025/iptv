package com.iptv.player.ui.navigation

import androidx.compose.animation.AnimatedContentScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.iptv.player.ui.activation.ActivationScreen
import com.iptv.player.ui.home.HomeScreen
import com.iptv.player.ui.player.PlayerScreen
import com.iptv.player.ui.settings.SettingsScreen
import com.iptv.player.ui.settings.SwitchPlaylistScreen
import com.iptv.player.ui.epg.EpgScreen
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

object Routes {
    const val ACTIVATION = "activation"
    const val HOME = "home/{playlistUrl}"
    const val EPG = "epg"
    const val PLAYER = "player/{streamUrl}/{channelName}/{groupTitle}/{logoUrl}"
    const val SETTINGS = "settings"
    const val SWITCH_PLAYLIST = "switch-playlist"

    fun home(playlistUrl: String): String {
        val encoded = URLEncoder.encode(playlistUrl, StandardCharsets.UTF_8.toString())
        return "home/$encoded"
    }

    fun player(
        streamUrl: String,
        channelName: String = "",
        groupTitle: String = "",
        logoUrl: String = ""
    ): String {
        val enc = { s: String -> URLEncoder.encode(s, StandardCharsets.UTF_8.toString()) }
        return "player/${enc(streamUrl)}/${enc(channelName)}/${enc(groupTitle)}/${enc(logoUrl)}"
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    SharedTransitionLayout {
        NavHost(
            navController = navController,
            startDestination = Routes.ACTIVATION,
            enterTransition = { fadeIn() },
            exitTransition = { fadeOut() }
        ) {
            composable(Routes.ACTIVATION) {
                ActivationScreen(
                    onActivated = { playlistUrl ->
                        navController.navigate(Routes.home(playlistUrl)) {
                            popUpTo(Routes.ACTIVATION) { inclusive = true }
                        }
                    }
                )
            }

            composable(
                route = Routes.HOME,
                arguments = listOf(
                    navArgument("playlistUrl") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val encodedUrl = backStackEntry.arguments?.getString("playlistUrl") ?: ""
                val playlistUrl = URLDecoder.decode(encodedUrl, StandardCharsets.UTF_8.toString())

                HomeScreen(
                    playlistUrl = playlistUrl,
                    onChannelClick = { streamUrl, channelName, groupTitle, logoUrl ->
                        navController.navigate(Routes.player(streamUrl, channelName, groupTitle, logoUrl))
                    },
                    onSettingsClick = {
                        navController.navigate(Routes.SETTINGS)
                    },
                    onEpgClick = {
                        navController.navigate(Routes.EPG)
                    },
                    sharedTransitionScope = this@SharedTransitionLayout,
                    animatedVisibilityScope = this@composable
                )
            }

            composable(Routes.EPG) {
                EpgScreen(
                    onChannelClick = { streamUrl, channelName, groupTitle, logoUrl ->
                        navController.navigate(Routes.player(streamUrl, channelName, groupTitle, logoUrl))
                    },
                    sharedTransitionScope = this@SharedTransitionLayout,
                    animatedVisibilityScope = this@composable
                )
            }

            composable(
                route = Routes.PLAYER,
                arguments = listOf(
                    navArgument("streamUrl") { type = NavType.StringType },
                    navArgument("channelName") { type = NavType.StringType; defaultValue = "" },
                    navArgument("groupTitle") { type = NavType.StringType; defaultValue = "" },
                    navArgument("logoUrl") { type = NavType.StringType; defaultValue = "" }
                )
            ) {
                PlayerScreen(
                    onBack = { navController.popBackStack() },
                    sharedTransitionScope = this@SharedTransitionLayout,
                    animatedVisibilityScope = this@composable
                )
            }

            composable(Routes.SETTINGS) {
                SettingsScreen(
                    onBack = { navController.popBackStack() },
                    onDeactivated = {
                        navController.navigate(Routes.ACTIVATION) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onSwitchPlaylist = {
                        navController.navigate(Routes.SWITCH_PLAYLIST)
                    }
                )
            }

            composable(Routes.SWITCH_PLAYLIST) {
                SwitchPlaylistScreen(
                    onBack = { navController.popBackStack() },
                    onPicked = { playlistUrl ->
                        // Replace Home in the stack so the new playlist loads fresh
                        // and the user can't back-navigate to the stale one.
                        navController.navigate(Routes.home(playlistUrl)) {
                            popUpTo(Routes.HOME) { inclusive = true }
                        }
                    }
                )
            }
        }
    }
}
