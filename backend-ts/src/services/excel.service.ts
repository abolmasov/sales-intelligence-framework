import * as XLSX from 'xlsx';

/**
 * Represents a detected column mapping for RFP Excel files
 */
export interface ExcelColumnMapping {
  questionColumn: number | null;
  answerColumn: number | null;
  categoryColumn: number | null;
  sectionColumn: number | null;
  headers: string[];
  sheetName: string;
}

/**
 * Represents a single RFP question extracted from Excel
 */
export interface ExcelRFPQuestion {
  rowIndex: number;
  questionText: string;
  existingAnswer?: string;
  category?: string;
  section?: string;
  originalRow: any[];
}

/**
 * Represents the parsed Excel RFP structure
 */
export interface ParsedExcelRFP {
  questions: ExcelRFPQuestion[];
  columnMapping: ExcelColumnMapping;
  totalRows: number;
  metadata: {
    fileName?: string;
    sheetCount: number;
    processedSheet: string;
  };
}

/**
 * Common header patterns for detecting question columns
 */
const QUESTION_COLUMN_PATTERNS = [
  /^question$/i,
  /^requirement$/i,
  /^requirements?$/i,
  /^description$/i,
  /^rfp\s*question/i,
  /^vendor\s*question/i,
  /^query$/i,
  /^ask$/i,
  /^item$/i,
  /^criteria$/i,
  /^specification$/i,
  /^scope$/i,
  /^detail$/i,
  /^request$/i,
];

/**
 * Common header patterns for detecting answer columns
 */
const ANSWER_COLUMN_PATTERNS = [
  /^answer$/i,
  /^response$/i,
  /^vendor\s*response/i,
  /^supplier\s*response/i,
  /^your\s*response/i,
  /^reply$/i,
  /^comments?$/i,
  /^notes?$/i,
  /^vendor\s*answer/i,
  /^proposed\s*solution/i,
  /^solution$/i,
];

/**
 * Common header patterns for detecting category columns
 */
const CATEGORY_COLUMN_PATTERNS = [
  /^category$/i,
  /^type$/i,
  /^classification$/i,
  /^area$/i,
  /^domain$/i,
  /^topic$/i,
];

/**
 * Common header patterns for detecting section columns
 */
const SECTION_COLUMN_PATTERNS = [
  /^section$/i,
  /^module$/i,
  /^part$/i,
  /^chapter$/i,
  /^group$/i,
  /^phase$/i,
];

/**
 * Excel Service for parsing and generating Excel RFP files
 */
class ExcelService {
  /**
   * Parse an Excel file buffer and extract RFP questions
   */
  parseExcelRFP(buffer: Buffer, fileName?: string): ParsedExcelRFP {
    console.log(`📊 Parsing Excel RFP file${fileName ? `: ${fileName}` : ''}...`);

    // Read the workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      throw new Error('Excel file contains no sheets');
    }

    console.log(`   Found ${sheetNames.length} sheet(s): ${sheetNames.join(', ')}`);

    // Process the first sheet (or find the best sheet with RFP content)
    const targetSheet = this.findBestSheet(workbook);
    const worksheet = workbook.Sheets[targetSheet];

    console.log(`   Processing sheet: "${targetSheet}"`);

    // Convert to array of arrays
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (data.length === 0) {
      throw new Error('Excel sheet is empty');
    }

    // Detect column mapping
    const columnMapping = this.detectColumnMapping(data, targetSheet);
    console.log(`   Column mapping detected:`, {
      question: columnMapping.questionColumn !== null ? columnMapping.headers[columnMapping.questionColumn] : 'NOT FOUND',
      answer: columnMapping.answerColumn !== null ? columnMapping.headers[columnMapping.answerColumn] : 'NOT FOUND',
      category: columnMapping.categoryColumn !== null ? columnMapping.headers[columnMapping.categoryColumn] : 'N/A',
      section: columnMapping.sectionColumn !== null ? columnMapping.headers[columnMapping.sectionColumn] : 'N/A',
    });

    // Extract questions
    const questions = this.extractQuestions(data, columnMapping);
    console.log(`   Extracted ${questions.length} questions from ${data.length} rows`);

    return {
      questions,
      columnMapping,
      totalRows: data.length,
      metadata: {
        fileName,
        sheetCount: sheetNames.length,
        processedSheet: targetSheet,
      },
    };
  }

  /**
   * Find the best sheet to process (prioritize sheets with RFP-like content)
   */
  private findBestSheet(workbook: XLSX.WorkBook): string {
    const sheetNames = workbook.SheetNames;

    // Priority patterns for sheet names
    const priorityPatterns = [
      /rfp/i,
      /question/i,
      /requirement/i,
      /response/i,
      /vendor/i,
      /technical/i,
      /functional/i,
    ];

    // First, check for sheets with priority names
    for (const pattern of priorityPatterns) {
      const match = sheetNames.find((name) => pattern.test(name));
      if (match) {
        return match;
      }
    }

    // Otherwise, find the sheet with the most rows (likely the main content)
    let bestSheet = sheetNames[0];
    let maxRows = 0;

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const rows = range.e.r - range.s.r + 1;

      if (rows > maxRows) {
        maxRows = rows;
        bestSheet = sheetName;
      }
    }

    return bestSheet;
  }

  /**
   * Detect column mapping from header row
   */
  private detectColumnMapping(data: any[][], sheetName: string): ExcelColumnMapping {
    // Find the header row (usually first row with text in multiple columns)
    let headerRowIndex = 0;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      const nonEmptyCells = row.filter((cell) => cell && String(cell).trim().length > 0);

      if (nonEmptyCells.length >= 2) {
        headerRowIndex = i;
        headers = row.map((cell) => String(cell || '').trim());
        break;
      }
    }

    // Detect column types
    let questionColumn: number | null = null;
    let answerColumn: number | null = null;
    let categoryColumn: number | null = null;
    let sectionColumn: number | null = null;

    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex];
      if (!header) continue;

      // Check for question column
      if (questionColumn === null) {
        for (const pattern of QUESTION_COLUMN_PATTERNS) {
          if (pattern.test(header)) {
            questionColumn = colIndex;
            break;
          }
        }
      }

      // Check for answer column
      if (answerColumn === null) {
        for (const pattern of ANSWER_COLUMN_PATTERNS) {
          if (pattern.test(header)) {
            answerColumn = colIndex;
            break;
          }
        }
      }

      // Check for category column
      if (categoryColumn === null) {
        for (const pattern of CATEGORY_COLUMN_PATTERNS) {
          if (pattern.test(header)) {
            categoryColumn = colIndex;
            break;
          }
        }
      }

      // Check for section column
      if (sectionColumn === null) {
        for (const pattern of SECTION_COLUMN_PATTERNS) {
          if (pattern.test(header)) {
            sectionColumn = colIndex;
            break;
          }
        }
      }
    }

    // If no question column found, try to infer from content
    if (questionColumn === null) {
      questionColumn = this.inferQuestionColumn(data, headerRowIndex);
    }

    // If still no question column, use the first column with substantial text
    if (questionColumn === null && headers.length > 0) {
      questionColumn = 0;
      console.log('   ⚠️ Could not detect question column, defaulting to first column');
    }

    // If no answer column found, look for an empty column after questions
    if (answerColumn === null && questionColumn !== null) {
      answerColumn = this.inferAnswerColumn(data, headerRowIndex, questionColumn);
    }

    return {
      questionColumn,
      answerColumn,
      categoryColumn,
      sectionColumn,
      headers,
      sheetName,
    };
  }

  /**
   * Infer question column by analyzing content (look for longest text cells)
   */
  private inferQuestionColumn(data: any[][], headerRowIndex: number): number | null {
    const sampleRows = data.slice(headerRowIndex + 1, Math.min(headerRowIndex + 20, data.length));

    if (sampleRows.length === 0) return null;

    // Calculate average text length per column
    const columnStats: { avgLength: number; questionLikeCount: number }[] = [];

    for (let col = 0; col < (data[headerRowIndex]?.length || 0); col++) {
      let totalLength = 0;
      let questionLikeCount = 0;
      let count = 0;

      for (const row of sampleRows) {
        const cellValue = String(row[col] || '').trim();
        if (cellValue.length > 0) {
          totalLength += cellValue.length;
          count++;

          // Check if content looks like a question
          if (cellValue.endsWith('?') || cellValue.length > 50) {
            questionLikeCount++;
          }
        }
      }

      columnStats[col] = {
        avgLength: count > 0 ? totalLength / count : 0,
        questionLikeCount,
      };
    }

    // Find the column with highest "question-like" score
    let bestCol = 0;
    let bestScore = 0;

    for (let col = 0; col < columnStats.length; col++) {
      const stats = columnStats[col];
      const score = stats.avgLength * 0.5 + stats.questionLikeCount * 20;

      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }

    return bestScore > 0 ? bestCol : null;
  }

  /**
   * Infer answer column (usually empty or after question column)
   */
  private inferAnswerColumn(data: any[][], headerRowIndex: number, questionColumn: number): number | null {
    const sampleRows = data.slice(headerRowIndex + 1, Math.min(headerRowIndex + 20, data.length));
    const numColumns = data[headerRowIndex]?.length || 0;

    // Look for columns after questionColumn that are mostly empty
    for (let col = questionColumn + 1; col < numColumns; col++) {
      let emptyCount = 0;

      for (const row of sampleRows) {
        const cellValue = String(row[col] || '').trim();
        if (cellValue.length === 0) {
          emptyCount++;
        }
      }

      // If more than 70% empty, likely an answer column
      if (emptyCount / sampleRows.length > 0.7) {
        return col;
      }
    }

    // If no empty column found, return the column right after questions
    if (questionColumn + 1 < numColumns) {
      return questionColumn + 1;
    }

    return null;
  }

  /**
   * Extract questions from parsed data
   */
  private extractQuestions(data: any[][], mapping: ExcelColumnMapping): ExcelRFPQuestion[] {
    const questions: ExcelRFPQuestion[] = [];

    if (mapping.questionColumn === null) {
      console.log('   ⚠️ No question column detected, cannot extract questions');
      return questions;
    }

    // Find header row index
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i].some((cell) => mapping.headers.includes(String(cell || '').trim()))) {
        headerRowIndex = i;
        break;
      }
    }

    // Extract questions from rows after header
    for (let rowIndex = headerRowIndex + 1; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      const questionText = String(row[mapping.questionColumn] || '').trim();

      // Skip empty rows or very short content
      if (questionText.length < 5) {
        continue;
      }

      // Skip if it looks like a section header (all caps, very short)
      if (questionText.length < 30 && questionText === questionText.toUpperCase()) {
        continue;
      }

      const question: ExcelRFPQuestion = {
        rowIndex,
        questionText,
        originalRow: [...row],
      };

      // Extract existing answer if present
      if (mapping.answerColumn !== null) {
        const existingAnswer = String(row[mapping.answerColumn] || '').trim();
        if (existingAnswer.length > 0) {
          question.existingAnswer = existingAnswer;
        }
      }

      // Extract category if present
      if (mapping.categoryColumn !== null) {
        const category = String(row[mapping.categoryColumn] || '').trim();
        if (category.length > 0) {
          question.category = category;
        }
      }

      // Extract section if present
      if (mapping.sectionColumn !== null) {
        const section = String(row[mapping.sectionColumn] || '').trim();
        if (section.length > 0) {
          question.section = section;
        }
      }

      questions.push(question);
    }

    return questions;
  }

  /**
   * Generate an Excel file with answers filled in
   */
  generateAnsweredExcel(
    originalBuffer: Buffer,
    answers: Map<number, string>,
    answerColumnIndex: number
  ): Buffer {
    console.log(`📊 Generating answered Excel file...`);

    // Read the original workbook
    const workbook = XLSX.read(originalBuffer, { type: 'buffer' });
    const targetSheet = this.findBestSheet(workbook);
    const worksheet = workbook.Sheets[targetSheet];

    // Convert to array of arrays for manipulation
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // Fill in answers
    let answersAdded = 0;
    for (const [rowIndex, answer] of answers) {
      if (rowIndex < data.length) {
        // Ensure row has enough columns
        while (data[rowIndex].length <= answerColumnIndex) {
          data[rowIndex].push('');
        }
        data[rowIndex][answerColumnIndex] = answer;
        answersAdded++;
      }
    }

    console.log(`   Added ${answersAdded} answers to column ${answerColumnIndex}`);

    // Create new worksheet from modified data
    const newWorksheet = XLSX.utils.aoa_to_sheet(data);

    // Preserve column widths if available
    if (worksheet['!cols']) {
      newWorksheet['!cols'] = worksheet['!cols'];
    }

    // Replace worksheet in workbook
    workbook.Sheets[targetSheet] = newWorksheet;

    // Generate buffer
    const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    console.log(`   ✅ Generated Excel file with answers`);

    return outputBuffer;
  }

  /**
   * Extract all text from Excel for general RFP analysis
   */
  extractTextFromExcel(buffer: Buffer): string {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const textParts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      textParts.push(`\n=== Sheet: ${sheetName} ===\n`);

      for (const row of data) {
        const rowText = row
          .map((cell) => String(cell || '').trim())
          .filter((text) => text.length > 0)
          .join(' | ');

        if (rowText.length > 0) {
          textParts.push(rowText);
        }
      }
    }

    return textParts.join('\n');
  }

  /**
   * Validate that a file is a valid Excel file
   */
  validateExcelFile(buffer: Buffer): { valid: boolean; error?: string } {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return { valid: false, error: 'Excel file contains no sheets' };
      }

      // Check if at least one sheet has content
      let hasContent = false;
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (worksheet['!ref']) {
          hasContent = true;
          break;
        }
      }

      if (!hasContent) {
        return { valid: false, error: 'Excel file has no content' };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Singleton instance
let excelServiceInstance: ExcelService | null = null;

export function getExcelService(): ExcelService {
  if (!excelServiceInstance) {
    excelServiceInstance = new ExcelService();
  }
  return excelServiceInstance;
}

export default ExcelService;
