import { Router, Request, Response } from 'express';
import { getSharePointService } from '../services/sharepoint.service';

const router = Router();
const sharepointService = getSharePointService();

const resolveAccessToken = (req: Request): string | null => {
  if (req.user?.accessToken) {
    return req.user.accessToken;
  }

  const authorization = req.headers.authorization;
  if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.substring(7).trim();
  }

  return null;
};

/**
 * POST /api/sharepoint/files/list
 * List all files from a shared SharePoint folder
 */
router.post('/files/list', async (req: Request, res: Response) => {
  try {
    if (!sharepointService) {
      return res.status(503).json({
        error: 'SharePoint integration is not configured on this server',
      });
    }

    const { sharedFolderUrl } = req.body;
    if (!sharedFolderUrl) {
      return res.status(400).json({
        error: 'sharedFolderUrl is required',
      });
    }

    const accessToken = resolveAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({
        error: 'Missing authenticated Microsoft session',
      });
    }

    console.log('📂 Fetching SharePoint files from:', sharedFolderUrl);

    const files = await sharepointService.getSharedFolderContents(sharedFolderUrl, accessToken);

    console.log(`✅ Found ${files.length} files/folders`);

    return res.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (error) {
    console.error('❌ Error listing SharePoint files:', error);
    return res.status(500).json({
      error: 'Failed to list SharePoint files',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sharepoint/files/download
 * Download a file from SharePoint
 */
router.post('/files/download', async (req: Request, res: Response) => {
  try {
    if (!sharepointService) {
      return res.status(503).json({
        error: 'SharePoint integration is not configured on this server',
      });
    }

    const { fileUrl } = req.body;
    if (!fileUrl) {
      return res.status(400).json({
        error: 'fileUrl is required',
      });
    }

    const accessToken = resolveAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({
        error: 'Missing authenticated Microsoft session',
      });
    }

    console.log('📥 Downloading file from:', fileUrl);

    const fileContent = await sharepointService.downloadFile(fileUrl, accessToken);

    console.log('✅ File downloaded successfully');

    // Return as base64 encoded string
    const base64Content = Buffer.from(fileContent).toString('base64');

    return res.json({
      success: true,
      content: base64Content,
      size: fileContent.byteLength,
    });
  } catch (error) {
    console.error('❌ Error downloading SharePoint file:', error);
    return res.status(500).json({
      error: 'Failed to download SharePoint file',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sharepoint/status
 * Check SharePoint service status
 */
router.get('/status', (_req: Request, res: Response) => {
  return res.json({
    service: 'SharePoint Integration',
    status: 'active',
    features: ['Shared Folder Access', 'File Download', 'Recursive Folder Traversal'],
  });
});

export default router;
