import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: 'http://localhost:4200', // Angular dev server
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 RHIANA API rodando em: http://localhost:3000/api`);
}
bootstrap();
