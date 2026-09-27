import { InjectionToken } from '@nestjs/common';
import type { Redis } from 'ioredis';

export const REDIS_CLIENT: InjectionToken<Redis> = Symbol('REDIS_CLIENT');
