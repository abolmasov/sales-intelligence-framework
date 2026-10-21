import { Router, Request, Response } from 'express';
import { getCaseStudyService } from '../services/caseStudy.service';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

const router = Router();
const caseStudyService = getCaseStudyService();

/**
 * GET /api/case-studies/integrator
 * Get Northstar Integrators case studies with optional filtering and pagination
 */
router.get(
  '/integrator',
  asyncHandler(async (req: Request, res: Response) => {
    const { search, tag, page, page_size } = req.query;

    if (!caseStudyService.isLoaded()) {
      throw new AppError('Case studies not loaded', 500);
    }

    const result = caseStudyService.searchIntegratorCaseStudies({
      search: search as string,
      tag: tag as string,
      page: page ? parseInt(page as string) : 1,
      pageSize: page_size ? parseInt(page_size as string) : 10,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        case_studies: result.caseStudies,
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        total_pages: result.totalPages,
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/case-studies/library
 * Get Northstar library case studies with optional filtering and pagination
 */
router.get(
  '/library',
  asyncHandler(async (req: Request, res: Response) => {
    const { search, industry, technology, page, page_size } = req.query;

    if (!caseStudyService.isLoaded()) {
      throw new AppError('Case studies not loaded', 500);
    }

    const result = caseStudyService.searchLibraryCaseStudies({
      search: search as string,
      industry: industry as string,
      technology: technology as string,
      page: page ? parseInt(page as string) : 1,
      pageSize: page_size ? parseInt(page_size as string) : 10,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        case_studies: result.caseStudies,
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        total_pages: result.totalPages,
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/case-studies/integrator/tags
 * Get list of all tags from Northstar Integrators case studies
 */
router.get(
  '/integrator/tags',
  asyncHandler(async (req: Request, res: Response) => {
    if (!caseStudyService.isLoaded()) {
      throw new AppError('Case studies not loaded', 500);
    }

    const tags = caseStudyService.getIntegratorTags();

    const response: ApiResponse = {
      success: true,
      data: { tags },
    };

    res.json(response);
  })
);

/**
 * GET /api/case-studies/library/industries
 * Get list of all industries from Northstar library case studies
 */
router.get(
  '/library/industries',
  asyncHandler(async (req: Request, res: Response) => {
    if (!caseStudyService.isLoaded()) {
      throw new AppError('Case studies not loaded', 500);
    }

    const industries = caseStudyService.getLibraryIndustries();

    const response: ApiResponse = {
      success: true,
      data: { industries },
    };

    res.json(response);
  })
);

/**
 * GET /api/case-studies/library/technologies
 * Get list of all technologies from Northstar library case studies
 */
router.get(
  '/library/technologies',
  asyncHandler(async (req: Request, res: Response) => {
    if (!caseStudyService.isLoaded()) {
      throw new AppError('Case studies not loaded', 500);
    }

    const technologies = caseStudyService.getLibraryTechnologies();

    const response: ApiResponse = {
      success: true,
      data: { technologies },
    };

    res.json(response);
  })
);

/**
 * GET /api/case-studies/stats
 * Get statistics about case studies
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    if (!caseStudyService.isLoaded()) {
      throw new AppError('Case studies not loaded', 500);
    }

    const stats = caseStudyService.getStats();

    const response: ApiResponse = {
      success: true,
      data: stats,
    };

    res.json(response);
  })
);

export default router;
