import { PrismaClient, Account } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

/**
 * Account identifiers that can be used to find an existing account.
 */
export interface AccountIdentifiers {
  accountId?: string;
  name?: string;
  domain?: string;
}

/**
 * Data for creating or updating an account
 */
export interface AccountData {
  name: string;
  domain?: string;
  industry?: string;
  location?: string;
  owner?: string;
}

/**
 * AccountService - Centralized service for all account operations.
 *
 * GUARANTEES:
 * 1. No duplicate accounts for the same company (by name or domain)
 * 2. Case-insensitive matching on name and domain
 */
export const AccountService = {
  /**
   * Find an existing account by any identifier.
   * Checks: accountId, name (case-insensitive), domain (case-insensitive)
   */
  async findByIdentifiers(identifiers: AccountIdentifiers): Promise<Account | null> {
    const conditions: any[] = [];

    if (identifiers.accountId) {
      conditions.push({ accountId: identifiers.accountId });
    }

    if (identifiers.name) {
      conditions.push({ name: { equals: identifiers.name, mode: 'insensitive' } });
    }

    if (identifiers.domain) {
      conditions.push({ domain: { equals: identifiers.domain, mode: 'insensitive' } });
    }

    if (conditions.length === 0) {
      return null;
    }

    return prisma.account.findFirst({
      where: { OR: conditions },
    });
  },

  /**
   * Find or create an account. This is the PRIMARY method for getting an account reference.
   *
   * - If an account exists with the same name or domain, returns it
   * - If no account exists, creates a new one
   *
   * @param data - Account data (name required)
   * @param updateIfExists - If true, updates existing account with provided data
   */
  async findOrCreate(
    data: AccountData,
    updateIfExists: boolean = false
  ): Promise<{ account: Account; created: boolean }> {
    // First, try to find existing account by name or domain
    const existing = await this.findByIdentifiers({
      name: data.name,
      domain: data.domain,
    });

    if (existing) {
      if (updateIfExists) {
        // Update with new data (only fill in missing fields)
        const updated = await prisma.account.update({
          where: { accountId: existing.accountId },
          data: {
            domain: data.domain && !existing.domain ? data.domain : undefined,
            industry: data.industry && !existing.industry ? data.industry : undefined,
            location: data.location && !existing.location ? data.location : undefined,
            owner: data.owner && !existing.owner ? data.owner : undefined,
          },
        });
        return { account: updated, created: false };
      }
      return { account: existing, created: false };
    }

    // Create new account
    const created = await prisma.account.create({
      data: {
        accountId: randomUUID(),
        name: data.name,
        domain: data.domain || null,
        industry: data.industry || null,
        location: data.location || null,
        owner: data.owner || null,
      },
    });

    return { account: created, created: true };
  },

  /**
   * Get account by ID
   */
  async getById(accountId: string): Promise<Account | null> {
    return prisma.account.findUnique({
      where: { accountId },
    });
  },

  /**
   * Get all accounts
   */
  async getAll(): Promise<Account[]> {
    return prisma.account.findMany({
      orderBy: { name: 'asc' },
    });
  },
};

export default AccountService;
