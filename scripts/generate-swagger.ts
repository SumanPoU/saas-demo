import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';

async function generateSwagger() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SaaS Multi-Tenant API')
    .setDescription('Auto-generated OpenAPI specification for the SaaS Demo application.')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token to authenticate',
      in: 'header',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  fs.writeFileSync('./swagger-spec.json', JSON.stringify(document, null, 2));
  console.log('Swagger specification successfully generated at ./swagger-spec.json');
  
  await app.close();
}

generateSwagger().catch((err) => {
  console.error(err);
  process.exit(1);
});
