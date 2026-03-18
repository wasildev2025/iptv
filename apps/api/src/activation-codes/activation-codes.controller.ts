import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ActivationCodesService } from './activation-codes.service';
import { CreateCodeDto } from './dto/create-code.dto';
import { ActivateCodeDto } from './dto/activate-code.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Activation Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/activation-codes')
export class ActivationCodesController {
  constructor(private activationCodesService: ActivationCodesService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate activation codes' })
  generate(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCodeDto,
  ) {
    return this.activationCodesService.generate(userId, dto);
  }

  @Post('activate')
  @ApiOperation({ summary: 'Activate a code on a device' })
  activate(
    @CurrentUser('id') userId: string,
    @Body() dto: ActivateCodeDto,
  ) {
    return this.activationCodesService.activate(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user activation codes' })
  findAll(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('per_page') per_page?: number,
    @Query('search_query') search_query?: string,
    @Query('sort_key') sort_key?: string,
    @Query('sort_type') sort_type?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
  ) {
    return this.activationCodesService.findAll(userId, {
      page: Number(page) || 1,
      per_page: Number(per_page) || 20,
      search_query,
      sort_key,
      sort_type,
      date_from,
      date_to,
    });
  }
}
