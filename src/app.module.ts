import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { UsersService } from './modules/users/users.service';
import { HoursModule } from './modules/hours/hours.module';
import { RequestsModule } from './modules/requests/requests.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NetworkModule } from './modules/network/network.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { ParametersModule } from './modules/parameters/parameters.module';
import { ParametersService } from './modules/parameters/parameters.service';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST'),
        port: +config.get<number>('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
        logging: true,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    HoursModule,
    RequestsModule,
    ReportsModule,
    NetworkModule,
    ChatbotModule,
    ParametersModule,
    SettingsModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private usersService: UsersService,
    private parametersService: ParametersService,
  ) {}

  async onModuleInit() {
    await this.usersService.seedAdmin();
    await this.parametersService.seedDefaultParameters();
  }
}
