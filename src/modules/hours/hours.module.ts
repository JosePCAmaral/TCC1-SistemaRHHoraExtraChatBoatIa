import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HoursService } from './hours.service';
import { HoursController } from './hours.controller';
import { HourRecord } from './entities/hour-record.entity';
import { User } from '../users/entities/user.entity';
import { NetworkModule } from '../network/network.module';
import { ParametersModule } from '../parameters/parameters.module';
import { PeriodosModule } from '../periodos/periodos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HourRecord, User]),
    NetworkModule,
    ParametersModule,
    forwardRef(() => PeriodosModule),
  ],
  providers: [HoursService],
  controllers: [HoursController],
  exports: [HoursService],
})
export class HoursModule {}
