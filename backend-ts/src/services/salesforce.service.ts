import axios, { AxiosInstance } from 'axios';
import { getPrismaClient } from '../config/database';
import { getEncryptionService } from '../utils/encryption';
import { AccountService } from './account.service';
import { randomUUID } from 'crypto';
import { getLoggerService } from './logger.service';

const SF_API_VERSION = 'v58.0';
const SF_LOGIN_URL = 'https://login.salesforce.com';

const logger = getLoggerService();

/** Prisma Bytes fields expect Uint8Array in generated types; encryption returns Buffer. */
function toPrismaBytes(
  value: Buffer | null | undefined
): Uint8Array<ArrayBuffer> | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy as Uint8Array<ArrayBuffer>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SalesforceTokenResponse {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  token_type: string;
  issued_at: string;
  id: string;
}

interface SalesforceTokens {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
}

interface SFOpportunity {
  Id: string;
  Name: string;
  Amount?: number;
  CloseDate?: string;
  Probability?: number;
  ForecastCategoryName?: string;
  IsClosed: boolean;
  IsWon: boolean;
  LeadSource?: string;
  NextStep?: string;
  StageName?: string;
  Type?: string;
  ContactId?: string;
  CampaignId?: string;
  FiscalQuarter?: number;
  FiscalYear?: number;
  Description?: string;
  AccountId?: string;
  OwnerId?: string;
  Account?: { Id: string; Name: string };
}

interface SFAccount {
  Id: string;
  Name: string;
  Website?: string;
  Industry?: string;
  AnnualRevenue?: number;
  NumberOfEmployees?: number;
  Phone?: string;
  Type?: string;
  Description?: string;
  ParentId?: string;
  BillingStreet?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingPostalCode?: string;
  BillingCountry?: string;
}

interface SFContact {
  Id: string;
  FirstName?: string;
  LastName: string;
  Email?: string;
  Phone?: string;
  MobilePhone?: string;
  Title?: string;
  Department?: string;
  MailingStreet?: string;
  MailingCity?: string;
  MailingState?: string;
  MailingPostalCode?: string;
  MailingCountry?: string;
  LeadSource?: string;
  Description?: string;
  OwnerId?: string;
  ReportsToId?: string;
  DoNotCall?: boolean;
  HasOptedOutOfEmail?: boolean;
  AccountId?: string;
}

interface ActivityData {
  subject: string;
  body: string;
  type?: string;
  date?: string;
}

interface NoteData {
  title: string;
  body: string;
}

interface SyncSummary {
  accounts: { synced: number; created: number; updated: number; errors: number };
  contacts: { synced: number; created: number; updated: number; errors: number };
  opportunities: { synced: number; created: number; updated: number; errors: number };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class SalesforceService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.SF_CLIENT_ID || '';
    this.clientSecret = process.env.SF_CLIENT_SECRET || '';
    this.redirectUri = process.env.SF_REDIRECT_URI || 'http://localhost:3002/api/salesforce/auth/callback';

    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️  Salesforce OAuth not configured. Set SF_CLIENT_ID and SF_CLIENT_SECRET environment variables.');
    }
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // ─── OAuth ──────────────────────────────────────────────────────────────

  getAuthorizationUrl(state?: string): string {
    let authUrl =
      `${SF_LOGIN_URL}/services/oauth2/authorize` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(this.clientId)}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&scope=${encodeURIComponent('api refresh_token offline_access')}`;

    if (state) {
      authUrl += `&state=${encodeURIComponent(state)}`;
    }

    return authUrl;
  }

  async exchangeCodeForToken(code: string): Promise<SalesforceTokenResponse> {
    const tokenUrl = `${SF_LOGIN_URL}/services/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code,
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return response.data;
  }

  async refreshAccessToken(refreshToken: string): Promise<SalesforceTokenResponse> {
    const tokenUrl = `${SF_LOGIN_URL}/services/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return response.data;
  }

  // ─── Token Persistence ─────────────────────────────────────────────────

  async saveTokensForUser(userId: string, tokenData: SalesforceTokenResponse): Promise<void> {
    const prisma = getPrismaClient();
    const encryption = getEncryptionService();

    await prisma.userAPIKeys.upsert({
      where: { userId },
      update: {
        sfAccessTokenEncrypted: toPrismaBytes(encryption.encrypt(tokenData.access_token)),
        sfRefreshTokenEncrypted: tokenData.refresh_token
          ? toPrismaBytes(encryption.encrypt(tokenData.refresh_token))
          : undefined,
        sfInstanceUrlEncrypted: toPrismaBytes(encryption.encrypt(tokenData.instance_url)),
        hasSalesforceCredentials: true,
        sfTokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      },
      create: {
        userId,
        sfAccessTokenEncrypted: toPrismaBytes(encryption.encrypt(tokenData.access_token)),
        sfRefreshTokenEncrypted: tokenData.refresh_token
          ? toPrismaBytes(encryption.encrypt(tokenData.refresh_token))
          : null,
        sfInstanceUrlEncrypted: toPrismaBytes(encryption.encrypt(tokenData.instance_url)),
        hasSalesforceCredentials: true,
        sfTokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });
  }

  async getTokensForUser(userId: string): Promise<SalesforceTokens | null> {
    const prisma = getPrismaClient();
    const encryption = getEncryptionService();

    const keys = await prisma.userAPIKeys.findUnique({ where: { userId } });
    if (!keys?.hasSalesforceCredentials || !keys.sfAccessTokenEncrypted || !keys.sfInstanceUrlEncrypted) {
      return null;
    }

    return {
      accessToken: encryption.decrypt(keys.sfAccessTokenEncrypted as Buffer) || '',
      refreshToken: keys.sfRefreshTokenEncrypted
        ? encryption.decrypt(keys.sfRefreshTokenEncrypted as Buffer) || ''
        : '',
      instanceUrl: encryption.decrypt(keys.sfInstanceUrlEncrypted as Buffer) || '',
    };
  }

  async getAuthenticatedClient(userId: string): Promise<AxiosInstance> {
    const prisma = getPrismaClient();
    let tokens = await this.getTokensForUser(userId);
    if (!tokens) {
      throw new Error('Salesforce not connected. Please connect via Settings.');
    }

    // Check if token is expiring soon (within 5 minutes)
    const keys = await prisma.userAPIKeys.findUnique({ where: { userId } });
    if (keys?.sfTokenExpiresAt && keys.sfTokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      if (tokens.refreshToken) {
        try {
          const refreshed = await this.refreshAccessToken(tokens.refreshToken);
          await this.saveTokensForUser(userId, {
            ...refreshed,
            refresh_token: refreshed.refresh_token || tokens.refreshToken,
            instance_url: refreshed.instance_url || tokens.instanceUrl,
          });
          tokens = await this.getTokensForUser(userId) as SalesforceTokens;
        } catch (err) {
          logger.warn('[Salesforce] Token refresh failed, using existing token', { error: String(err) });
        }
      }
    }

    return axios.create({
      baseURL: `${tokens.instanceUrl}/services/data/${SF_API_VERSION}`,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async disconnectUser(userId: string): Promise<void> {
    const prisma = getPrismaClient();

    // Try to revoke token
    try {
      const tokens = await this.getTokensForUser(userId);
      if (tokens?.accessToken) {
        await axios.post(`${tokens.instanceUrl}/services/oauth2/revoke`, null, {
          params: { token: tokens.accessToken },
        });
      }
    } catch {
      // Ignore revocation errors
    }

    // Clear tokens from DB
    await prisma.userAPIKeys.updateMany({
      where: { userId },
      data: {
        sfAccessTokenEncrypted: null,
        sfRefreshTokenEncrypted: null,
        sfInstanceUrlEncrypted: null,
        hasSalesforceCredentials: false,
        sfTokenExpiresAt: null,
      },
    });

    // Remove sync records
    await prisma.salesforceSync.deleteMany({ where: { userId } });
  }

  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    lastSyncedAt: Date | null;
    syncStats: { opportunities: number; accounts: number; contacts: number };
  }> {
    const prisma = getPrismaClient();
    const tokens = await this.getTokensForUser(userId);

    if (!tokens) {
      return { connected: false, lastSyncedAt: null, syncStats: { opportunities: 0, accounts: 0, contacts: 0 } };
    }

    const syncRecords = await prisma.salesforceSync.groupBy({
      by: ['objectType'],
      where: { userId, syncStatus: 'synced' },
      _count: { id: true },
      _max: { lastSyncedAt: true },
    });

    let lastSyncedAt: Date | null = null;
    const stats = { opportunities: 0, accounts: 0, contacts: 0 };

    syncRecords.forEach((record: any) => {
      const maxSync = record._max?.lastSyncedAt;
      if (maxSync && (!lastSyncedAt || maxSync > lastSyncedAt)) {
        lastSyncedAt = maxSync;
      }
      if (record.objectType === 'Opportunity') stats.opportunities = record._count.id;
      if (record.objectType === 'Account') stats.accounts = record._count.id;
      if (record.objectType === 'Contact') stats.contacts = record._count.id;
    });

    return { connected: true, lastSyncedAt, syncStats: stats };
  }

  // ─── Query Methods (SF API) ────────────────────────────────────────────

  async queryOpportunities(userId: string): Promise<SFOpportunity[]> {
    const client = await this.getAuthenticatedClient(userId);
    const soql = `
      SELECT Id, Name, Amount, CloseDate, Probability, ForecastCategoryName,
             IsClosed, IsWon, LeadSource, NextStep, StageName, Type,
             ContactId, CampaignId, FiscalQuarter, FiscalYear, Description,
             AccountId, OwnerId, Account.Id, Account.Name
      FROM Opportunity
      WHERE IsClosed = false
      ORDER BY CloseDate ASC
      LIMIT 200
    `.replace(/\n/g, ' ').trim();

    const response = await client.get('/query', { params: { q: soql } });
    return response.data.records || [];
  }

  async queryAccounts(userId: string, accountIds: string[]): Promise<SFAccount[]> {
    if (accountIds.length === 0) return [];
    const client = await this.getAuthenticatedClient(userId);
    const idList = accountIds.map((id) => `'${id}'`).join(',');
    const soql = `
      SELECT Id, Name, Website, Industry, AnnualRevenue, NumberOfEmployees,
             Phone, Type, Description, ParentId,
             BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry
      FROM Account
      WHERE Id IN (${idList})
    `.replace(/\n/g, ' ').trim();

    const response = await client.get('/query', { params: { q: soql } });
    return response.data.records || [];
  }

  async queryContacts(userId: string, contactIds: string[]): Promise<SFContact[]> {
    if (contactIds.length === 0) return [];
    const client = await this.getAuthenticatedClient(userId);
    const idList = contactIds.map((id) => `'${id}'`).join(',');
    const soql = `
      SELECT Id, FirstName, LastName, Email, Phone, MobilePhone, Title,
             Department, MailingStreet, MailingCity, MailingState, MailingPostalCode,
             MailingCountry, LeadSource, Description, OwnerId, ReportsToId,
             DoNotCall, HasOptedOutOfEmail, AccountId
      FROM Contact
      WHERE Id IN (${idList})
    `.replace(/\n/g, ' ').trim();

    const response = await client.get('/query', { params: { q: soql } });
    return response.data.records || [];
  }

  // ─── Sync Logic (SF → App) ─────────────────────────────────────────────

  async syncAll(userId: string): Promise<SyncSummary> {
    logger.info('[Salesforce] Starting full sync', { userId });

    // 1. Fetch open Opportunities from SF
    const sfOpportunities = await this.queryOpportunities(userId);
    logger.info(`[Salesforce] Fetched ${sfOpportunities.length} opportunities`);

    // 2. Collect unique Account and Contact IDs
    const accountIds = [...new Set(sfOpportunities.map((o) => o.AccountId).filter(Boolean))] as string[];
    const contactIds = [...new Set(sfOpportunities.map((o) => o.ContactId).filter(Boolean))] as string[];

    // 3. Batch-fetch related objects
    const sfAccounts = await this.queryAccounts(userId, accountIds);
    const sfContacts = await this.queryContacts(userId, contactIds);

    // 4. Sync in order: Accounts → Contacts → Opportunities
    const accountResult = await this.syncAccounts(userId, sfAccounts);
    const contactResult = await this.syncContacts(userId, sfContacts);
    const opportunityResult = await this.syncOpportunities(userId, sfOpportunities);

    const summary: SyncSummary = {
      accounts: accountResult,
      contacts: contactResult,
      opportunities: opportunityResult,
    };

    logger.info('[Salesforce] Sync completed', { summary });
    return summary;
  }

  private async syncAccounts(
    userId: string,
    sfAccounts: SFAccount[]
  ): Promise<{ synced: number; created: number; updated: number; errors: number }> {
    const prisma = getPrismaClient();
    const result = { synced: 0, created: 0, updated: 0, errors: 0 };

    for (const sfAccount of sfAccounts) {
      try {
        // Look up by salesforceId first
        let account = await prisma.account.findUnique({ where: { salesforceId: sfAccount.Id } });

        // Fallback: name-based dedup
        if (!account) {
          const { account: found } = await AccountService.findOrCreate(
            {
              name: sfAccount.Name,
              domain: this.extractDomain(sfAccount.Website),
              industry: sfAccount.Industry,
            },
            false // don't update yet
          );
          account = found;
        }

        // Build update data (SF-owned fields only)
        const updateData: any = {
          salesforceId: sfAccount.Id,
          name: sfAccount.Name,
          industry: sfAccount.Industry || undefined,
          annualRevenue: sfAccount.AnnualRevenue || undefined,
          numberOfEmployees: sfAccount.NumberOfEmployees || undefined,
          phone: sfAccount.Phone || undefined,
          type: sfAccount.Type || undefined,
          billingStreet: sfAccount.BillingStreet || undefined,
          billingCity: sfAccount.BillingCity || undefined,
          billingState: sfAccount.BillingState || undefined,
          billingPostalCode: sfAccount.BillingPostalCode || undefined,
          billingCountry: sfAccount.BillingCountry || undefined,
        };

        if (sfAccount.Website) {
          updateData.website = sfAccount.Website;
          updateData.domain = this.extractDomain(sfAccount.Website);
        }

        // Resolve parent account
        if (sfAccount.ParentId) {
          const parent = await prisma.account.findUnique({
            where: { salesforceId: sfAccount.ParentId },
            select: { accountId: true },
          });
          if (parent) updateData.parentAccountId = parent.accountId;
        }

        // Remove undefined values
        Object.keys(updateData).forEach((key) => {
          if (updateData[key] === undefined) delete updateData[key];
        });

        if (account) {
          await prisma.account.update({ where: { accountId: account.accountId }, data: updateData });
          result.updated++;
        } else {
          await prisma.account.create({
            data: { accountId: randomUUID(), ...updateData, name: sfAccount.Name },
          });
          result.created++;
        }

        // Track sync
        await this.upsertSyncRecord(userId, 'Account', sfAccount.Id, account?.accountId || null);
        result.synced++;
      } catch (err) {
        logger.error(`[Salesforce] Failed to sync account ${sfAccount.Id}: ${String(err)}`);
        result.errors++;
      }
    }

    return result;
  }

  private async syncContacts(
    userId: string,
    sfContacts: SFContact[]
  ): Promise<{ synced: number; created: number; updated: number; errors: number }> {
    const prisma = getPrismaClient();
    const result = { synced: 0, created: 0, updated: 0, errors: 0 };

    for (const sfContact of sfContacts) {
      try {
        // Look up by salesforceId first
        let contact = await prisma.contact.findUnique({ where: { salesforceId: sfContact.Id } });

        // Fallback: email-based dedup
        if (!contact && sfContact.Email) {
          contact = await prisma.contact.findFirst({
            where: { email: { equals: sfContact.Email, mode: 'insensitive' } },
          });
        }

        // Resolve accountId from SF AccountId
        let accountId: string | undefined;
        if (sfContact.AccountId) {
          const account = await prisma.account.findUnique({
            where: { salesforceId: sfContact.AccountId },
            select: { accountId: true },
          });
          if (account) accountId = account.accountId;
        }

        const data: any = {
          salesforceId: sfContact.Id,
          firstName: sfContact.FirstName || undefined,
          lastName: sfContact.LastName,
          email: sfContact.Email || undefined,
          phone: sfContact.Phone || undefined,
          mobilePhone: sfContact.MobilePhone || undefined,
          title: sfContact.Title || undefined,
          department: sfContact.Department || undefined,
          mailingStreet: sfContact.MailingStreet || undefined,
          mailingCity: sfContact.MailingCity || undefined,
          mailingState: sfContact.MailingState || undefined,
          mailingPostalCode: sfContact.MailingPostalCode || undefined,
          mailingCountry: sfContact.MailingCountry || undefined,
          leadSource: sfContact.LeadSource || undefined,
          ownerId: sfContact.OwnerId || undefined,
          doNotCall: sfContact.DoNotCall ?? false,
          hasOptedOutOfEmail: sfContact.HasOptedOutOfEmail ?? false,
          ...(accountId ? { accountId } : {}),
        };

        // Remove undefined values
        Object.keys(data).forEach((key) => {
          if (data[key] === undefined) delete data[key];
        });

        if (contact) {
          await prisma.contact.update({ where: { contactId: contact.contactId }, data });
          result.updated++;
        } else {
          await prisma.contact.create({ data: { contactId: randomUUID(), ...data } });
          result.created++;
        }

        await this.upsertSyncRecord(userId, 'Contact', sfContact.Id, contact?.contactId || null);
        result.synced++;
      } catch (err) {
        logger.error(`[Salesforce] Failed to sync contact ${sfContact.Id}: ${String(err)}`);
        result.errors++;
      }
    }

    return result;
  }

  private async syncOpportunities(
    userId: string,
    sfOpportunities: SFOpportunity[]
  ): Promise<{ synced: number; created: number; updated: number; errors: number }> {
    const prisma = getPrismaClient();
    const result = { synced: 0, created: 0, updated: 0, errors: 0 };

    for (const sfOpp of sfOpportunities) {
      try {
        // Look up by salesforceId first
        let deal = await prisma.deal.findUnique({ where: { salesforceId: sfOpp.Id } });

        // Fallback: name+account dedup
        if (!deal && sfOpp.AccountId) {
          const account = await prisma.account.findUnique({
            where: { salesforceId: sfOpp.AccountId },
            select: { accountId: true },
          });
          if (account) {
            deal = await prisma.deal.findFirst({
              where: {
                opportunityName: { equals: sfOpp.Name, mode: 'insensitive' },
                accountId: account.accountId,
              },
            });
          }
        }

        // Resolve accountId and contactId
        let accountId: string | undefined;
        let contactId: string | undefined;
        let companyName = sfOpp.Account?.Name || sfOpp.Name;

        if (sfOpp.AccountId) {
          const account = await prisma.account.findUnique({
            where: { salesforceId: sfOpp.AccountId },
            select: { accountId: true, name: true },
          });
          if (account) {
            accountId = account.accountId;
            companyName = account.name;
          }
        }

        if (sfOpp.ContactId) {
          const contact = await prisma.contact.findUnique({
            where: { salesforceId: sfOpp.ContactId },
            select: { contactId: true },
          });
          if (contact) contactId = contact.contactId;
        }

        const data: any = {
          salesforceId: sfOpp.Id,
          opportunityName: sfOpp.Name,
          companyName,
          amount: sfOpp.Amount ?? undefined,
          estimatedValue: sfOpp.Amount ?? undefined,
          closeDate: sfOpp.CloseDate ? new Date(sfOpp.CloseDate) : undefined,
          probability: sfOpp.Probability ?? undefined,
          forecastCategory: sfOpp.ForecastCategoryName || undefined,
          isClosed: sfOpp.IsClosed,
          isWon: sfOpp.IsWon,
          leadSource: sfOpp.LeadSource || undefined,
          nextStep: sfOpp.NextStep || undefined,
          stageName: sfOpp.StageName || undefined,
          stage: this.mapSFStageToLocal(sfOpp.StageName || ''),
          type: sfOpp.Type || undefined,
          campaignId: sfOpp.CampaignId || undefined,
          fiscalQuarter: sfOpp.FiscalQuarter ?? undefined,
          fiscalYear: sfOpp.FiscalYear ?? undefined,
          description: sfOpp.Description || undefined,
          owner: sfOpp.OwnerId || undefined,
          ...(accountId ? { accountId } : {}),
          ...(contactId ? { contactId } : {}),
        };

        // Set status based on SF stage
        if (sfOpp.IsClosed) {
          data.status = sfOpp.IsWon ? 'closed_won' : 'closed_lost';
        } else {
          data.status = 'active';
        }

        // Set progress percentage based on probability
        if (sfOpp.Probability !== undefined && sfOpp.Probability !== null) {
          data.progressPercentage = Math.round(sfOpp.Probability);
        }

        // Remove undefined values
        Object.keys(data).forEach((key) => {
          if (data[key] === undefined) delete data[key];
        });

        if (deal) {
          // Only update SF-owned fields, preserve app-only fields
          const { companyName: _cn, ...updateFields } = data;
          await prisma.deal.update({ where: { dealId: deal.dealId }, data: updateFields });
          result.updated++;
        } else {
          await prisma.deal.create({
            data: { dealId: randomUUID(), ...data },
          });
          result.created++;
        }

        await this.upsertSyncRecord(userId, 'Opportunity', sfOpp.Id, deal?.dealId || null);
        result.synced++;
      } catch (err) {
        logger.error(`[Salesforce] Failed to sync opportunity ${sfOpp.Id}: ${String(err)}`);
        result.errors++;
      }
    }

    return result;
  }

  // ─── Write Methods (App → SF) ──────────────────────────────────────────

  async logActivityToOpportunity(userId: string, sfOpportunityId: string, activity: ActivityData): Promise<string> {
    const client = await this.getAuthenticatedClient(userId);

    const response = await client.post('/sobjects/Task', {
      Subject: activity.subject,
      Description: activity.body,
      WhatId: sfOpportunityId,
      Status: 'Completed',
      Priority: 'Normal',
      ActivityDate: activity.date || new Date().toISOString().split('T')[0],
      Type: activity.type || 'Other',
    });

    const taskId = response.data.id;
    await this.upsertSyncRecord(userId, 'Task', taskId, null, 'outbound');

    logger.info(`[Salesforce] Logged activity ${taskId} to opportunity ${sfOpportunityId}`);
    return taskId;
  }

  async attachNoteToOpportunity(userId: string, sfOpportunityId: string, note: NoteData): Promise<string> {
    const client = await this.getAuthenticatedClient(userId);

    // Create ContentNote
    const noteResponse = await client.post('/sobjects/ContentNote', {
      Title: note.title,
      Content: Buffer.from(note.body, 'utf-8').toString('base64'),
    });

    const contentDocumentId = noteResponse.data.id;

    // Link to Opportunity
    await client.post('/sobjects/ContentDocumentLink', {
      ContentDocumentId: contentDocumentId,
      LinkedEntityId: sfOpportunityId,
      ShareType: 'V',
      Visibility: 'AllUsers',
    });

    await this.upsertSyncRecord(userId, 'ContentNote', contentDocumentId, null, 'outbound');

    logger.info(`[Salesforce] Attached note ${contentDocumentId} to opportunity ${sfOpportunityId}`);
    return contentDocumentId;
  }

  async updateOpportunityFields(
    userId: string,
    sfOpportunityId: string,
    fields: Record<string, any>
  ): Promise<void> {
    const client = await this.getAuthenticatedClient(userId);

    await client.patch(`/sobjects/Opportunity/${sfOpportunityId}`, fields);
    await this.upsertSyncRecord(userId, 'Opportunity', sfOpportunityId, null, 'outbound');

    logger.info(`[Salesforce] Updated opportunity ${sfOpportunityId}`, { fields: Object.keys(fields) });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private mapSFStageToLocal(sfStageName: string): string {
    const stageMap: Record<string, string> = {
      'Prospecting': 'prospecting',
      'Qualification': 'qualification',
      'Needs Analysis': 'qualification',
      'Value Proposition': 'proposal_sent',
      'Proposal/Price Quote': 'proposal_sent',
      'Negotiation/Review': 'negotiation',
      'Closed Won': 'closed_won',
      'Closed Lost': 'closed_lost',
    };
    return stageMap[sfStageName] || 'prospecting';
  }

  private extractDomain(url?: string): string | undefined {
    if (!url) return undefined;
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  }

  private async upsertSyncRecord(
    userId: string,
    objectType: string,
    sfObjectId: string,
    localObjectId: string | null,
    direction: string = 'inbound'
  ): Promise<void> {
    const prisma = getPrismaClient();

    await prisma.salesforceSync.upsert({
      where: {
        userId_objectType_sfObjectId: { userId, objectType, sfObjectId },
      },
      update: {
        localObjectId,
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
        syncDirection: direction,
        errorMessage: null,
      },
      create: {
        userId,
        objectType,
        sfObjectId,
        localObjectId,
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
        syncDirection: direction,
      },
    });
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let salesforceService: SalesforceService | null = null;

export function getSalesforceService(): SalesforceService {
  if (!salesforceService) {
    salesforceService = new SalesforceService();
  }
  return salesforceService;
}
