import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  LEGACY_RUNTIME_CONFIG_KEY,
  LEGACY_RUNTIME_CONFIG_MAP,
  RuntimeConfigDomainKey,
  RuntimeConfigKey,
  RUNTIME_CONFIG_DEFINITIONS,
  RUNTIME_CONFIG_DOMAIN_KEYS,
} from './runtime-config.constants';

type RuntimeConfigCache = Partial<Record<RuntimeConfigDomainKey, unknown>>;

@Injectable()
export class RuntimeConfigService {
  private readonly logger = new Logger(RuntimeConfigService.name);
  private cache: RuntimeConfigCache | null = null;
  private legacyCache: Record<string, unknown> | null = null;
  private cacheExpiresAt = 0;
  private readonly cacheTtlMs = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getString(key: RuntimeConfigKey): Promise<string> {
    const value = await this.getValue(key);
    return String(value);
  }

  async getNumber(key: RuntimeConfigKey): Promise<number> {
    const value = await this.getValue(key);
    const parsed =
      typeof value === 'number' ? value : Number.parseInt(String(value), 10);

    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return this.getDefaultValue(key) as number;
  }

  async getConfig(key: RuntimeConfigDomainKey) {
    const runtimeConfig = await this.getRuntimeConfig();
    return this.normalizeDomainConfig(key, runtimeConfig[key]);
  }

  async getBcryptSaltRounds(): Promise<number> {
    const rounds = await this.getNumber('BCRYPT_SALT_ROUNDS');
    return Math.min(Math.max(rounds, 4), 15);
  }

  clearCache(): void {
    this.cache = null;
    this.legacyCache = null;
    this.cacheExpiresAt = 0;
  }

  private async getValue(key: RuntimeConfigKey): Promise<unknown> {
    const mapping = LEGACY_RUNTIME_CONFIG_MAP[key];
    const domainConfig = await this.getConfig(mapping.key);
    const dbValue = domainConfig[mapping.field];

    if (dbValue !== undefined && dbValue !== null && dbValue !== '') {
      return dbValue;
    }

    const legacyValue = await this.getLegacyValue(key);
    if (
      legacyValue !== undefined &&
      legacyValue !== null &&
      legacyValue !== ''
    ) {
      return legacyValue;
    }

    const envValue = this.config.get<string | number>(key);
    if (envValue !== undefined && envValue !== null && envValue !== '') {
      return envValue;
    }

    return this.getDefaultValue(key);
  }

  private async getRuntimeConfig(): Promise<RuntimeConfigCache> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    try {
      const records = await this.prisma.globalConfig.findMany({
        where: { key: { in: [...RUNTIME_CONFIG_DOMAIN_KEYS] } },
      });

      this.cache = records.reduce<RuntimeConfigCache>((config, record) => {
        if (this.isRuntimeConfigDomainKey(record.key)) {
          config[record.key] = record.value;
        }
        return config;
      }, {});
      this.cacheExpiresAt = now + this.cacheTtlMs;
      return this.cache;
    } catch (error) {
      this.logger.warn(
        `Falling back to environment/default runtime config: ${
          (error as Error).message
        }`,
      );
      this.cache = {};
      this.legacyCache = {};
      this.cacheExpiresAt = now + this.cacheTtlMs;
      return this.cache;
    }
  }

  private async getLegacyValue(key: RuntimeConfigKey): Promise<unknown> {
    if (this.legacyCache) {
      return this.legacyCache[key];
    }

    try {
      const record = await this.prisma.globalConfig.findUnique({
        where: { key: LEGACY_RUNTIME_CONFIG_KEY },
      });

      const legacyCache: Record<string, unknown> =
        record?.value &&
        typeof record.value === 'object' &&
        !Array.isArray(record.value)
          ? record.value
          : {};

      this.legacyCache = legacyCache;
      return legacyCache[key];
    } catch {
      this.legacyCache = {};
      return undefined;
    }
  }

  private normalizeDomainConfig(key: RuntimeConfigDomainKey, value: unknown) {
    const defaults = RUNTIME_CONFIG_DEFINITIONS[key].defaults;
    const config =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    return Object.entries(defaults).reduce<Record<string, string | number>>(
      (normalized, [field, defaultValue]) => {
        const value = config[field];
        normalized[field] =
          value === undefined || value === null || value === ''
            ? defaultValue
            : this.coerceValue(defaultValue, value);
        return normalized;
      },
      {},
    );
  }

  private getDefaultValue(key: RuntimeConfigKey) {
    const mapping = LEGACY_RUNTIME_CONFIG_MAP[key];
    return RUNTIME_CONFIG_DEFINITIONS[mapping.key].defaults[mapping.field];
  }

  private coerceValue(defaultValue: string | number, value: unknown) {
    if (typeof defaultValue !== 'number') {
      return String(value);
    }

    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  private isRuntimeConfigDomainKey(key: string): key is RuntimeConfigDomainKey {
    return RUNTIME_CONFIG_DOMAIN_KEYS.includes(key as RuntimeConfigDomainKey);
  }
}
