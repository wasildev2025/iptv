import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import { TransferCreditsDto, AdminAdjustCreditsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Credits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/credits')
export class CreditsController {
  constructor(private creditsService: CreditsService) {}

  // ─── User Endpoints ──────────────────────────────────────────────

  @Get('balance')
  @ApiOperation({ summary: 'Get my credit balance' })
  getBalance(@CurrentUser('id') userId: string) {
    return this.creditsService.getBalance(userId);
  }

  @Get('packages')
  @ApiOperation({ summary: 'List available credit packages' })
  getPackages() {
    return this.creditsService.getPackages();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get my transaction history' })
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.creditsService.getHistory(userId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      type,
      dateFrom,
      dateTo,
    });
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfer credits to a sub-reseller' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.reseller)
  transfer(
    @CurrentUser('id') userId: string,
    @Body() dto: TransferCreditsDto,
    @Req() req: any,
  ) {
    return this.creditsService.transfer(userId, dto, req.ip);
  }

  // ─── Admin Endpoints ─────────────────────────────────────────────

  @Post('admin/adjust')
  @ApiOperation({ summary: 'Admin: Adjust any user credits' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  adminAdjust(
    @CurrentUser('id') adminId: string,
    @Body() dto: AdminAdjustCreditsDto,
    @Req() req: any,
  ) {
    return this.creditsService.adminAdjust(adminId, dto, req.ip);
  }

  @Get('admin/user/:userId/balance')
  @ApiOperation({ summary: 'Admin: View any user balance + summary' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  adminGetUserBalance(@Param('userId') userId: string) {
    return this.creditsService.adminGetUserBalance(userId);
  }

  @Get('admin/user/:userId/history')
  @ApiOperation({ summary: 'Admin: View any user transaction history' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  adminGetUserHistory(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    return this.creditsService.adminGetUserHistory(userId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      type,
    });
  }

  @Get('admin/reconcile/:userId')
  @ApiOperation({ summary: 'Admin: Check ledger consistency for a user' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  reconcile(@Param('userId') userId: string) {
    return this.creditsService.reconcile(userId);
  }
}
