import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NetworkService } from './network.service';
import { NetworkController } from './network.controller';
import { NetworkIp } from './entities/network-ip.entity';
import { AccessLog } from './entities/access-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NetworkIp, AccessLog])],
  providers: [NetworkService],
  controllers: [NetworkController],
  exports: [NetworkService],
})
export class NetworkModule {}
