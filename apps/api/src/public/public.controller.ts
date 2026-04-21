import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceTokenService } from './device-token.service';
import type { ResolvedDeviceToken } from './device-token.service';
import { DeviceTokenGuard } from './guards/device-token.guard';
import { CurrentDevice } from './decorators/current-device.decorator';
import { DeviceStateBuilder } from './device-state.builder';
import type { DeviceStateResponse } from './device-state.builder';
import { PlaylistPinService } from './playlist-pin.service';
import { XtreamService } from './xtream.service';

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

const CHECK_USER_AGENT = 'VLC/3.0.20 LibVLC/3.0.20';
const CHECK_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': CHECK_USER_AGENT,
        Accept: '*/*',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function toIsoFromUnix(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return new Date(num * 1000).toISOString();
}

function normalizeMac(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new BadRequestException('macAddress is required');
  }
  if (!MAC_REGEX.test(trimmed)) {
    throw new BadRequestException(
      'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)',
    );
  }
  return trimmed.toUpperCase().replace(/-/g, ':');
}

/**
 * Decide whether a device is allowed to bind / stay bound.
 * `active` and `trial` are always allowed.
 * `expired` is allowed iff we are still inside the grace window.
 * Anything else (disabled, or expired past grace) is rejected.
 */
function assertDeviceUsable(device: {
  status: string;
  expiresAt: Date | null;
  packageType: string;
}): { isInGrace: boolean } {
  if (device.status === 'active' || device.status === 'trial') {
    return { isInGrace: false };
  }
  if (device.status !== 'expired') {
    throw new ForbiddenException(`Device is ${device.status}`);
  }
  // Expired — check grace window.
  if (!device.expiresAt || device.packageType === 'lifetime') {
    throw new ForbiddenException('Device is expired');
  }
  const graceDays = Number(process.env.GRACE_PERIOD_DAYS ?? 3);
  const graceEndsAt = new Date(
    device.expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000,
  );
  if (graceEndsAt.getTime() <= Date.now()) {
    throw new ForbiddenException('Device is expired');
  }
  return { isInGrace: true };
}

@ApiTags('Public')
@Controller('api/public')
export class PublicController {
  constructor(
    private prisma: PrismaService,
    private tokens: DeviceTokenService,
    private stateBuilder: DeviceStateBuilder,
    private pinService: PlaylistPinService,
    private xtream: XtreamService,
  ) {}

  // ---------------------------------------------------------------------------
  // Discovery (no auth) — only returns app name/icon, not credentials.
  // ---------------------------------------------------------------------------

  @Post('apps')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Public list of apps. If macAddress is provided, returns only apps that have an active/trial activation for that MAC.',
  })
  async listApps(@Body() body: { macAddress?: string } = {}) {
    const raw = body?.macAddress?.trim();

    if (!raw) {
      return this.prisma.app.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, iconUrl: true },
        orderBy: { name: 'asc' },
      });
    }

    const mac = normalizeMac(raw);

    const devices = await this.prisma.device.findMany({
      where: {
        status: { in: ['active', 'trial'] },
        OR: [{ macAddress: mac }, { macAddressAlt: mac }],
        app: { isActive: true },
      },
      select: {
        app: { select: { id: true, name: true, slug: true, iconUrl: true } },
      },
      orderBy: { activatedAt: 'desc' },
    });

    const seen = new Set<string>();
    const uniqueApps: {
      id: string;
      name: string;
      slug: string;
      iconUrl: string | null;
    }[] = [];
    for (const d of devices) {
      if (d.app && !seen.has(d.app.id)) {
        seen.add(d.app.id);
        uniqueApps.push(d.app);
      }
    }
    return uniqueApps;
  }

  // ---------------------------------------------------------------------------
  // First-time bind — exchange MAC + appId for a device token.
  // ---------------------------------------------------------------------------

  @Post('bind-device')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Bind an Android device by (MAC, app) and issue a long-lived device token used for all subsequent public calls.',
  })
  async bindDevice(
    @Body() body: { macAddress?: string; appId?: string; appSlug?: string },
    @Headers('user-agent') userAgent?: string,
  ): Promise<{ token: string; state: DeviceStateResponse }> {
    const mac = normalizeMac(body?.macAddress);

    if (!body?.appId && !body?.appSlug) {
      throw new BadRequestException('appId or appSlug is required');
    }

    const device = await this.prisma.device.findFirst({
      where: {
        OR: [{ macAddress: mac }, { macAddressAlt: mac }],
        ...(body.appId
          ? { appId: body.appId }
          : { app: { slug: body.appSlug } }),
      },
      orderBy: { activatedAt: 'desc' },
    });

    if (!device) {
      throw new NotFoundException('No activation found for this MAC');
    }

    assertDeviceUsable(device);

    const token = await this.tokens.issue(device.id, userAgent ?? '');
    const state = await this.stateBuilder.build(device.id);
    if (!state) {
      throw new NotFoundException('No activation found for this MAC');
    }
    return { token, state };
  }

  // ---------------------------------------------------------------------------
  // Refresh state — called whenever the Android app resumes.
  // ---------------------------------------------------------------------------

  @Post('check-activation')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(DeviceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Return the current device state (status, playlists, grace info). Requires a device token from /bind-device.',
  })
  async checkActivation(
    @CurrentDevice() auth: ResolvedDeviceToken,
  ): Promise<DeviceStateResponse> {
    const device = await this.prisma.device.findUnique({
      where: { id: auth.deviceId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        packageType: true,
      },
    });
    if (!device) {
      // Device deleted under us — nuke the token too.
      await this.tokens.revokeById(auth.tokenRecordId);
      throw new NotFoundException('Device no longer exists');
    }
    assertDeviceUsable(device);
    const state = await this.stateBuilder.build(auth.deviceId);
    if (!state) {
      throw new NotFoundException('Device no longer exists');
    }
    return state;
  }

  // ---------------------------------------------------------------------------
  // PIN verification — never returns the hash, just a boolean.
  // ---------------------------------------------------------------------------

  @Post('verify-playlist-pin')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(DeviceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Verify a PIN for a protected playlist. Returns { valid } only — never the stored hash.',
  })
  async verifyPlaylistPin(
    @CurrentDevice() auth: ResolvedDeviceToken,
    @Body() body: { playlistId?: string; pin?: string },
  ): Promise<{ valid: boolean }> {
    if (!body?.playlistId || typeof body.playlistId !== 'string') {
      throw new BadRequestException('playlistId is required');
    }
    if (!body.pin || typeof body.pin !== 'string') {
      throw new BadRequestException('pin is required');
    }

    // Make sure the playlist belongs to this device (same user+MAC+app).
    const device = await this.prisma.device.findUnique({
      where: { id: auth.deviceId },
      select: { userId: true, macAddress: true, appId: true },
    });
    if (!device) {
      throw new NotFoundException('Device no longer exists');
    }
    const playlist = await this.prisma.playlist.findFirst({
      where: {
        id: body.playlistId,
        userId: device.userId,
        macAddress: device.macAddress,
        appId: device.appId,
      },
      select: { id: true },
    });
    if (!playlist) {
      throw new NotFoundException('Playlist not found for this device');
    }

    const valid = await this.pinService.verify(playlist.id, body.pin);
    return { valid };
  }

  // ---------------------------------------------------------------------------
  // Explicit sign-out.
  // ---------------------------------------------------------------------------

  @Post('revoke-device-token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(DeviceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the calling device token.' })
  async revokeToken(
    @CurrentDevice() auth: ResolvedDeviceToken,
  ): Promise<{ revoked: true }> {
    await this.tokens.revokeById(auth.tokenRecordId);
    return { revoked: true };
  }

  // ---------------------------------------------------------------------------
  // Xtream proxy endpoints — keep large catalog processing off the device.
  // ---------------------------------------------------------------------------

  @Post('xtream/home')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(DeviceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Return a lightweight Xtream home payload: featured live channels plus a small set of category rails.',
  })
  async xtreamHome(@Body() body: { url?: string }) {
    const url = body?.url?.trim();
    if (!url) {
      throw new BadRequestException('url is required');
    }
    return this.xtream.loadHome(url);
  }

  @Post('xtream/category')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(DeviceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Return live streams for a single Xtream category. Lets clients paginate category-by-category instead of loading the full catalogue.',
  })
  async xtreamCategory(@Body() body: { url?: string; categoryId?: string }) {
    const url = body?.url?.trim();
    const categoryId = body?.categoryId?.trim();
    if (!url) {
      throw new BadRequestException('url is required');
    }
    if (!categoryId) {
      throw new BadRequestException('categoryId is required');
    }
    return { channels: await this.xtream.loadCategory(url, categoryId) };
  }

  @Post('xtream/search')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(DeviceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Search Xtream live streams server-side and return only the matching subset to the Android client.',
  })
  async xtreamSearch(@Body() body: { url?: string; query?: string }) {
    const url = body?.url?.trim();
    const query = body?.query?.trim();
    if (!url) {
      throw new BadRequestException('url is required');
    }
    if (!query) {
      throw new BadRequestException('query is required');
    }
    return { results: await this.xtream.search(url, query) };
  }

  @Post('xtream/epg-channels')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(DeviceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Return Xtream live channels that include EPG ids so the Android guide can cache only the guide-eligible subset.',
  })
  async xtreamEpgChannels(@Body() body: { url?: string }) {
    const url = body?.url?.trim();
    if (!url) {
      throw new BadRequestException('url is required');
    }
    return { channels: await this.xtream.loadEpgChannels(url) };
  }

  // ---------------------------------------------------------------------------
  // Free IPTV Status Checker — unchanged from previous pass.
  // ---------------------------------------------------------------------------

  @Post('check-playlist')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Public free IPTV status checker — fetches Xtream Codes account info or verifies M3U reachability server-side',
  })
  async checkPlaylist(@Body() body: { url?: string }) {
    const raw = body?.url?.trim();
    if (!raw) {
      throw new BadRequestException('url is required');
    }

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http(s) URLs are supported');
    }

    const username = parsed.searchParams.get('username');
    const password = parsed.searchParams.get('password');

    if (username && password) {
      const apiUrl = `${parsed.protocol}//${parsed.host}/player_api.php?username=${encodeURIComponent(
        username,
      )}&password=${encodeURIComponent(password)}`;

      try {
        const res = await fetchWithTimeout(apiUrl);
        if (res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            const u = data?.user_info;
            if (u) {
              const accountStatus =
                typeof u.status === 'string' ? u.status : null;
              const expiresAt = toIsoFromUnix(u.exp_date);
              const createdAt = toIsoFromUnix(u.created_at);
              const maxConnections = Number(u.max_connections) || null;
              const activeConnections = Number(u.active_cons) || 0;
              const isTrial = u.is_trial === '1' || u.is_trial === 1;

              let isExpired: boolean | null = null;
              if (expiresAt) {
                isExpired = new Date(expiresAt).getTime() < Date.now();
              }

              return {
                status: 'ok',
                host: parsed.host,
                username: u.username ?? username,
                accountStatus,
                isActive:
                  accountStatus?.toLowerCase() === 'active' && !isExpired,
                isExpired,
                isTrial,
                expiresAt,
                createdAt,
                maxConnections,
                activeConnections,
                serverInfo: data.server_info
                  ? {
                      url: data.server_info.url ?? null,
                      port: data.server_info.port ?? null,
                      httpsPort: data.server_info.https_port ?? null,
                      timezone: data.server_info.timezone ?? null,
                      timeNow: data.server_info.time_now ?? null,
                    }
                  : null,
              };
            }
          } catch {
            // Not JSON — fall through to M3U probe
          }
        }
      } catch {
        // Ignore and fall through to direct M3U probe
      }
    }

    try {
      const res = await fetchWithTimeout(raw);

      if (!res.ok) {
        return {
          status: 'error',
          host: parsed.host,
          message: `Server returned ${res.status} ${res.statusText || ''}`.trim(),
        };
      }

      const reader = res.body?.getReader();
      let sample = '';
      if (reader) {
        const { value } = await reader.read();
        if (value) {
          sample = new TextDecoder().decode(value).slice(0, 2048);
        }
        try {
          await reader.cancel();
        } catch {
          /* noop */
        }
      } else {
        sample = (await res.text()).slice(0, 2048);
      }

      const isM3u = sample.includes('#EXTM3U') || sample.includes('#EXTINF');
      return {
        status: isM3u ? 'reachable' : 'unknown',
        host: parsed.host,
        message: isM3u
          ? 'Playlist is reachable. Account details are not exposed by this server.'
          : 'URL is reachable but does not look like a valid M3U playlist.',
      };
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'TimeoutError');
      return {
        status: 'error',
        host: parsed.host,
        message: isAbort
          ? 'Request timed out. The server is too slow or unreachable.'
          : 'Could not reach the URL. The server may be down or the URL is invalid.',
      };
    }
  }
}
