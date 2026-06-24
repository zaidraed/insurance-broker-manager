import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../modules/auth/decorators/public.decorator';
import { HealthService, HealthStatus } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: 'La API y la base de datos están operativas' })
  @ApiServiceUnavailableResponse({ description: 'La base de datos no responde' })
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
