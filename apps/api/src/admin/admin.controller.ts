import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminUpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class AdminResetPasswordDto {
  @ApiProperty({ example: 'NewPass$123' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

@ApiTags('Admin - User Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller('api/admin/users')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'User stats overview' })
  getUserStats() {
    return this.adminService.getUserStats();
  }

  @Get()
  @ApiOperation({ summary: 'List all users (paginated, searchable)' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.findAllUsers({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search,
      role,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details' })
  findOne(@Param('id') id: string) {
    return this.adminService.findOneUser(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser('id') adminId: string,
    @Req() req: any,
  ) {
    return this.adminService.updateUser(id, dto, adminId, req.ip);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Enable/disable user' })
  toggleActive(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Req() req: any,
  ) {
    return this.adminService.toggleUserActive(id, adminId, req.ip);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset user password' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser('id') adminId: string,
    @Req() req: any,
  ) {
    return this.adminService.resetUserPassword(id, dto.newPassword, adminId, req.ip);
  }
}
