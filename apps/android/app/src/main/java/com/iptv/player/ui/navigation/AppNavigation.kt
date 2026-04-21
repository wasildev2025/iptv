package com.iptv.player.ui.navigation

import androidx.compose.animation.*
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.iptv.player.ui.activation.ActivationScreen
import com.iptv.player.ui.epg.EpgScreen
import com.iptv.player.ui.home.HomeScreen
import com.iptv.player.ui.player.PlayerScreen
import com.iptv.player.ui.settings.SettingsScreen
import com.iptv.player.ui.settings.SwitchPlaylistScreen
import com.iptv.player.ui.favorites.FavoriteScreen
import java.net.URLEncoder
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

object Routes {
    const val ACTIVATION = "activation"
    const val HOME = "home?playlistUrl={playlistUrl}"
    const val PLAYER = "player?streamUrl={streamUrl}&channelName={channelName}&groupTitle={groupTitle}&logoUrl={logoUrl}"
    const val SETTINGS = "settings"
    const val SWITCH_PLAYLIST = "switch_playlist"
    const val EPG = "epg"
    const val FAVORITES = "favorites"

    fun home(playlistUrl: String): String {
        val encoded = URLEncoder.encode(playlistUrl, StandardCharsets.UTF_8.toString())
        return "home?playlistUrl=$encoded"
    }

    fun player(streamUrl: String, channelName: String, groupTitle: String, logoUrl: String): String {
        val charset = StandardCharsets.UTF_8.toString()
        val encodedStreamUrl = URLEncoder.encode(streamUrl, charset)
        val encodedChannelName = URLEncoder.encode(channelName, charset)
        val encodedGroupTitle = URLEncoder.encode(groupTitle, charset)
        val encodedLogoUrl = URLEncoder.encode(logoUrl, charset)
        return "player?streamUrl=$encodedStreamUrl&channelName=$encodedChannelName&groupTitle=$encodedGroupTitle&logoUrl=$encodedLogoUrl"
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController(),
    startDestination: String = Routes.ACTIVATION
) {
    SharedTransitionLayout {
        NavHost(
            navController = navController,
            startDestination = startDestination
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
                    onFavoritesClick = {
                        navController.navigate(Routes.FAVORITES)
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
                    onBack = { navController.popBackStack() },
                    sharedTransitionScope = this@SharedTransitionLayout,
                    animatedVisibilityScope = this@composable
                )
            }

            composable(Routes.FAVORITES) {
                FavoriteScreen(
                    onChannelClick = { streamUrl, channelName, groupTitle, logoUrl ->
                        navController.navigate(Routes.player(streamUrl, channelName, groupTitle, logoUrl))
                    },
                    onBack = { navController.popBackStack() },
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
            ) { backStackEntry ->
                val charset = StandardCharsets.UTF_8.toString()
                val streamUrl = URLDecoder.decode(
                    backStackEntry.arguments?.getString("streamUrl") ?: "",
                    charset
                )
                val channelName = URLDecoder.decode(
                    backStackEntry.arguments?.getString("channelName") ?: "",
                    charset
                )
                val groupTitle = URLDecoder.decode(
                    backStackEntry.arguments?.getString("groupTitle") ?: "",
                    charset
                )
                val logoUrl = URLDecoder.decode(
                    backStackEntry.arguments?.getString("logoUrl") ?: "",
                    charset
                )

                PlayerScreen(
                    streamUrl = streamUrl,
                    channelName = channelName,
                    groupTitle = groupTitle,
                    logoUrl = logoUrl,
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
                    onPicked = { playlistUrl ->
                        navController.navigate(Routes.home(playlistUrl)) {
                            popUpTo(Routes.HOME) { inclusive = true }
                        }
                    },
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
}
