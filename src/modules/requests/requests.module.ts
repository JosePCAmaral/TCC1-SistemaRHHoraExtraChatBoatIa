import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { Request } from './entities/request.entity';
import { User } from '../users/entities/user.entity';
import { HourRecord } from '../hours/entities/hour-record.entity';
import { ParametersModule } from '../parameters/parameters.module';

@Module({
  imports: [TypeOrmModule.forFeature([Request, User, HourRecord]), ParametersModule],
  providers: [RequestsService],
  controllers: [RequestsController],
  exports: [RequestsService],
})
export class RequestsModule {}
