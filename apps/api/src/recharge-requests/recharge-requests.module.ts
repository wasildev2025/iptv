import { Module } from '@nestjs/common';
import { RechargeRequestsService } from './recharge-requests.service';
import { RechargeRequestsController } from './recharge-requests.controller';

@Module({
  controllers: [RechargeRequestsController],
  providers: [RechargeRequestsService],
  exports: [RechargeRequestsService],
})
export class RechargeRequestsModule {}
