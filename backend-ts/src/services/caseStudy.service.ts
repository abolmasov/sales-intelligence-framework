import * as fs from 'fs';
import * as path from 'path';

/**
 * Case Study Service — loads synthetic portfolio case studies from JSON.
 */
export class CaseStudyService {
  private integratorCases: any[] = [];
  private internalLibraryCases: any[] = [];
  private loaded = false;

  constructor() {
    this.loadCaseStudies();
  }

  private loadCaseStudies(): void {
    try {
      const samplePath = path.join(__dirname, '../../data/sample-case-studies.json');
      if (fs.existsSync(samplePath)) {
        const raw = fs.readFileSync(samplePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.integratorCases = parsed;
        this.internalLibraryCases = parsed;
        console.log(`Loaded ${parsed.length} synthetic case studies for demo`);
      } else {
        console.warn('Sample case studies file not found');
      }
      this.loaded = true;
    } catch (error) {
      console.error('Error loading case studies:', error);
      this.loaded = false;
    }
  }

  searchIntegratorCaseStudies(params: {
    search?: string;
    tag?: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.searchCollection(this.integratorCases, params);
  }

  searchLibraryCaseStudies(params: {
    search?: string;
    industry?: string;
    technology?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { industry, technology, ...rest } = params;
    let filtered = [...this.internalLibraryCases];
    if (industry) {
      const q = industry.toLowerCase();
      filtered = filtered.filter((cs) => (cs.industry || '').toLowerCase().includes(q));
    }
    if (technology) {
      const q = technology.toLowerCase();
      filtered = filtered.filter((cs) =>
        (cs.tags || []).some((t: string) => (t || '').toLowerCase().includes(q))
      );
    }
    return this.searchCollection(filtered, rest);
  }

  private searchCollection(
    source: any[],
    params: { search?: string; tag?: string; page?: number; pageSize?: number }
  ) {
    const { search, tag, page = 1, pageSize = 10 } = params;
    let filtered = [...source];

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((cs) => {
        const title = (cs.title || '').toLowerCase();
        const description = (cs.description || '').toLowerCase();
        const industry = (cs.industry || '').toLowerCase();
        return (
          title.includes(searchLower) ||
          description.includes(searchLower) ||
          industry.includes(searchLower)
        );
      });
    }

    if (tag) {
      const tagLower = tag.toLowerCase();
      filtered = filtered.filter((cs) => {
        const tags = cs.tags || [];
        return tags.some((t: string) => (t || '').toLowerCase().includes(tagLower));
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIdx = (page - 1) * pageSize;
    const pageResults = filtered.slice(startIdx, startIdx + pageSize);

    return {
      caseStudies: pageResults,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  getIntegratorTags(): string[] {
    const tags = new Set<string>();
    this.integratorCases.forEach((cs) => (cs.tags || []).forEach((t: string) => tags.add(t)));
    return Array.from(tags).sort();
  }

  getLibraryIndustries(): string[] {
    const industries = new Set<string>();
    this.internalLibraryCases.forEach((cs) => {
      if (cs.industry) industries.add(cs.industry);
    });
    return Array.from(industries).sort();
  }

  getLibraryTechnologies(): string[] {
    return this.getIntegratorTags();
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getStats() {
    return {
      integrator_count: this.integratorCases.length,
      library_count: this.internalLibraryCases.length,
      total: this.integratorCases.length + this.internalLibraryCases.length,
    };
  }
}

let caseStudyServiceInstance: CaseStudyService | null = null;

export function getCaseStudyService(): CaseStudyService {
  if (!caseStudyServiceInstance) {
    caseStudyServiceInstance = new CaseStudyService();
  }
  return caseStudyServiceInstance;
}

export default CaseStudyService;
