import { IsString, IsNumber, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty({ description: 'e.g., MONTHLY or YEARLY' })
  @IsString()
  billingCycle: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  features?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripeProductId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripePriceId?: string;
}

export class UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SubscribeDto {
  @ApiProperty()
  @IsString()
  planId: string;
}
