import { Router, Request, Response } from 'express';
import { TemplateManagerService } from '../services/templateManager.service';

const router = Router();

// Initialize service (singleton for this module)
const templateService = new TemplateManagerService(process.env.TEMPLATE_REGISTRY_PATH);

/**
 * GET /api/template
 * Get all available templates
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const templates = templateService.getAllTemplatesInfo();

    return res.json({
      success: true,
      default_template: templateService.getDefaultTemplate(),
      templates
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/template/:name
 * Get all versions of a specific template
 */
router.get('/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const versions = templateService.listVersions(name);
    const versionDetails = versions.map(v => ({
      version: v,
      ...templateService.getTemplateInfo(name, v)
    }));

    return res.json({
      success: true,
      template: name,
      latest_version: templateService.getLatestVersion(name),
      versions: versionDetails
    });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/template/:name/:version
 * Get specific template version details
 */
router.get('/:name/:version', (req: Request, res: Response) => {
  try {
    const { name, version } = req.params;
    const info = templateService.getTemplateInfo(name, version);
    const isValid = templateService.validateTemplate(name, version);

    return res.json({
      success: true,
      template: name,
      version,
      ...info,
      is_valid: isValid
    });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/template/validate
 * Validate a specific template version
 */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { template, version } = req.body;

    if (!template || !version) {
      return res.status(400).json({
        success: false,
        error: 'Template name and version are required'
      });
    }

    const isValid = templateService.validateTemplate(template, version);
    const templatePath = templateService.getTemplatePath(template, version);

    return res.json({
      success: true,
      template,
      version,
      is_valid: isValid,
      path: templatePath
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
