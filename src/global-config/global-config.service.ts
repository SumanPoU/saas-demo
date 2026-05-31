import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  RuntimeConfigDomainKey,
  RUNTIME_CONFIG_DEFINITIONS,
  RUNTIME_CONFIG_DOMAIN_KEYS,
} from '../config/runtime-config.constants';
import { RuntimeConfigService } from '../config/runtime-config.service';

type GlobalConfigInput = {
  key: string;
  value: Record<string, unknown>;
  category?: string;
  updatedBy?: string;
};

@Injectable()
export class GlobalConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeConfig: RuntimeConfigService,
  ) {}

  async getConfigs(category?: string) {
    return this.prisma.globalConfig.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async getConfigByKey(key: string) {
    const record = await this.prisma.globalConfig.findUnique({
      where: { key },
    });

    if (!record) {
      throw new NotFoundException(`Global config "${key}" not found`);
    }

    return this.serializeConfig(record);
  }

  async createConfig(input: GlobalConfigInput) {
    const existing = await this.prisma.globalConfig.findUnique({
      where: { key: input.key },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        `Global config "${input.key}" already exists`,
      );
    }

    const record = await this.prisma.globalConfig.create({
      data: {
        key: input.key,
        value: input.value as Prisma.InputJsonValue,
        category: input.category ?? this.getDefaultCategory(input.key),
        updatedBy: input.updatedBy,
      },
    });

    this.runtimeConfig.clearCache();
    return this.serializeConfig(record);
  }

  async updateConfigByKey(key: string, input: Omit<GlobalConfigInput, 'key'>) {
    await this.getConfigByKey(key);

    const record = await this.prisma.globalConfig.update({
      where: { key },
      data: {
        value: input.value as Prisma.InputJsonValue,
        category: input.category ?? this.getDefaultCategory(key),
        updatedBy: input.updatedBy,
      },
    });

    this.runtimeConfig.clearCache();
    return this.serializeConfig(record);
  }

  private serializeConfig(record: {
    key: string;
    value: Prisma.JsonValue;
    category: string | null;
    updatedBy: string | null;
    updatedAt: Date;
  }) {
    return {
      key: record.key,
      category: record.category,
      value: this.isRuntimeConfigDomainKey(record.key)
        ? this.normalizeRuntimeConfig(record.key, record.value)
        : record.value,
      updatedBy: record.updatedBy,
      updatedAt: record.updatedAt,
    };
  }

  private normalizeRuntimeConfig(
    key: RuntimeConfigDomainKey,
    value?: Prisma.JsonValue | null,
  ) {
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

  private coerceValue(defaultValue: string | number, value: unknown) {
    if (typeof defaultValue !== 'number') {
      return String(value);
    }

    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  private getDefaultCategory(key: string) {
    return this.isRuntimeConfigDomainKey(key)
      ? RUNTIME_CONFIG_DEFINITIONS[key].category
      : undefined;
  }

  private isRuntimeConfigDomainKey(key: string): key is RuntimeConfigDomainKey {
    return RUNTIME_CONFIG_DOMAIN_KEYS.includes(key as RuntimeConfigDomainKey);
  }
}
