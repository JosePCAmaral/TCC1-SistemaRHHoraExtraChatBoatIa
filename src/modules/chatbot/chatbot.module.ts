import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import { HourRecord } from '../hours/entities/hour-record.entity';
import { Request } from '../requests/entities/request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage, User, HourRecord, Request])],
  providers: [ChatbotService],
  controllers: [ChatbotController],
  exports: [ChatbotService],
})
export class ChatbotModule {}
