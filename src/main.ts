import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
    origin: 'http://localhost:4200',
    credentials: true,
  });

  // Configuração do Swagger
  const config = new DocumentBuilder()
    .setTitle('RHIANA API')
    .setDescription(`
## Sistema de Gestão de RH com IA

A **RHIANA API** é o backend do sistema de gestão de recursos humanos com foco em:
- ⏱️ Controle de jornada e horas extras (conforme CLT)
- 👥 Gestão de colaboradores
- 📊 Relatórios e dashboards
- 🤖 Chatbot com IA integrada
- 🔒 Conformidade com LGPD

---

## Autenticação

Esta API utiliza **JWT (JSON Web Token)**. Para acessar endpoints protegidos:

1. Faça login em \`POST /api/auth/login\`
2. Copie o \`access_token\` retornado
3. Clique no botão **Authorize 🔒** acima
4. Cole o token no formato: \`Bearer SEU_TOKEN_AQUI\`

---

## Perfis de Acesso

| Perfil | Descrição |
|--------|-----------|
| \`admin\` | Acesso total ao sistema |
| \`rh\` | Gestão de colaboradores e relatórios |
| \`colaborador\` | Registro de ponto e consulta própria |

---

## Credenciais de teste

| Campo | Valor |
|-------|-------|
| Email | admin@rhiana.com |
| Senha | Admin@2025 |
    `)
    .setVersion('1.0.0')
    .setContact('RHIANA', '', 'suporte@rhiana.com')
    .setLicense('MIT', '')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Insira o token JWT no formato: Bearer <token>',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Endpoints de autenticação e sessão')
    .addTag('Users', 'Gestão de colaboradores')
    .addTag('Hours', 'Registro de ponto e controle de jornada')
    .addTag('Requests', 'Solicitações de compensação e pagamento')
    .addTag('Reports', 'Relatórios e dashboards analíticos')
    .addTag('Chatbot', 'Integração com IA RHIANA')
    .addTag('Parameters', 'Configurações e parâmetros do sistema')
    .addTag('Network', 'Controle de IPs autorizados')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'RHIANA API Docs',
    customCss: `
      .swagger-ui .topbar { background-color: #1e293b; }
      .swagger-ui .topbar-wrapper img { display: none; }
      .swagger-ui .topbar-wrapper::after {
        content: '🤖 RHIANA API';
        color: white;
        font-size: 1.5rem;
        font-weight: bold;
        padding: 10px;
      }
    `,
  });

  await app.listen(process.env.PORT ?? 5000);
  console.log(`🚀 RHIANA API rodando em: http://localhost:5000/api`);
  console.log(`📚 Documentação Swagger: http://localhost:5000/docs`);
}
bootstrap();
