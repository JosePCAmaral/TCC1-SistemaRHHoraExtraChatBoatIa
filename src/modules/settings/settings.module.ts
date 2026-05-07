import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { User } from '../users/entities/user.entity';
import { HourRecord } from '../hours/entities/hour-record.entity';
import { Request } from '../requests/entities/request.entity';
import { NetworkIp } from '../network/entities/network-ip.entity';
import { AccessLog } from '../network/entities/access-log.entity';
import { ChatMessage } from '../chatbot/entities/chat-message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, HourRecord, Request, NetworkIp, AccessLog, ChatMessage]),
  ],
  controllers: [SettingsController],
})
export class SettingsModule {}
