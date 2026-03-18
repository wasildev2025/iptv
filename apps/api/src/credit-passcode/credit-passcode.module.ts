import { Module } from '@nestjs/common';
import { CreditPasscodeService } from './credit-passcode.service';
import { CreditPasscodeController } from './credit-passcode.controller';

@Module({
  controllers: [CreditPasscodeController],
  providers: [CreditPasscodeService],
  exports: [CreditPasscodeService],
})
export class CreditPasscodeModule {}
