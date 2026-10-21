import { PrismaClient, Deal } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

/**
 * Deal identifiers that can be used to find an existing deal.
 */
export interface DealIdentifiers {
  dealId?: string;
  accountId?: string;
  opportunityName?: string;
}

/**
 * Data for creating or updating a deal
 */
export interface DealData {
  opportunityName: string;
  companyName?: string;
  accountId: string;
  stage?: string;
  status?: string;
  progressPercentage?: number;
  closeDate?: Date;
  notes?: string;
}

/**
 * DealService - Centralized service for all deal operations.
 *
 * GUARANTEES:
 * 1. Reuses existing active deals for an account (prevents duplicates)
 * 2. Proper linking to accounts
 */
export const DealService = {
  /**
   * Find an existing deal by identifiers.
   */
  async findByIdentifiers(identifiers: DealIdentifiers): Promise<Deal | null> {
    if (identifiers.dealId) {
      return prisma.deal.findUnique({
        where: { dealId: identifiers.dealId },
      });
    }

    // Find by account + optional name match
    if (identifiers.accountId) {
      const conditions: any = {
        accountId: identifiers.accountId,
        status: 'active',
      };

      if (identifiers.opportunityName) {
        conditions.opportunityName = {
          equals: identifiers.opportunityName,
          mode: 'insensitive',
        };
      }

      return prisma.deal.findFirst({
        where: conditions,
        orderBy: { createdAt: 'desc' },
      });
    }

    return null;
  },

  /**
   * Find active deal for an account, or create a new one.
   *
   * Strategy:
   * - If forceCreate is true, always create a new deal
   * - If an active deal exists for this account, return it
   * - If no active deal exists, create a new one
   *
   * @param data - Deal data (accountId required)
   * @param forceCreate - If true, always create a new deal even if one exists
   */
  async findOrCreateForAccount(
    data: DealData,
    forceCreate: boolean = false
  ): Promise<{ deal: Deal; created: boolean }> {
    // If forceCreate is not set, try to find existing active deal for this account
    if (!forceCreate) {
      const existing = await prisma.deal.findFirst({
        where: {
          accountId: data.accountId,
          status: 'active',
        },
        include: { account: true },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        return { deal: existing, created: false };
      }
    }

    // Get account for company name
    const account = await prisma.account.findUnique({
      where: { accountId: data.accountId },
    });

    // Create new deal
    const created = await prisma.deal.create({
      data: {
        dealId: randomUUID(),
        opportunityName: data.opportunityName,
        companyName: data.companyName || account?.name || 'Northstar Integrators',
        account: { connect: { accountId: data.accountId } },
        stage: data.stage || 'prospecting',
        status: data.status || 'active',
        progressPercentage: data.progressPercentage || 10,
        closeDate: data.closeDate || null,
        notes: data.notes || null,
      },
      include: { account: true },
    });

    return { deal: created, created: true };
  },

  /**
   * Get deal by ID with account
   */
  async getById(dealId: string): Promise<Deal | null> {
    return prisma.deal.findUnique({
      where: { dealId },
      include: { account: true },
    });
  },

  /**
   * Get all deals for an account
   */
  async getByAccountId(accountId: string): Promise<Deal[]> {
    return prisma.deal.findMany({
      where: { accountId },
      include: { account: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Get all active deals
   */
  async getActiveDeals(): Promise<Deal[]> {
    return prisma.deal.findMany({
      where: { status: 'active' },
      include: { account: true },
      orderBy: { createdAt: 'desc' },
    });
  },
};

export default DealService;
