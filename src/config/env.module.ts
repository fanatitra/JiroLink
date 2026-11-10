import { Global, Module } from '@nestjs/common';
import { chargerEnv, ENV } from './env';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => chargerEnv() }],
  exports: [ENV],
})
export class EnvModule {}
