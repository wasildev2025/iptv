import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { MetadataService } from './metadata.service';

@ApiTags('Metadata')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/metadata')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Post('enrich')
  async enrich(@Body() payload: unknown) {
    return this.metadataService.enrichPayload(payload);
  }
}
