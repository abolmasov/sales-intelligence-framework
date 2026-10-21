import { ConfidentialClientApplication, AuthorizationCodeRequest } from '@azure/msal-node';
import { Client, ResponseType } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

interface SharePointSite {
  id: string;
  name: string;
  webUrl: string;
}

interface SharePointDrive {
  id: string;
  name: string;
  webUrl: string;
}

export interface SharePointFile {
  id: string;
  name: string;
  webUrl: string;
  size?: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  mimeType?: string;
  contentType: string;
  isFolder?: boolean;
  parentId?: string;
  driveId?: string;
  siteId?: string;
  path: string;
  displayName: string;
  relevanceScore?: number;
}

export class SharePointService {
  private confidentialClientApp: ConfidentialClientApplication;
  private redirectUri: string;

  constructor() {
    const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.MS_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID || process.env.MS_TENANT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    if (!clientId || !clientSecret || !tenantId || !redirectUri) {
      throw new Error('Missing required Microsoft SharePoint authentication configuration');
    }

    this.redirectUri = redirectUri;

    this.confidentialClientApp = new ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
    });
  }

  async getAuthUrl(): Promise<string> {
    return this.confidentialClientApp.getAuthCodeUrl({
      scopes: ['Files.Read.All', 'Sites.Read.All', 'User.Read'],
      redirectUri: this.redirectUri,
    });
  }

  async getTokenFromCode(code: string) {
    try {
      console.log('🔑 Attempting to get SharePoint token with code:', code ? '[PRESENT]' : '[MISSING]');

      const request: AuthorizationCodeRequest = {
        code,
        scopes: ['Files.Read.All', 'Sites.Read.All', 'User.Read'],
        redirectUri: this.redirectUri,
      };

      const response = await this.confidentialClientApp.acquireTokenByCode(request);
      console.log('📦 SharePoint token response received:', response ? 'Success' : 'Failed');

      if (!response?.account) throw new Error('No account information received');

      return {
        accessToken: response.accessToken,
        refreshToken: response.account.homeAccountId,
        expiresOn: new Date(response.expiresOn || Date.now()),
        uniqueId: response.account.homeAccountId,
        name: response.account.name || 'Microsoft User',
        email: response.account.username || '',
      };
    } catch (error) {
      console.error('❌ SharePoint token acquisition failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  private createGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => done(null, accessToken),
      defaultVersion: 'v1.0',
    });
  }

  // 🔹 Encode shared folder link to Microsoft Graph format
  private encodeSharedUrl(sharedUrl: string): string {
    const encoded = Buffer.from(sharedUrl)
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return `u!${encoded}`;
  }

  /**
   * 🔍 Recursively fetch all files & folders from a shared folder (no site/drive access needed)
   */
  async getSharedFolderContents(
    sharedFolderUrl: string,
    accessToken: string,
    folderId?: string,
    driveId?: string,
    path: string = '',
    depth: number = 0
  ): Promise<SharePointFile[]> {
    try {
      const client = this.createGraphClient(accessToken);
      const allFiles: SharePointFile[] = [];

      const indent = '  '.repeat(depth);
      console.log(`${indent}📂 [DEBUG] Fetching folder: ${path || 'ROOT'} (depth=${depth})`);

      let itemsResponse: any;

      if (!folderId) {
        // Root folder from shared link
        const encodedUrl = this.encodeSharedUrl(sharedFolderUrl);
        const root = await client.api(`/shares/${encodedUrl}/driveItem`).get();
        driveId = root.parentReference?.driveId;
        folderId = root.id;

        console.log(`${indent}🔗 [DEBUG] Root folder ID: ${folderId}, driveId: ${driveId}`);

        itemsResponse = await client
          .api(`/shares/${encodedUrl}/driveItem/children`)
          .select('id,name,webUrl,size,createdDateTime,lastModifiedDateTime,file,folder,parentReference')
          .get();
      } else {
        // Subfolder traversal
        itemsResponse = await client
          .api(`/drives/${driveId}/items/${folderId}/children`)
          .select('id,name,webUrl,size,createdDateTime,lastModifiedDateTime,file,folder,parentReference')
          .get();
      }

      const items = itemsResponse.value || [];

      console.log(`${indent}📄 [DEBUG] Found ${items.length} items in folder: ${path || 'ROOT'}`);

      for (const item of items) {
        const mappedItem: SharePointFile = {
          id: item.id,
          name: item.name,
          webUrl: item.webUrl,
          size: item.size,
          createdDateTime: item.createdDateTime,
          lastModifiedDateTime: item.lastModifiedDateTime,
          mimeType: item.file?.mimeType,
          contentType: item.file ? 'file' : 'folder',
          isFolder: !!item.folder,
          parentId: item.parentReference?.id,
          driveId: item.parentReference?.driveId || driveId,
          siteId: undefined,
          path: path ? `${path}/${item.name}` : item.name,
          displayName: item.name,
        };

        allFiles.push(mappedItem);

        if (mappedItem.isFolder) {
          console.log(`${indent}📁 Folder: ${mappedItem.path}`);
        } else {
          console.log(`${indent}📄 File: ${mappedItem.path} (${mappedItem.mimeType || 'unknown type'})`);
        }

        // Recursive call for subfolders
        if (item.folder && depth < 10) {
          const subFolderFiles = await this.getSharedFolderContents(
            sharedFolderUrl,
            accessToken,
            item.id,
            mappedItem.driveId,
            `${path}/${item.name}`,
            depth + 1
          );
          allFiles.push(...subFolderFiles);
        }
      }

      const uniqueFiles = Array.from(new Map(allFiles.map((f) => [f.id, f])).values());
      console.log(`${indent}✅ [DEBUG] Returning ${uniqueFiles.length} unique items from ${path || 'ROOT'}`);

      return uniqueFiles;
    } catch (error) {
      console.error('❌ [ERROR] getSharedFolderContents failed:', error);
      throw error;
    }
  }

  /**
   * 📥 Download file from its shared link
   */
  async downloadFile(fileUrl: string, accessToken: string): Promise<ArrayBuffer> {
    try {
      const client = this.createGraphClient(accessToken);
      const encodedUrl = this.encodeSharedUrl(fileUrl);
      const driveItem = await client.api(`/shares/${encodedUrl}/driveItem`).get();
      const driveId = driveItem.parentReference?.driveId;

      const response = await client
        .api(`/drives/${driveId}/items/${driveItem.id}/content`)
        .responseType(ResponseType.ARRAYBUFFER)
        .get();

      return response as ArrayBuffer;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  /**
   * 📥 Download file by driveId and fileId (more efficient than URL-based download)
   */
  async downloadFileById(fileId: string, accessToken: string, driveId?: string): Promise<ArrayBuffer> {
    try {
      const client = this.createGraphClient(accessToken);

      // If driveId is not provided, we need to get it from the file item first
      if (!driveId) {
        const encodedUrl = this.encodeSharedUrl(this.redirectUri); // Use the shared folder URL
        const root = await client.api(`/shares/${encodedUrl}/driveItem`).get();
        driveId = root.parentReference?.driveId;
      }

      const response = await client
        .api(`/drives/${driveId}/items/${fileId}/content`)
        .responseType(ResponseType.ARRAYBUFFER)
        .get();

      return response as ArrayBuffer;
    } catch (error) {
      console.error(`Error downloading file by ID (${fileId}):`, error);
      throw error;
    }
  }

  /**
   * 🔍 Search SharePoint for company-related RFPs, SOWs, and proposals
   * Used during company research to find relevant past documents
   */
  async searchCompanyDocuments(
    companyName: string,
    accessToken: string,
    sharedFolderUrl?: string
  ): Promise<SharePointFile[]> {
    try {
      console.log(`\n🔍 Searching SharePoint for "${companyName}" related documents...`);

      // Use provided shared folder URL or fall back to env variable
      const folderUrl = sharedFolderUrl || process.env.SHAREPOINT_FOLDER_URL;

      if (!folderUrl) {
        console.warn('⚠️ No SharePoint folder URL configured, skipping SharePoint search');
        return [];
      }

      // Get all files from shared folder
      console.log('📂 Fetching all files from SharePoint folder...');
      const allFiles = await this.getSharedFolderContents(folderUrl, accessToken);

      console.log(`📄 Total files found: ${allFiles.length}`);

      // Filter for documents only (not folders)
      const documents = allFiles.filter(f => !f.isFolder);

      console.log(`📄 Total documents (excluding folders): ${documents.length}`);

      // Search for company name in filename or path
      const companyNameLower = companyName.toLowerCase();
      const companyKeywords = companyNameLower.split(' ');

      // Filter for relevant document types
      const relevantDocs = documents.filter(doc => {
        const fileName = doc.name.toLowerCase();
        const filePath = doc.path.toLowerCase();

        // Check if document is RFP, SOW, or Proposal
        const isRelevantType =
          fileName.includes('rfp') ||
          fileName.includes('sow') ||
          fileName.includes('statement of work') ||
          fileName.includes('proposal') ||
          fileName.includes('contract') ||
          filePath.includes('rfp') ||
          filePath.includes('sow') ||
          filePath.includes('proposal');

        if (!isRelevantType) return false;

        // Check if company name or keywords appear in filename or path
        const hasCompanyMatch = companyKeywords.some(keyword =>
          keyword.length > 2 && (fileName.includes(keyword) || filePath.includes(keyword))
        );

        return hasCompanyMatch;
      });

      // Calculate relevance score for each document
      const scoredDocs = relevantDocs.map(doc => {
        let score = 0;
        const fileName = doc.name.toLowerCase();
        const filePath = doc.path.toLowerCase();

        // Exact company name match
        if (fileName.includes(companyNameLower) || filePath.includes(companyNameLower)) {
          score += 1.0;
        }

        // Partial matches
        companyKeywords.forEach(keyword => {
          if (keyword.length > 2) {
            if (fileName.includes(keyword)) score += 0.3;
            if (filePath.includes(keyword)) score += 0.2;
          }
        });

        // Boost for specific document types
        if (fileName.includes('rfp')) score += 0.5;
        if (fileName.includes('sow')) score += 0.5;
        if (fileName.includes('proposal')) score += 0.4;
        if (fileName.includes('contract')) score += 0.3;

        // Boost for PDF and DOCX files
        if (fileName.endsWith('.pdf')) score += 0.2;
        if (fileName.endsWith('.docx')) score += 0.2;

        return {
          ...doc,
          relevanceScore: Math.min(score, 3.0) // Cap at 3.0
        };
      });

      // Sort by relevance score
      scoredDocs.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      console.log(`\n✅ Found ${scoredDocs.length} company-related documents:`);
      scoredDocs.slice(0, 10).forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.name} (score: ${(doc.relevanceScore || 0).toFixed(2)})`);
      });

      // Return top 10 most relevant
      return scoredDocs.slice(0, 10);

    } catch (error) {
      console.error('❌ Error searching SharePoint for company documents:', error);
      // Don't throw - just return empty array so research can continue
      return [];
    }
  }
}

// Export singleton instance
let sharepointService: SharePointService | null = null;
let initializationAttempted = false;

export function getSharePointService(): SharePointService | null {
  if (!initializationAttempted) {
    initializationAttempted = true;
    try {
      sharepointService = new SharePointService();
    } catch (error) {
      console.log('📂 SharePoint service not configured (optional) - will skip SharePoint features');
      sharepointService = null;
    }
  }
  return sharepointService;
}