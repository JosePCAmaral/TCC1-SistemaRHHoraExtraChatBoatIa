import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HoursService } from './hours.service';
import { HoursController } from './hours.controller';
import { HourRecord } from './entities/hour-record.entity';
import { User } from '../users/entities/user.entity';
import { NetworkModule } from '../network/network.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HourRecord, User]),
    NetworkModule,
  ],
  providers: [HoursService],
  controllers: [HoursController],
  exports: [HoursService],
})
export class HoursModule {}
