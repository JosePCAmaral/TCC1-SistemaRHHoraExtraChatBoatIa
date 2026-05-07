import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParametersService } from './parameters.service';
import { ParametersController } from './parameters.controller';
import { Parameter } from './entities/parameter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Parameter])],
  providers: [ParametersService],
  controllers: [ParametersController],
  exports: [ParametersService],
})
export class ParametersModule {}
