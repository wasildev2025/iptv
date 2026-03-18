import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ResellersService } from './resellers.service';
import { CreateResellerDto, UpdateResellerDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Resellers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.reseller)
@Controller('api/resellers')
export class ResellersController {
  constructor(private resellersService: ResellersService) {}

  @Get()
  @ApiOperation({ summary: 'List sub-resellers (paginated, searchable)' })
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.resellersService.findAll(userId, role, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search,
      isActive,
    });
  }

  @Get('hierarchy-stats')
  @ApiOperation({ summary: 'Get aggregate stats across all sub-resellers' })
  getHierarchyStats(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.resellersService.getHierarchyStats(userId, role);
  }

  @Post()
  @ApiOperation({ summary: 'Create a sub-reseller' })
  create(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreateResellerDto,
    @Req() req: any,
  ) {
    return this.resellersService.create(userId, role, dto, req.ip);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sub-reseller details with stats' })
  findOne(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.resellersService.findOne(userId, role, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update sub-reseller (name, margin, status)' })
  update(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body() dto: UpdateResellerDto,
    @Req() req: any,
  ) {
    return this.resellersService.update(userId, role, id, dto, req.ip);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete sub-reseller (safe — checks for active devices)' })
  remove(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.resellersService.remove(userId, role, id, req.ip);
  }

  @Get(':id/devices')
  @ApiOperation({ summary: 'View sub-reseller devices' })
  getDevices(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.resellersService.getSubResellerDevices(userId, role, id, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      status,
    });
  }
}
