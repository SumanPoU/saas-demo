import { PaginationService } from './pagination.service';

describe('PaginationService', () => {
  let service: PaginationService;

  beforeEach(() => {
    service = new PaginationService();
  });

  it('applies skip/take and returns pagination metadata', async () => {
    const delegate = {
      findMany: jest.fn().mockResolvedValue([{ id: 'item-1' }]),
      count: jest.fn().mockResolvedValue(51),
    };

    const result = await service.paginate(
      delegate,
      { page: 2, limit: 25 },
      { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
    );

    expect(delegate.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      skip: 25,
      take: 25,
    });
    expect(delegate.count).toHaveBeenCalledWith({
      where: { isActive: true },
    });
    expect(result).toEqual({
      data: [{ id: 'item-1' }],
      meta: {
        total: 51,
        page: 2,
        limit: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      },
    });
  });

  it('falls back to default page and limit for invalid values', async () => {
    const delegate = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };

    const result = await service.paginate(delegate, { page: 0, limit: -1 });

    expect(delegate.findMany).toHaveBeenCalledWith({ skip: 0, take: 25 });
    expect(result.meta).toMatchObject({
      page: 1,
      limit: 25,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });
});
