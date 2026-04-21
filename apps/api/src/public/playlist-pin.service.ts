import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 10;
/** bcrypt hashes always start with $2a$ / $2b$ / $2y$. Anything else is legacy plaintext. */
const BCRYPT_PREFIX = /^\$2[aby]\$/;

@Injectable()
export class PlaylistPinService {
  private readonly logger = new Logger(PlaylistPinService.name);

  constructor(private prisma: PrismaService) {}

  /** Produce a hash suitable for storage. Returns null for empty input. */
  async hashForStorage(pin: string | null | undefined): Promise<string | null> {
    const trimmed = (pin ?? '').trim();
    if (!trimmed) return null;
    return bcrypt.hash(trimmed, BCRYPT_ROUNDS);
  }

  /**
   * Verify a submitted PIN against the stored hash.
   * If the stored value is legacy plaintext (pre-migration), we accept a
   * matching plaintext comparison and transparently rehash to bcrypt.
   */
  async verify(playlistId: string, submittedPin: string): Promise<boolean> {
    const trimmed = (submittedPin ?? '').trim();
    if (!trimmed) return false;

    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      select: { id: true, pinHash: true, isProtected: true },
    });

    if (!playlist || !playlist.isProtected || !playlist.pinHash) {
      return false;
    }

    if (BCRYPT_PREFIX.test(playlist.pinHash)) {
      return bcrypt.compare(trimmed, playlist.pinHash);
    }

    // Legacy plaintext path — constant-time compare, then upgrade on success.
    const matches = timingSafeEqualStr(trimmed, playlist.pinHash);
    if (matches) {
      const rehashed = await bcrypt.hash(trimmed, BCRYPT_ROUNDS);
      await this.prisma.playlist
        .update({
          where: { id: playlist.id },
          data: { pinHash: rehashed },
        })
        .catch((err) => {
          this.logger.warn(
            `Failed to upgrade legacy PIN for playlist ${playlist.id}: ${err}`,
          );
        });
      this.logger.log(`Upgraded legacy PIN to bcrypt for playlist ${playlist.id}`);
    }
    return matches;
  }
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
