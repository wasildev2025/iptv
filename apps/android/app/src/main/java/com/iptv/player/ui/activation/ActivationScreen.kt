package com.iptv.player.ui.activation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.iptv.player.ui.theme.Red40
import com.iptv.player.ui.theme.Red80
import com.iptv.player.ui.theme.SurfaceDark
import com.iptv.player.ui.theme.SurfaceDarkVariant

@Composable
fun ActivationScreen(
    onActivated: (playlistUrl: String) -> Unit,
    viewModel: ActivationViewModel = hiltViewModel()
) {
    val activationState by viewModel.activationState.collectAsState()
    val apps by viewModel.apps.collectAsState()
    val selectedApp by viewModel.selectedApp.collectAsState()
    val macAddress by viewModel.macAddress.collectAsState()
    val appsLoading by viewModel.appsLoading.collectAsState()

    // Auto-navigate if already activated
    LaunchedEffect(activationState) {
        when (val state = activationState) {
            is ActivationState.Activated -> onActivated(state.playlistUrl)
            is ActivationState.AlreadyActivated -> onActivated(state.playlistUrl)
            else -> {}
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SurfaceDark)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // App Logo
            Icon(
                imageVector = Icons.Default.LiveTv,
                contentDescription = "IPTV Player",
                modifier = Modifier.size(80.dp),
                tint = Red40
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "IPTV Player",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = Red40
            )

            Spacer(modifier = Modifier.height(48.dp))

            // MAC Address Section
            Text(
                text = "Your Device MAC Address:",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = macAddress.ifBlank { "Detecting..." },
                style = MaterialTheme.typography.headlineMedium,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(SurfaceDarkVariant)
                    .padding(16.dp)
            )

            Spacer(modifier = Modifier.height(32.dp))

            // App Selector Dropdown
            Text(
                text = "Select Application:",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            AppDropdown(
                apps = apps,
                selectedApp = selectedApp,
                isLoading = appsLoading,
                onAppSelected = { viewModel.selectApp(it) }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // If no activated apps for this MAC, tell the user exactly what to do.
            if (!appsLoading && apps.isEmpty() && macAddress.isNotBlank()) {
                Text(
                    text = "No activated apps found for this device. " +
                        "Please ask your reseller to activate the MAC address shown above.",
                    color = Red80,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Red40.copy(alpha = 0.1f))
                        .padding(16.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Action Area
            when (val state = activationState) {
                is ActivationState.Idle -> {
                    Button(
                        onClick = { viewModel.checkActivation() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Red40
                        ),
                        enabled = selectedApp != null && macAddress.isNotBlank()
                    ) {
                        Text(
                            text = "Check Activation",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                is ActivationState.Loading -> {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        CircularProgressIndicator(
                            color = Red40,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Checking activation...",
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                    }
                }

                is ActivationState.NotActivated -> {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = state.error,
                            color = Red80,
                            style = MaterialTheme.typography.bodyLarge,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Red40.copy(alpha = 0.1f))
                                .padding(16.dp)
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = { viewModel.retry() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Red40
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Retry",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }

                is ActivationState.Activated,
                is ActivationState.AlreadyActivated -> {
                    // Navigating... show a brief loading
                    CircularProgressIndicator(
                        color = Red40,
                        modifier = Modifier.size(48.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun AppDropdown(
    apps: List<com.iptv.player.data.model.AppInfo>,
    selectedApp: com.iptv.player.data.model.AppInfo?,
    isLoading: Boolean,
    onAppSelected: (com.iptv.player.data.model.AppInfo) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(SurfaceDarkVariant)
                .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                .clickable(enabled = apps.isNotEmpty()) { expanded = true }
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = Red40
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Loading apps...",
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
            } else {
                Text(
                    text = selectedApp?.name ?: "No apps available",
                    color = if (selectedApp != null)
                        MaterialTheme.colorScheme.onSurface
                    else
                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    style = MaterialTheme.typography.bodyLarge
                )
            }

            Icon(
                imageVector = Icons.Default.ArrowDropDown,
                contentDescription = "Select app",
                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier
                .fillMaxWidth(0.8f)
                .background(SurfaceDarkVariant)
        ) {
            apps.forEach { app ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = app.name,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    },
                    onClick = {
                        onAppSelected(app)
                        expanded = false
                    }
                )
            }
        }
    }
}
