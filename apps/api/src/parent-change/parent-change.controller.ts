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
import { ParentChangeService } from './parent-change.service';
import { CreateParentChangeDto } from './dto/create-parent-change.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Parent Change')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/parent-change')
export class ParentChangeController {
  constructor(private parentChangeService: ParentChangeService) {}

  @Post('request')
  @ApiOperation({ summary: 'Request a parent change' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateParentChangeDto,
  ) {
    return this.parentChangeService.create(userId, dto);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending parent change requests for me to approve' })
  getPending(@CurrentUser('id') userId: string) {
    return this.parentChangeService.getPending(userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get processed parent change request history' })
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('per_page') perPage?: number,
  ) {
    return this.parentChangeService.getHistory(userId, {
      page: Number(page) || 1,
      per_page: Number(perPage) || 20,
    });
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my sent parent change requests' })
  getMy(@CurrentUser('id') userId: string) {
    return this.parentChangeService.getMy(userId);
  }

  @Get('count')
  @ApiOperation({ summary: 'Count pending parent change requests for me' })
  countPending(@CurrentUser('id') userId: string) {
    return this.parentChangeService.countPending(userId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a parent change request' })
  approve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.parentChangeService.approve(id, userId);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a parent change request' })
  reject(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.parentChangeService.reject(id, userId);
  }
}
