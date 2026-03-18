import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreditPasscodeService } from './credit-passcode.service';
import { SetPasscodeDto } from './dto/set-passcode.dto';
import { UpdatePasscodeDto } from './dto/update-passcode.dto';
import { ValidatePasscodeDto } from './dto/validate-passcode.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Credit Passcode')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@Controller('api/credit-passcode')
export class CreditPasscodeController {
  constructor(private creditPasscodeService: CreditPasscodeService) {}

  @Post('set')
  @ApiOperation({ summary: 'Set credit share passcode (first time)' })
  set(
    @CurrentUser('id') userId: string,
    @Body() dto: SetPasscodeDto,
  ) {
    return this.creditPasscodeService.set(userId, dto.passcode);
  }

  @Post('update')
  @ApiOperation({ summary: 'Update credit share passcode' })
  update(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePasscodeDto,
  ) {
    return this.creditPasscodeService.update(
      userId,
      dto.old_passcode,
      dto.new_passcode,
    );
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate passcode before credit transfer' })
  validate(
    @CurrentUser('id') userId: string,
    @Body() dto: ValidatePasscodeDto,
  ) {
    return this.creditPasscodeService.validate(userId, dto.passcode);
  }
}
