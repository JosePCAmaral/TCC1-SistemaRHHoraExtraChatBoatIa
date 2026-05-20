import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeriodosService } from './periodos.service';
import { PeriodosController } from './periodos.controller';
import { Periodo } from './entities/periodo.entity';
import { PeriodUserBalance } from './entities/period-user-balance.entity';
import { PeriodAmendment } from './entities/period-amendment.entity';
import { HourRecord } from '../hours/entities/hour-record.entity';
import { User } from '../users/entities/user.entity';
import { Request } from '../requests/entities/request.entity';
import { HoursModule } from '../hours/hours.module';
import { ParametersModule } from '../parameters/parameters.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Periodo, PeriodUserBalance, PeriodAmendment, HourRecord, User, Request]),
    forwardRef(() => HoursModule),
    ParametersModule,
  ],
  providers: [PeriodosService],
  controllers: [PeriodosController],
  exports: [PeriodosService],
})
export class PeriodosModule {}
