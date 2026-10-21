import { ConfigService } from '@nestjs/config';

/** Refuse the example keys already shipped in config; never log their values. */
export function assertSigningConfiguration(config: ConfigService): void {
  for (const name of [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CUSTOMER_JWT_SECRET',
  ]) {
    const value = config.get<string>(name);
    if (name === 'CUSTOMER_JWT_SECRET' && !value) continue;
    if (
      !value?.trim() ||
      [
        'your_secret_key',
        'your_refresh_secret_key',
        'your_customer_secret_key',
      ].includes(value) ||
      value.startsWith('replace-with-')
    ) {
      throw new Error(
        `${name} must be a private signing key, not an example value`,
      );
    }
  }
}
