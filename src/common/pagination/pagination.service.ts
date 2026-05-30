import { Injectable } from '@nestjs/common';

export interface PrismaDelegate {
  findMany(args: any): Promise<any[]>;
  count(args?: any): Promise<number>;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

@Injectable()
export class PaginationService {
  async paginate<T>(
    delegate: PrismaDelegate,
    query: { page?: number; limit?: number },
    findManyArgs: any = {},
  ): Promise<PaginatedResult<T>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 25;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      delegate.findMany({ ...findManyArgs, skip, take: limit }),
      delegate.count({ where: findManyArgs.where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}
