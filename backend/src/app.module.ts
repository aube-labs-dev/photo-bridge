import { Module } from '@nestjs/common';
import { PhotoTransferGateway } from './photo-transfer.gateway';

@Module({
  imports: [],
  controllers: [],
  providers: [PhotoTransferGateway],
})
export class AppModule {}