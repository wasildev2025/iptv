import { Injectable } from '@nestjs/common';
import { METADATA_CATALOG, MetadataCatalogEntry } from './catalog';

type ChannelLike = Record<string, unknown> & {
  name?: unknown;
  logoUrl?: unknown;
  tvgId?: unknown;
};

type EnrichmentMatch = {
  entry: MetadataCatalogEntry | null;
  confidence: number;
};

const VALIDATION_TIMEOUT_MS = 5000;
const MATCH_THRESHOLD = 0.82;
const QUALITY_TOKENS = new Set([
  'hd',
  'fhd',
  'uhd',
  'sd',
  '4k',
  '1080p',
  '720p',
  '576p',
  'live',
  'backup',
]);

@Injectable()
export class MetadataService {
  private readonly urlValidationCache = new Map<string, boolean>();

  async enrichPayload<T>(payload: T): Promise<T> {
    return (await this.walk(payload)) as T;
  }

  normalizeChannelName(raw: string): string {
    const withoutPrefix = raw
      .normalize('NFKD')
      .replace(/^[a-z]{2,4}\s*:\s*/i, '')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .toLowerCase();

    return withoutPrefix
      .split(/\s+/)
      .filter(Boolean)
      .filter((token) => !QUALITY_TOKENS.has(token))
      .join(' ')
      .trim();
  }

  private async walk(value: unknown): Promise<unknown> {
    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => this.walk(item)));
    }

    if (!this.isPlainObject(value)) {
      return value;
    }

    const cloned: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      cloned[key] = await this.walk(child);
    }

    if (this.looksLikeChannel(cloned)) {
      return this.enrichChannel(cloned);
    }

    return cloned;
  }

  private async enrichChannel(channel: ChannelLike): Promise<ChannelLike> {
    const originalName = String(channel.name ?? '').trim();
    if (!originalName) return channel;

    const normalizedName = this.normalizeChannelName(originalName);
    const match = this.findBestMatch(normalizedName);

    let logoUrl = typeof channel.logoUrl === 'string' ? channel.logoUrl.trim() : '';
    if (!logoUrl || !(await this.validateUrl(logoUrl))) {
      logoUrl = await this.resolveLogoUrl(match.entry, originalName);
    }

    const existingTvgId = typeof channel.tvgId === 'string' ? channel.tvgId.trim() : '';
    const tvgId =
      existingTvgId || (match.confidence >= MATCH_THRESHOLD ? match.entry?.tvgId ?? '' : '');

    return {
      ...channel,
      logoUrl,
      tvgId,
    };
  }

  private findBestMatch(normalizedName: string): EnrichmentMatch {
    let bestEntry: MetadataCatalogEntry | null = null;
    let bestScore = 0;

    for (const entry of METADATA_CATALOG) {
      for (const alias of entry.aliases) {
        const normalizedAlias = this.normalizeChannelName(alias);
        const score = this.similarity(normalizedName, normalizedAlias);
        if (score > bestScore) {
          bestScore = score;
          bestEntry = entry;
        }
      }
    }

    return { entry: bestEntry, confidence: bestScore };
  }

  private similarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const tokenScore = this.jaccard(
      new Set(a.split(/\s+/).filter(Boolean)),
      new Set(b.split(/\s+/).filter(Boolean)),
    );
    const compactA = a.replace(/\s+/g, '');
    const compactB = b.replace(/\s+/g, '');
    const editScore = 1 - this.levenshtein(compactA, compactB) / Math.max(compactA.length, compactB.length, 1);

    return tokenScore * 0.55 + editScore * 0.45;
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    const intersection = [...a].filter((token) => b.has(token)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private levenshtein(a: string, b: string): number {
    const matrix = Array.from({ length: a.length + 1 }, (_, row) =>
      Array.from({ length: b.length + 1 }, (_, col) =>
        row === 0 ? col : col === 0 ? row : 0,
      ),
    );

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    return matrix[a.length][b.length];
  }

  private async resolveLogoUrl(
    entry: MetadataCatalogEntry | null,
    originalName: string,
  ): Promise<string> {
    if (entry) {
      for (const candidate of entry.logoCandidates) {
        if (candidate.startsWith('https://') && (await this.validateUrl(candidate))) {
          return candidate;
        }
      }
    }
    return this.buildPlaceholderLogo(originalName);
  }

  private async validateUrl(url: string): Promise<boolean> {
    if (!url) return false;
    if (url.startsWith('data:')) return true;

    const cached = this.urlValidationCache.get(url);
    if (cached !== undefined) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

    try {
      let response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!response.ok || response.status === 405) {
        response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: { Range: 'bytes=0-0' },
        });
      }

      const valid = response.ok;
      this.urlValidationCache.set(url, valid);
      return valid;
    } catch {
      this.urlValidationCache.set(url, false);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildPlaceholderLogo(name: string): string {
    const initials = this.normalizeChannelName(name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((token) => token[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 3) || 'TV';

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <rect width="512" height="512" rx="72" fill="#111827"/>
        <rect x="24" y="24" width="464" height="464" rx="56" fill="#1f2937" stroke="#374151" stroke-width="4"/>
        <text x="256" y="292" text-anchor="middle" font-family="Arial, sans-serif" font-size="164" font-weight="700" fill="#f9fafb">${initials}</text>
      </svg>
    `.replace(/\s+/g, ' ');

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  private looksLikeChannel(value: Record<string, unknown>): value is ChannelLike {
    return typeof value.name === 'string' &&
      ('logoUrl' in value || 'tvgId' in value);
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
