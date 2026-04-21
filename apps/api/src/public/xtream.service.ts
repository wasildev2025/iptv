import { BadRequestException, Injectable } from '@nestjs/common';

const XTREAM_TIMEOUT_MS = 20000;
const XTREAM_USER_AGENT = 'IPTV-Premier/1.0';
const HOME_CATEGORY_LIMIT = 8;
const CATEGORY_CHANNEL_LIMIT = 20;
const SEARCH_RESULT_LIMIT = 100;

type XtreamCredentials = {
  origin: string;
  username: string;
  password: string;
  output: string;
  apiBase: string;
};

type XtreamCategory = {
  category_id?: string | number | null;
  category_name?: string | null;
  parent_id?: string | number | null;
};

type XtreamStream = {
  stream_id?: string | number | null;
  name?: string | null;
  stream_icon?: string | null;
  category_id?: string | number | null;
  epg_channel_id?: string | null;
  container_extension?: string | null;
};

export type XtreamChannelDto = {
  name: string;
  groupTitle: string;
  logoUrl: string;
  streamUrl: string;
  tvgId: string;
  tvgName: string;
  isLive: true;
};

export type XtreamCategorySectionDto = {
  categoryId: string;
  title: string;
  channels: XtreamChannelDto[];
};

export type XtreamHomeDto = {
  featured: XtreamChannelDto[];
  categories: XtreamCategorySectionDto[];
  totalCategories: number;
};

@Injectable()
export class XtreamService {
  isXtreamUrl(rawUrl: string): boolean {
    return this.tryParseCredentials(rawUrl) !== null;
  }

  async loadHome(rawUrl: string): Promise<XtreamHomeDto> {
    const creds = this.parseCredentials(rawUrl);
    const categoryMap = await this.fetchCategoryMap(creds);
    const normalizedCategories = Array.from(categoryMap.entries()).map(([categoryId, title]) => ({
      categoryId,
      title,
    }));

    const selectedCategories = normalizedCategories.slice(0, HOME_CATEGORY_LIMIT);
    const sections = (
      await Promise.all(
        selectedCategories.map(async (category) => ({
          categoryId: category.categoryId,
          title: category.title,
          channels: await this.loadCategory(
            rawUrl,
            category.categoryId,
            CATEGORY_CHANNEL_LIMIT,
            category.title,
          ),
        })),
      )
    ).filter((section) => section.channels.length > 0);

    const featured = sections
      .flatMap((section) => section.channels.slice(0, 1))
      .filter(
        (channel, index, channels) =>
          channels.findIndex((candidate) => candidate.streamUrl === channel.streamUrl) === index,
      )
      .slice(0, 5);

    return {
      featured,
      categories: sections,
      totalCategories: normalizedCategories.length,
    };
  }

  async loadCategory(
    rawUrl: string,
    categoryId: string,
    limit = CATEGORY_CHANNEL_LIMIT,
    categoryTitle: string | null = null,
  ): Promise<XtreamChannelDto[]> {
    if (!categoryId.trim()) {
      throw new BadRequestException('categoryId is required');
    }

    const creds = this.parseCredentials(rawUrl);
    const streams = await this.fetchJson<XtreamStream[]>(
      `${creds.apiBase}&action=get_live_streams&category_id=${encodeURIComponent(categoryId)}`,
    );

    return streams
      .map((stream) => this.toChannelDto(stream, creds, categoryTitle))
      .filter((channel): channel is XtreamChannelDto => channel !== null)
      .slice(0, limit);
  }

  async search(rawUrl: string, query: string): Promise<XtreamChannelDto[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const creds = this.parseCredentials(rawUrl);
    const categoryMap = await this.fetchCategoryMap(creds);
    const streams = await this.fetchJson<XtreamStream[]>(
      `${creds.apiBase}&action=get_live_streams`,
    );
    const needle = trimmedQuery.toLowerCase();

    return streams
      .filter((stream) => {
        const name = String(stream.name ?? '').toLowerCase();
        return name.includes(needle);
      })
      .map((stream) =>
        this.toChannelDto(
          stream,
          creds,
          categoryMap.get(String(stream.category_id ?? '').trim()) ?? null,
        ),
      )
      .filter((channel): channel is XtreamChannelDto => channel !== null)
      .slice(0, SEARCH_RESULT_LIMIT);
  }

  async loadEpgChannels(rawUrl: string): Promise<XtreamChannelDto[]> {
    const creds = this.parseCredentials(rawUrl);
    const categoryMap = await this.fetchCategoryMap(creds);
    const streams = await this.fetchJson<XtreamStream[]>(
      `${creds.apiBase}&action=get_live_streams`,
    );

    return streams
      .filter((stream) => String(stream.epg_channel_id ?? '').trim().length > 0)
      .map((stream) =>
        this.toChannelDto(
          stream,
          creds,
          categoryMap.get(String(stream.category_id ?? '').trim()) ?? null,
        ),
      )
      .filter((channel): channel is XtreamChannelDto => channel !== null);
  }

  private parseCredentials(rawUrl: string): XtreamCredentials {
    const creds = this.tryParseCredentials(rawUrl);
    if (!creds) {
      throw new BadRequestException('Only Xtream playlist URLs are supported');
    }
    return creds;
  }

  private tryParseCredentials(rawUrl: string): XtreamCredentials | null {
    try {
      const parsed = new URL(rawUrl);
      const username = parsed.searchParams.get('username')?.trim();
      const password = parsed.searchParams.get('password')?.trim();
      const looksXtream = username && password;
      if (!looksXtream) return null;

      const requestedOutput = parsed.searchParams.get('output')?.trim().toLowerCase();
      const output = requestedOutput === 'm3u8' ? 'm3u8' : 'ts';

      return {
        origin: `${parsed.protocol}//${parsed.host}`,
        username,
        password,
        output,
        apiBase: `${parsed.protocol}//${parsed.host}/player_api.php?username=${encodeURIComponent(
          username,
        )}&password=${encodeURIComponent(password)}`,
      };
    } catch {
      return null;
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), XTREAM_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': XTREAM_USER_AGENT,
          Accept: 'application/json, text/plain, */*',
        },
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Xtream server returned ${response.status} ${response.statusText || ''}`.trim(),
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Failed to reach Xtream server');
    } finally {
      clearTimeout(timer);
    }
  }

  private toChannelDto(
    stream: XtreamStream,
    creds: XtreamCredentials,
    categoryTitle: string | null = null,
  ): XtreamChannelDto | null {
    const streamId = String(stream.stream_id ?? '').trim();
    const name = String(stream.name ?? '').trim();
    const categoryId = String(stream.category_id ?? '').trim();
    if (!streamId || !name) {
      return null;
    }

    const extension = String(stream.container_extension ?? '').trim() || creds.output;
    const streamUrl = `${creds.origin}/live/${encodeURIComponent(
      creds.username,
    )}/${encodeURIComponent(creds.password)}/${streamId}.${extension}`;

    return {
      name,
      groupTitle:
        typeof categoryTitle === 'string' && categoryTitle.trim()
          ? categoryTitle.trim()
          : categoryId,
      logoUrl: String(stream.stream_icon ?? '').trim(),
      streamUrl,
      tvgId: String(stream.epg_channel_id ?? '').trim(),
      tvgName: name,
      isLive: true,
    };
  }

  private async fetchCategoryMap(
    creds: XtreamCredentials,
  ): Promise<Map<string, string>> {
    const categories = await this.fetchJson<XtreamCategory[]>(
      `${creds.apiBase}&action=get_live_categories`,
    );

    return new Map(
      categories
        .map((category) => [
          String(category.category_id ?? '').trim(),
          String(category.category_name ?? '').trim(),
        ] as const)
        .filter(([categoryId, title]) => categoryId && title),
    );
  }
}
