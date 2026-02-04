import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  ErrorHandler,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { GlobalErrorHandler } from './services/error-monitoring.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
