import { Module } from '@nestjs/common';
import { KitechensService } from './kitechens.service';
import { KitechensController } from './kitechens.controller';

@Module({
  controllers: [KitechensController],
  providers: [KitechensService],
})
export class KitechensModule {}
