import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { getEncryptionService } from '../utils/encryption';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';

const router = Router();
const prisma = getPrismaClient();
const encryption = getEncryptionService();

/**
 * Get or create default user for single-user setup
 */
async function getOrCreateDefaultUser() {
  return prisma.user.upsert({
    where: { username: 'default_user' },
    update: {},
    create: {
      userId: randomUUID(),
      username: 'default_user',
      email: 'user@example.com',
      fullName: 'Default User',
      isActive: true,
    },
  });
}

/**
 * POST /api/user/api-keys
 * Save or update user's API keys (encrypted)
 */
router.post(
  '/api-keys',
  asyncHandler(async (req: Request, res: Response) => {
    const { openaiApiKey, azureClientId, azureClientSecret, azureTenantId } = req.body;

    // Get or create default user
    const user = await getOrCreateDefaultUser();

    // Check if user has existing API keys
    let userKeys = await prisma.userAPIKeys.findUnique({
      where: { userId: user.userId },
    });

    if (!userKeys) {
      // Create new API keys record
      userKeys = await prisma.userAPIKeys.create({
        data: {
          userId: user.userId,
        },
      });
    }

    // Update API keys (only if provided)
    const updateData: any = {};

    if (openaiApiKey) {
      updateData.openaiApiKeyEncrypted = encryption.encrypt(openaiApiKey);
      updateData.hasOpenaiKey = true;
    }

    if (azureClientId && azureClientSecret && azureTenantId) {
      updateData.azureClientIdEncrypted = encryption.encrypt(azureClientId);
      updateData.azureClientSecretEncrypted = encryption.encrypt(azureClientSecret);
      updateData.azureTenantIdEncrypted = encryption.encrypt(azureTenantId);
      updateData.hasAzureCredentials = true;
    }

    // Update the record
    userKeys = await prisma.userAPIKeys.update({
      where: { userId: user.userId },
      data: updateData,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        userId: userKeys.userId,
        hasOpenaiKey: userKeys.hasOpenaiKey,
        hasAzureCredentials: userKeys.hasAzureCredentials,
        createdAt: userKeys.createdAt,
        updatedAt: userKeys.updatedAt,
      },
      message: 'API keys saved successfully',
    };

    res.json(response);
  })
);

/**
 * Helper function to mask an API key for display
 */
function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return '***' + key.slice(-3);
  return key.slice(0, 7) + '...' + key.slice(-4);
}

/**
 * GET /api/user/api-keys/status
 * Get the status of user's API keys (without revealing the actual keys)
 */
router.get(
  '/api-keys/status',
  asyncHandler(async (req: Request, res: Response) => {
    // Get or create default user
    const user = await getOrCreateDefaultUser();

    // Get user's API keys
    const userKeys = await prisma.userAPIKeys.findUnique({
      where: { userId: user.userId },
    });

    if (!userKeys) {
      const response: ApiResponse = {
        success: true,
        data: {
          userId: user.userId,
          hasOpenaiKey: false,
          hasAzureCredentials: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          openaiKeyMasked: null,
          azureClientIdMasked: null,
        },
      };
      res.json(response);
      return;
    }

    // Decrypt and mask keys for display
    let openaiKeyMasked = null;
    let azureClientIdMasked = null;

    if (userKeys.hasOpenaiKey && userKeys.openaiApiKeyEncrypted) {
      const decrypted = encryption.decrypt(Buffer.from(userKeys.openaiApiKeyEncrypted));
      openaiKeyMasked = maskApiKey(decrypted);
    }

    if (userKeys.hasAzureCredentials && userKeys.azureClientIdEncrypted) {
      const decrypted = encryption.decrypt(Buffer.from(userKeys.azureClientIdEncrypted));
      azureClientIdMasked = maskApiKey(decrypted);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        userId: userKeys.userId,
        hasOpenaiKey: userKeys.hasOpenaiKey,
        hasAzureCredentials: userKeys.hasAzureCredentials,
        createdAt: userKeys.createdAt,
        updatedAt: userKeys.updatedAt,
        openaiKeyMasked,
        azureClientIdMasked,
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/user/api-keys/retrieve
 * Retrieve decrypted API keys for the user
 * ⚠️ WARNING: This endpoint returns decrypted API keys.
 * In production, ensure proper authentication and authorization.
 */
router.get(
  '/api-keys/retrieve',
  asyncHandler(async (req: Request, res: Response) => {
    // Get or create default user
    const user = await getOrCreateDefaultUser();

    // Get user's API keys
    const userKeys = await prisma.userAPIKeys.findUnique({
      where: { userId: user.userId },
    });

    if (!userKeys) {
      const response: ApiResponse = {
        success: true,
        data: {
          userId: user.userId,
          openaiApiKey: null,
          azureCredentials: null,
        },
      };
      res.json(response);
      return;
    }

    // Decrypt keys
    let azureCredentials = null;
    if (userKeys.hasAzureCredentials) {
      azureCredentials = {
        clientId: userKeys.azureClientIdEncrypted ? encryption.decrypt(Buffer.from(userKeys.azureClientIdEncrypted)) : null,
        clientSecret: userKeys.azureClientSecretEncrypted
          ? encryption.decrypt(Buffer.from(userKeys.azureClientSecretEncrypted))
          : null,
        tenantId: userKeys.azureTenantIdEncrypted ? encryption.decrypt(Buffer.from(userKeys.azureTenantIdEncrypted)) : null,
      };
    }

    const response: ApiResponse = {
      success: true,
      data: {
        userId: userKeys.userId,
        openaiApiKey: userKeys.hasOpenaiKey && userKeys.openaiApiKeyEncrypted
          ? encryption.decrypt(Buffer.from(userKeys.openaiApiKeyEncrypted))
          : null,
        azureCredentials,
      },
    };

    res.json(response);
  })
);

/**
 * DELETE /api/user/api-keys
 * Delete user's API keys
 */
router.delete(
  '/api-keys',
  asyncHandler(async (req: Request, res: Response) => {
    // Get or create default user
    const user = await getOrCreateDefaultUser();

    // Delete user's API keys
    const userKeys = await prisma.userAPIKeys.findUnique({
      where: { userId: user.userId },
    });

    if (userKeys) {
      await prisma.userAPIKeys.delete({
        where: { userId: user.userId },
      });

      const response: ApiResponse = {
        success: true,
        message: 'API keys deleted successfully',
        data: { userId: user.userId },
      };
      res.json(response);
      return;
    } else {
      const response: ApiResponse = {
        success: true,
        message: 'No API keys found to delete',
        data: { userId: user.userId },
      };
      res.json(response);
    }
  })
);

/**
 * GET /api/user/profile
 * Get current user's profile information
 */
router.get(
  '/profile',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getOrCreateDefaultUser();

    const response: ApiResponse = {
      success: true,
      data: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    };

    res.json(response);
  })
);

/**
 * POST /api/user/api-keys/test
 * Test API keys to verify they're working correctly
 */
router.post(
  '/api-keys/test',
  asyncHandler(async (req: Request, res: Response) => {
    const { openaiApiKey } = req.body;

    const results: any = {
      openai: { tested: false, valid: false, error: null },
    };

    // Test OpenAI API Key
    if (openaiApiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiApiKey });
        await openai.models.list();
        results.openai = { tested: true, valid: true, error: null };
      } catch (error: any) {
        results.openai = {
          tested: true,
          valid: false,
          error: error.message || 'Invalid OpenAI API key',
        };
      }
    }

    const response: ApiResponse = {
      success: true,
      data: results,
      message: 'API keys tested',
    };

    res.json(response);
  })
);

/**
 * POST /api/user/api-keys/test-saved
 * Test the currently saved API keys
 */
router.post(
  '/api-keys/test-saved',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getOrCreateDefaultUser();
    const apiKeys = await getUserApiKeys(user.userId);

    const results: any = {
      openai: { tested: false, valid: false, error: null },
    };

    // Test OpenAI API Key
    if (apiKeys.openaiApiKey) {
      try {
        const openai = new OpenAI({ apiKey: apiKeys.openaiApiKey });
        await openai.models.list();
        results.openai = { tested: true, valid: true, error: null };
      } catch (error: any) {
        results.openai = {
          tested: true,
          valid: false,
          error: error.message || 'Invalid OpenAI API key',
        };
      }
    }

    const response: ApiResponse = {
      success: true,
      data: results,
      message: 'Saved API keys tested',
    };

    res.json(response);
  })
);

/**
 * Helper function to get user's API keys (for use in other services)
 */
export async function getUserApiKeys(userId: string): Promise<{
  openaiApiKey: string | null;
  azureCredentials: any | null;
}> {
  const userKeys = await prisma.userAPIKeys.findUnique({
    where: { userId },
  });

  if (!userKeys) {
    return {
      openaiApiKey: null,
      azureCredentials: null,
    };
  }

  let azureCredentials = null;
  if (userKeys.hasAzureCredentials) {
    azureCredentials = {
      clientId: userKeys.azureClientIdEncrypted ? encryption.decrypt(Buffer.from(userKeys.azureClientIdEncrypted)) : null,
      clientSecret: userKeys.azureClientSecretEncrypted
        ? encryption.decrypt(Buffer.from(userKeys.azureClientSecretEncrypted))
        : null,
      tenantId: userKeys.azureTenantIdEncrypted ? encryption.decrypt(Buffer.from(userKeys.azureTenantIdEncrypted)) : null,
    };
  }

  return {
    openaiApiKey: userKeys.hasOpenaiKey && userKeys.openaiApiKeyEncrypted
      ? encryption.decrypt(Buffer.from(userKeys.openaiApiKeyEncrypted))
      : null,
    azureCredentials,
  };
}

export default router;
