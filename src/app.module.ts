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
import { EmpresasModule } from './modules/empresas/empresas.module';
import { PeriodosModule } from './modules/periodos/periodos.module';
import { FeriadosModule } from './modules/feriados/feriados.module';
import { EmpresasService } from './modules/empresas/empresas.service';

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
    EmpresasModule,
    AuthModule,
    UsersModule,
    HoursModule,
    RequestsModule,
    ReportsModule,
    NetworkModule,
    ChatbotModule,
    ParametersModule,
    SettingsModule,
    PeriodosModule,
    FeriadosModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private empresasService: EmpresasService,
    private usersService: UsersService,
    private parametersService: ParametersService,
  ) {}

  async onModuleInit() {
    // Ordem importa: empresa → usuários → parâmetros
    const empresaPadrao = await this.empresasService.seedDefaultEmpresa();
    await this.usersService.seedAdmin(empresaPadrao.id);
    await this.parametersService.seedDefaultParameters();
  }
}
