import { environment } from './environment.prod';
import { environment as devEnvironment } from './environment';

// Task 4 (production config): a production bundle must never carry a
// developer address. The DEV environment may keep localhost (local work
// only); the PROD one is pinned here and re-checked for the whole bundle by
// scripts/check-production-hygiene.sh (grep over dist/).
describe('environment files', () => {
  it('the production environment never points at localhost or an emulator address', () => {
    expect(environment.production).toBe(true);
    const serialized = JSON.stringify(environment).toLowerCase();
    expect(serialized).not.toContain('localhost');
    expect(serialized).not.toContain('127.0.0.1');
  });

  it('the dev environment keeps its local API URL but is explicitly non-production', () => {
    expect(devEnvironment.production).toBe(false);
    expect(devEnvironment.apiBaseUrl).toContain('localhost');
  });
});
