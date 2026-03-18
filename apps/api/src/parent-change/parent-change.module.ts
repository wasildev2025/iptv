import { Module } from '@nestjs/common';
import { ParentChangeService } from './parent-change.service';
import { ParentChangeController } from './parent-change.controller';

@Module({
  controllers: [ParentChangeController],
  providers: [ParentChangeService],
  exports: [ParentChangeService],
})
export class ParentChangeModule {}
