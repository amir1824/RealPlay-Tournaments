import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * The client every transaction-bound repository method requires, so a
 * locking query can't be called outside a transaction by mistake.
 */
export type TransactionClient = Prisma.TransactionClient;

export interface TransactionOptions {
  timeoutMs?: number;
}

@Injectable()
export class TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(
    work: (tx: TransactionClient) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    return this.prisma.$transaction(work, { timeout: options.timeoutMs });
  }
}
