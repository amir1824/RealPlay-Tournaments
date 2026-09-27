import { Global, InjectionToken, Module } from '@nestjs/common';
import { AppConfig, loadAppConfig } from './config';

export const APP_CONFIG: InjectionToken<AppConfig> = Symbol('APP_CONFIG');

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useValue: loadAppConfig() }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
