import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class TestSeedGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const enabled =
      String(process.env.ENABLE_TEST_SEED_API ?? '').toLowerCase() === 'true';
    const isProd =
      String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';
    if (!enabled || isProd) {
      // Hide endpoint by default
      throw new NotFoundException();
    }
    return true;
  }
}

