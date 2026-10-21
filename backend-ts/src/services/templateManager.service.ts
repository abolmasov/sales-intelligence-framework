import * as fs from 'fs';
import * as path from 'path';

interface TemplateVersion {
  file: string;
  created: string;
  deprecated: boolean;
  changes: string;
}

interface TemplateConfig {
  versions: Record<string, TemplateVersion>;
  latest: string;
  default: string;
}

interface TemplatesRegistry {
  templates: Record<string, TemplateConfig>;
  default_template: string;
}

/**
 * TemplateManagerService - Complete template management logic
 * Self-contained service with no external dependencies
 */
export class TemplateManagerService {
  private registry!: TemplatesRegistry;
  private registryPath: string;
  private basePath: string;

  constructor(registryPath?: string) {
    this.registryPath = registryPath || path.join(process.cwd(), 'templates.json');
    this.basePath = process.cwd();
    this.loadRegistry();
  }

  private loadRegistry(): void {
    if (!fs.existsSync(this.registryPath)) {
      throw new Error(`Template registry not found at ${this.registryPath}`);
    }

    const content = fs.readFileSync(this.registryPath, 'utf-8');
    this.registry = JSON.parse(content);

    if (!this.registry.templates || !this.registry.default_template) {
      throw new Error('Invalid template registry format');
    }

    console.log(`📋 Template registry loaded from ${this.registryPath}`);
  }

  /**
   * Get template path by name and version
   * @param templateName - e.g., "enterprise", "acme-corp", or undefined for default
   * @param version - e.g., "1.0.0", "latest", or undefined for default
   */
  getTemplatePath(templateName?: string, version?: string): string {
    const name = templateName || this.registry.default_template;

    const templateConfig = this.registry.templates[name];
    if (!templateConfig) {
      throw new Error(`Template "${name}" not found in registry`);
    }

    let targetVersion = version || templateConfig.default;

    if (targetVersion === 'latest') {
      targetVersion = templateConfig.latest;
    }

    const versionInfo = templateConfig.versions[targetVersion];
    if (!versionInfo) {
      throw new Error(`Template "${name}" version "${targetVersion}" not found`);
    }

    if (versionInfo.deprecated) {
      console.warn(`⚠️  Warning: Template "${name}" v${targetVersion} is deprecated`);
    }

    const templatePath = path.join(this.basePath, versionInfo.file);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    return templatePath;
  }

  /**
   * Get all available templates
   */
  listTemplates(): string[] {
    return Object.keys(this.registry.templates);
  }

  /**
   * Get all versions for a template
   */
  listVersions(templateName: string): string[] {
    const templateConfig = this.registry.templates[templateName];
    if (!templateConfig) {
      throw new Error(`Template "${templateName}" not found`);
    }
    return Object.keys(templateConfig.versions);
  }

  /**
   * Get template metadata
   */
  getTemplateInfo(templateName: string, version: string): TemplateVersion {
    const templateConfig = this.registry.templates[templateName];
    if (!templateConfig) {
      throw new Error(`Template "${templateName}" not found`);
    }

    const versionInfo = templateConfig.versions[version];
    if (!versionInfo) {
      throw new Error(`Version "${version}" not found for template "${templateName}"`);
    }

    return versionInfo;
  }

  /**
   * Get latest version number for a template
   */
  getLatestVersion(templateName: string): string {
    const templateConfig = this.registry.templates[templateName];
    if (!templateConfig) {
      throw new Error(`Template "${templateName}" not found`);
    }
    return templateConfig.latest;
  }

  /**
   * Validate template file integrity
   */
  validateTemplate(templateName: string, version: string): boolean {
    try {
      const templatePath = this.getTemplatePath(templateName, version);
      const stats = fs.statSync(templatePath);

      if (stats.size < 10000) {
        console.error(`❌ Template file too small: ${stats.size} bytes`);
        return false;
      }

      if (!templatePath.endsWith('.pptx')) {
        console.error(`❌ Invalid template file extension`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Template validation failed:`, error);
      return false;
    }
  }

  /**
   * Get default template name
   */
  getDefaultTemplate(): string {
    return this.registry.default_template;
  }

  /**
   * Get all templates with their details
   */
  getAllTemplatesInfo(): Array<{
    name: string;
    versions: string[];
    latest: string;
    default: string;
  }> {
    return this.listTemplates().map(name => ({
      name,
      versions: this.listVersions(name),
      latest: this.getLatestVersion(name),
      default: this.registry.templates[name].default
    }));
  }
}

export default TemplateManagerService;
export { TemplateVersion, TemplateConfig, TemplatesRegistry };
