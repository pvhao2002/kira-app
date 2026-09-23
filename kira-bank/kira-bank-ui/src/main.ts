import {bootstrapApplication} from '@angular/platform-browser';
import {appConfig} from './app/app.config';
import {preloadLanguage} from './app/core/i18n/language.service';
import {App} from './app/app';

void preloadLanguage().then(() => bootstrapApplication(App, appConfig).catch(console.error));
