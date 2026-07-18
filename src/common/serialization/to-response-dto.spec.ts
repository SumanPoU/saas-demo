import 'reflect-metadata';
import { Exclude } from 'class-transformer';
import { toResponseDto } from './to-response-dto';

class SampleResponseDto {
  id: string;
  name: string;

  @Exclude()
  secret?: string;
}

describe('toResponseDto', () => {
  it('strips @Exclude fields from the serialized payload', () => {
    const actual = toResponseDto(SampleResponseDto, {
      id: '1',
      name: 'visible',
      secret: 'should-not-leak',
    });

    expect(actual).toEqual({ id: '1', name: 'visible' });
    expect(Object.keys(actual)).not.toContain('secret');
  });
});
