import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(3000); // Docker 컨테이너 내부에서 3000번 포트로 실행
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();