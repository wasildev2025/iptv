import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

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

@ApiTags('Public')
@Controller('api/public')
export class PublicController {
  constructor(private prisma: PrismaService) {}

  @Post('check-activation')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Public endpoint for Android/end-user apps to check MAC activation',
  })
  async checkActivation(
    @Body() body: { macAddress: string; appSlug?: string; appId?: string },
  ) {
    const raw = body?.macAddress?.trim();
    if (!raw) {
      throw new BadRequestException('macAddress is required');
    }
    if (!MAC_REGEX.test(raw)) {
      throw new BadRequestException(
        'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)',
      );
    }
    const mac = raw.toUpperCase().replace(/-/g, ':');

    const where: Record<string, unknown> = {
      OR: [{ macAddress: mac }, { macAddressAlt: mac }],
    };

    if (body.appId) {
      where.appId = body.appId;
    } else if (body.appSlug) {
      where.app = { slug: body.appSlug };
    }

    const device = await this.prisma.device.findFirst({
      where,
      include: {
        app: { select: { id: true, name: true, slug: true, iconUrl: true } },
      },
      orderBy: { activatedAt: 'desc' },
    });

    if (!device) {
      throw new NotFoundException('No activation found for this MAC');
    }

    return {
      id: device.id,
      macAddress: device.macAddress,
      status: device.status,
      packageType: device.packageType,
      activatedAt: device.activatedAt,
      expiresAt: device.expiresAt,
      playlistUrl: device.playlistUrl,
      app: device.app,
    };
  }

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

    if (!MAC_REGEX.test(raw)) {
      throw new BadRequestException(
        'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)',
      );
    }
    const mac = raw.toUpperCase().replace(/-/g, ':');

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
    const uniqueApps: { id: string; name: string; slug: string; iconUrl: string | null }[] = [];
    for (const d of devices) {
      if (d.app && !seen.has(d.app.id)) {
        seen.add(d.app.id);
        uniqueApps.push(d.app);
      }
    }
    return uniqueApps;
  }

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
