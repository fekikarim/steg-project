import type {routing} from './routing';
import type fr from '../messages/fr.json';

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof fr;
  }
}
