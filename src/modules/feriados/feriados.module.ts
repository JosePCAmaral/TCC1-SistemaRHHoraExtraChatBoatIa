import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeriadosService } from './feriados.service';
import { FeriadosController } from './feriados.controller';
import { Feriado } from './entities/feriado.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Feriado])],
  providers: [FeriadosService],
  controllers: [FeriadosController],
  exports: [FeriadosService],
})
export class FeriadosModule {}
