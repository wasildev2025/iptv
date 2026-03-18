import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RechargeRequestsService } from './recharge-requests.service';
import { CreateRechargeRequestDto } from './dto/create-recharge-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Recharge Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/recharge-requests')
export class RechargeRequestsController {
  constructor(private rechargeRequestsService: RechargeRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a recharge request' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRechargeRequestDto,
  ) {
    return this.rechargeRequestsService.create(userId, dto);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending recharge requests for me to approve' })
  getPending(@CurrentUser('id') userId: string) {
    return this.rechargeRequestsService.getPending(userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my sent recharge requests' })
  getMy(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('per_page') perPage?: number,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.rechargeRequestsService.getMy(userId, {
      page: Number(page) || 1,
      per_page: Number(perPage) || 20,
      start_date: startDate,
      end_date: endDate,
      search,
    });
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a recharge request' })
  approve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.rechargeRequestsService.approve(id, userId);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a recharge request' })
  reject(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.rechargeRequestsService.reject(id, userId);
  }
}
