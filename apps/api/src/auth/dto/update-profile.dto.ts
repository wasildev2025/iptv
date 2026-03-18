import { IsString, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(['en', 'pt', 'es', 'fr', 'nl'])
  language?: string;
}
