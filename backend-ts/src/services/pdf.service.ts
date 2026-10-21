import pdfParse from '@cedrugs/pdf-parse';

import mammoth from 'mammoth';

export class PDFService {
  /**
   * Extract text from PDF using @cedrugs/pdf-parse
   */
  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text ?? '';
    } catch (error) {
      console.warn('Primary PDF parsing failed:', error);
      throw new Error(
        `Failed to parse PDF. The file may be corrupted or unsupported. Details: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Extract text from DOCX
   */

  /**
   * Extract text content from a DOCX buffer
   */
  async extractTextFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const { value: text } = await mammoth.extractRawText({ buffer });
      if (text?.trim().length > 0) return text;
      throw new Error('Empty text returned from DOCX');
    } catch (error) {
      console.warn('Primary DOCX parsing failed, trying with fallback options:', error);
      throw new Error(
        `Failed to parse DOCX document. It may be corrupted or unsupported. Details: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Extract and clean RFP requirements from PDF/DOCX text
   */
  extractRFPRequirements(text: string): string {
    let cleanText = text.replace(/\s+/g, ' ').trim();
    cleanText = cleanText.replace(/\f/g, ' ').replace(/[\x00-\x1F\x7F]/g, ' ');
    const requirementSections = [
      'requirements',
      'scope of work',
      'project description',
      'deliverables',
      'specifications',
      'objectives',
      'goals',
      'expectations',
    ];
    const sections: string[] = [];
    const lowerText = cleanText.toLowerCase();

    requirementSections.forEach((section) => {
      const sectionIndex = lowerText.indexOf(section);
      if (sectionIndex !== -1) {
        const sectionText = cleanText.substring(sectionIndex, sectionIndex + 2000);
        sections.push(sectionText);
      }
    });

    const extractedText = sections.length > 0 ? sections.join('\n\n') : cleanText;
    return extractedText.length > 10000 ? extractedText.substring(0, 10000) + '...' : extractedText;
  }

  /**
   * Validate that the uploaded file is a PDF
   */
  validatePDFFile(file: Express.Multer.File): boolean {
    if (file.mimetype !== 'application/pdf') return false;
    const fileName = file.originalname.toLowerCase();
    if (!fileName.endsWith('.pdf')) return false;
    const buffer = file.buffer;
    if (buffer.length < 5) return false;
    const header = buffer.subarray(0, 5).toString('ascii');
    if (!header.startsWith('%PDF-')) {
      console.warn('File does not have valid PDF header:', header);
      return false;
    }
    return true;
  }

  /**
   * Validate DOCX file
   */
  validateDOCXFile(file: Express.Multer.File): boolean {
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (!validMimeTypes.includes(file.mimetype)) return false;
    const fileName = file.originalname.toLowerCase();
    if (!fileName.endsWith('.docx') && !fileName.endsWith('.doc')) return false;
    return true;
  }

  /**
   * Basic PDF health check
   */
  async checkPDFHealth(buffer: Buffer): Promise<{ isHealthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    try {
      if (!buffer || buffer.length === 0) {
        issues.push('Empty or null buffer');
        return { isHealthy: false, issues };
      }
      if (buffer.length < 100) {
        issues.push('File too small to be a valid PDF');
        return { isHealthy: false, issues };
      }
      const header = buffer.subarray(0, 8).toString('ascii');
      if (!header.startsWith('%PDF-')) {
        issues.push('Invalid PDF header');
        return { isHealthy: false, issues };
      }
      const trailer = buffer.subarray(-50).toString('ascii');
      if (!trailer.includes('%%EOF')) issues.push('Missing or corrupted PDF trailer');
      const content = buffer.toString('ascii');
      if (!content.includes('obj') && !content.includes('endobj'))
        issues.push('Missing PDF object structure');
      return { isHealthy: issues.length === 0, issues };
    } catch (error) {
      issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isHealthy: false, issues };
    }
  }

  /**
   * Process SharePoint file: download and extract text
   */
  async processSharePointFile(
    fileBuffer: ArrayBuffer,
    fileName: string
  ): Promise<{ text: string; metadata: any }> {
    const buffer = Buffer.from(fileBuffer);
    const lowerFileName = fileName.toLowerCase();

    let text = '';
    let fileType = '';

    if (lowerFileName.endsWith('.pdf')) {
      console.log('📄 Processing PDF file:', fileName);
      text = await this.extractTextFromPDF(buffer);
      fileType = 'pdf';
    } else if (lowerFileName.endsWith('.docx')) {
      console.log('📝 Processing DOCX file:', fileName);
      text = await this.extractTextFromDOCX(buffer);
      fileType = 'docx';
    } else {
      throw new Error(`Unsupported file type: ${fileName}`);
    }

    return {
      text,
      metadata: {
        fileName,
        fileType,
        textLength: text.length,
        wordCount: text.split(/\s+/).length,
      },
    };
  }
}

// Export singleton instance
let pdfServiceInstance: PDFService | null = null;

export function getPDFService(): PDFService {
  if (!pdfServiceInstance) {
    pdfServiceInstance = new PDFService();
  }
  return pdfServiceInstance;
}

export const pdfService = new PDFService();