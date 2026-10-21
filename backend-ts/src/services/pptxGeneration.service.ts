import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { parseString, Builder } from 'xml2js';
import { promisify } from 'util';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const parseXml = promisify(parseString);

// Initialize OpenAI client with proper error handling
let openai: OpenAI;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables. Please create a .env file with your API key.');
  }
  openai = new OpenAI({
    apiKey: apiKey
  });
  console.log('✅ OpenAI client initialized successfully');
} catch (error: any) {
  console.log('❌ OpenAI client initialization failed:', error.message);
  process.exit(1);
}

interface TableData {
  headers: string[];
  rows: string[][];
}

interface TimelinePhase {
  name: string;
  duration: string;
  tasks: string[];
}

interface TimelineData {
  phases: TimelinePhase[];
}

interface VisualDirectives {
  type: string;
  content_based?: boolean;
  data_specification?: {
    structure?: string;
    layout?: string;
    image_generation_required?: boolean;
    table?: TableData;
    phases?: TimelinePhase[];
    alignment?: string;
  };
  image_prompt?: string;
}

interface ContentSection {
  slide_title: string;
  slide_id?: string;
  content_sections: string[];
  visual_directives?: VisualDirectives;
  speaker_notes?: string;

  // Legacy support (backward compatibility)
  slide_type?: string;
  table?: TableData;
  timeline?: TimelineData;
  image_prompt?: string;
  image_path?: string;
}

interface PresentationConfig {
  presentation_title?: string;
  presentation_metadata?: {
    title?: string;
    [key: string]: any;
  };
  slides: ContentSection[];
  [key: string]: any; // Allow other metadata fields
}

interface ImagePlaceholder {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  relId?: string;
}

interface SlideAnalysis {
  slideNumber: number;
  hasTitle: boolean;
  hasContent: boolean;
  imagePlaceholders: ImagePlaceholder[];
  textPlaceholders: number;
  slideType: 'content_only' | 'image_only' | 'text_and_image' | 'empty' | 'complex';
}

interface TemplateAnalysis {
  totalSlides: number;
  slides: Map<number, SlideAnalysis>;
  contentOnlySlides: number[];
  imageOnlySlides: number[];
  textAndImageSlides: number[];
  emptySlides: number[];
  complexSlides: number[];
}

// Cache for generated images to avoid regenerating the same image multiple times
// Removed: const generatedImages - now using imageBufferCache for memory-only storage

// NEW FUNCTION: Analyze a single slide to determine its capabilities
function analyzeSlide(slideXml: string, slideNumber: number): SlideAnalysis {
  const imagePlaceholders = extractImagePlaceholders(slideXml);

  // Count text placeholders (title and content)
  const titleMatches = slideXml.match(/<p:ph type="title"\/>/g);
  const bodyMatches = slideXml.match(/<p:ph type="body"\/>/g);
  const contentMatches = slideXml.match(/<p:ph type="ctrTitle"\/>/g);

  const hasTitle = titleMatches !== null || contentMatches !== null;
  const hasContent = bodyMatches !== null;
  const textPlaceholders = (titleMatches?.length || 0) + (bodyMatches?.length || 0) + (contentMatches?.length || 0);

  // Determine slide type based on what placeholders it has
  let slideType: SlideAnalysis['slideType'];

  if (imagePlaceholders.length > 0 && (hasTitle || hasContent)) {
    slideType = 'text_and_image';
  } else if (imagePlaceholders.length > 0 && !hasTitle && !hasContent) {
    slideType = 'image_only';
  } else if (imagePlaceholders.length === 0 && (hasTitle || hasContent)) {
    slideType = 'content_only';
  } else if (textPlaceholders > 3 || imagePlaceholders.length > 2) {
    slideType = 'complex';
  } else {
    slideType = 'empty';
  }

  return {
    slideNumber,
    hasTitle,
    hasContent,
    imagePlaceholders,
    textPlaceholders,
    slideType
  };
}

// Analyze entire template to understand its structure
async function analyzeTemplate(zip: JSZip): Promise<TemplateAnalysis> {
  const slideFiles = Object.keys(zip.files)
    .filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
      return numA - numB;
    });

  const slides = new Map<number, SlideAnalysis>();
  const contentOnlySlides: number[] = [];
  const imageOnlySlides: number[] = [];
  const textAndImageSlides: number[] = [];
  const emptySlides: number[] = [];
  const complexSlides: number[] = [];

  for (const slideFile of slideFiles) {
    const slideNum = parseInt(slideFile.match(/slide(\d+)\.xml/)?.[1] || '0');
    const slideXml = await zip.file(slideFile)!.async('string');
    const analysis = analyzeSlide(slideXml, slideNum);

    slides.set(slideNum, analysis);

    // Categorize slides
    switch (analysis.slideType) {
      case 'content_only':
        contentOnlySlides.push(slideNum);
        break;
      case 'image_only':
        imageOnlySlides.push(slideNum);
        break;
      case 'text_and_image':
        textAndImageSlides.push(slideNum);
        break;
      case 'empty':
        emptySlides.push(slideNum);
        break;
      case 'complex':
        complexSlides.push(slideNum);
        break;
    }
  }

  return {
    totalSlides: slideFiles.length,
    slides,
    contentOnlySlides,
    imageOnlySlides,
    textAndImageSlides,
    emptySlides,
    complexSlides
  };
}

// Memory cache for image buffers (no disk storage)
const imageBufferCache = new Map<string, Buffer>();

// Export function to clear cache (prevents memory leaks)
export function clearImageCache(): void {
  const cacheSize = imageBufferCache.size;
  const memoryFreed = Array.from(imageBufferCache.values())
    .reduce((sum, buffer) => sum + buffer.length, 0);

  imageBufferCache.clear();

  console.log(`   🧹 Cleared ${cacheSize} images from cache (freed ${(memoryFreed / 1024 / 1024).toFixed(2)} MB)`);
}

async function generateImageWithOpenAI(prompt: string, width: number, height: number): Promise<Buffer> {
  // Calculate approximate dimensions for DALL-E
  const targetSize = Math.max(width, height) / 100000; // Rough conversion from EMU to reasonable size
  let dalleSize: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024";

  if (width > height * 1.5) {
    dalleSize = "1792x1024"; // Wide
  } else if (height > width * 1.5) {
    dalleSize = "1024x1792"; // Tall
  }

  // Check cache first with size consideration
  const cacheKey = `${prompt}_${width}x${height}`;
  if (imageBufferCache.has(cacheKey)) {
    console.log(`      📸 Using cached image buffer for: ${prompt.substring(0, 50)}...`);
    return imageBufferCache.get(cacheKey)!;
  }

  try {
    console.log(`      🤖 Generating image (${dalleSize}) with prompt: ${prompt}`);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: dalleSize,
      quality: "standard",
      n: 1,
    });

    // Add proper null checks
    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from OpenAI');
    }

    const firstImage = response.data[0];
    if (!firstImage) {
      throw new Error('No image in response data');
    }

    const imageUrl = firstImage.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    console.log(`      📥 Downloading image from: ${imageUrl.substring(0, 50)}...`);

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    console.log(`      ✅ Image buffer created in memory (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

    // Cache the image buffer in memory (no disk write)
    imageBufferCache.set(cacheKey, imageBuffer);
    return imageBuffer;

  } catch (error: any) {
    console.error(`      ❌ Error generating image: ${error.message}`);
    console.log(`      ⚠️  Image generation failed, presentation will continue without this image`);

    // Return empty buffer as fallback
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

// NEW FUNCTION: Extract image placeholders from slide XML
function extractImagePlaceholders(slideXml: string): ImagePlaceholder[] {
  const placeholders: ImagePlaceholder[] = [];
  
  try {
    // Look for picture placeholders in the XML
    const picRegex = /<p:pic>[\s\S]*?<\/p:pic>/g;
    const picMatches = slideXml.match(picRegex) || [];
    
    picMatches.forEach((picXml, index) => {
      try {
        // ONLY process elements that have blipFill (contain an image/placeholder with image)
        if (!picXml.includes('<p:blipFill')) {
          return; // Skip if not an image
        }

        // Extract ID and name FIRST (from p:cNvPr)
        const idMatch = picXml.match(/<p:cNvPr[^>]*id="(\d+)"[^>]*name="([^"]*)"/);

        // Extract position and size (from p:spPr which comes after)
        const xMatch = picXml.match(/<a:off x="(\d+)"/);
        const yMatch = picXml.match(/y="(\d+)"/);
        const cxMatch = picXml.match(/<a:ext cx="(\d+)"/);
        const cyMatch = picXml.match(/cy="(\d+)"/);

        if (xMatch && yMatch && cxMatch && cyMatch && idMatch) {
          placeholders.push({
            id: idMatch[1],
            name: idMatch[2],
            x: parseInt(xMatch[1]),
            y: parseInt(yMatch[1]),
            width: parseInt(cxMatch[1]),
            height: parseInt(cyMatch[1])
          });
        }
      } catch (error) {
        console.log(`      ⚠️  Could not parse picture element ${index + 1}`);
      }
    });
    
  } catch (error) {
    console.log('      ⚠️  Error extracting placeholders:', error);
  }
  
  console.log(`      📷 Found ${placeholders.length} image placeholders`);
  return placeholders;
}

// NEW FUNCTION: Handle image placeholder slides specifically
async function processImagePlaceholderSlide(slideXml: string, slideConfig: ContentSection, slideNum: number, zip: JSZip): Promise<string> {
  console.log(`      🖼️  Processing image placeholder slide ${slideNum}`);

  const placeholders = extractImagePlaceholders(slideXml);

  if (placeholders.length === 0) {
    console.log(`      ⚠️  No image placeholders found in slide ${slideNum}, using regular content`);
    return fillTitleAndContent(slideXml, slideConfig);
  }

  let updatedXml = slideXml;

  // Process ONLY the FIRST/MAIN placeholder (skip small logos for now)
  // Sort placeholders by size (largest first) to get the main image
  const sortedPlaceholders = placeholders.sort((a, b) => (b.width * b.height) - (a.width * a.height));

  if (sortedPlaceholders.length > 0) {
    const placeholder = sortedPlaceholders[0]; // Use only the largest (main) image placeholder
    const imageRelId = `rId${slideNum}1`;

    console.log(`      📐 Main Placeholder: ${placeholder.width}x${placeholder.height} at (${placeholder.x}, ${placeholder.y})`);

    try {
      // Generate image buffer from prompt (memory-only)
      const imagePrompt = getImagePrompt(slideConfig);
      let imageBuffer: Buffer | null = null;

      if (imagePrompt) {
        // Generate new image buffer (memory-only)
        try {
          imageBuffer = await generateImageWithOpenAI(imagePrompt, placeholder.width, placeholder.height);
        } catch (error: any) {
          console.log(`      ⚠️  Image generation failed: ${error.message}`);
          return fillTitleAndContent(updatedXml, slideConfig);
        }
      } else {
        console.log(`      ⚠️  No image prompt provided for placeholder`);
        return fillTitleAndContent(updatedXml, slideConfig);
      }

      if (imageBuffer) {
        // Add image buffer directly to ZIP (no disk I/O)
        const imageName = `image_slide${slideNum}.png`;
        const imageTarget = `../media/${imageName}`;

        // Add image buffer to media folder
        zip.file(`ppt/media/${imageName}`, imageBuffer);

        // Replace the placeholder with actual image
        updatedXml = replaceImagePlaceholderWithContent(updatedXml, placeholder, imageRelId, imageTarget);

        // Update slide relationships
        await updateSlideRelationship(zip, slideNum, imageRelId, imageTarget);

        console.log(`      ✅ Filled main image placeholder (memory-only)`);
      } else {
        console.log(`      ⚠️  Image buffer not available for main placeholder`);
      }

    } catch (error: any) {
      console.log(`      ❌ Error processing main placeholder: ${error.message}`);
    }
  }

  // Fill title and content if needed
  updatedXml = fillTitleAndContent(updatedXml, slideConfig);

  return updatedXml;
}

// NEW FUNCTION: Replace specific image placeholder
function replaceImagePlaceholderWithContent(slideXml: string, placeholder: ImagePlaceholder, relId: string, imageTarget: string): string {
  // Generate the new image XML that maintains the original position and size
  const newImageXml = generateImageXmlForPlaceholder(placeholder, relId, imageTarget);

  // Find the complete <p:pic> element that matches this placeholder ID
  // Use a more robust regex that matches the complete pic element
  const escapedId = placeholder.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const picRegex = new RegExp(`<p:pic>[\\s\\S]*?<p:cNvPr[^>]*id="${escapedId}"[\\s\\S]*?<\\/p:pic>`);

  const match = slideXml.match(picRegex);
  if (match) {
    console.log(`      ✅ Found placeholder with ID ${placeholder.id}, replacing...`);
    return slideXml.replace(picRegex, newImageXml);
  }

  console.log(`      ⚠️  Could not find placeholder with ID ${placeholder.id}`);
  console.log(`      📍 Trying position-based matching...`);

  // Fallback: Try to match by position and size
  const posRegex = new RegExp(`<p:pic>[\\s\\S]*?<a:off x="${placeholder.x}" y="${placeholder.y}"/>[\\s\\S]*?<a:ext cx="${placeholder.width}" cy="${placeholder.height}"/>[\\s\\S]*?<\\/p:pic>`);

  const posMatch = slideXml.match(posRegex);
  if (posMatch) {
    console.log(`      ✅ Found placeholder by position, replacing...`);
    return slideXml.replace(posRegex, newImageXml);
  }

  console.log(`      ⚠️  Could not find exact placeholder match, adding image to spTree`);

  // Last resort: Add to the end of spTree
  const spTreeClose = '</p:spTree>';
  if (slideXml.includes(spTreeClose)) {
    return slideXml.replace(spTreeClose, `${newImageXml}${spTreeClose}`);
  }

  return slideXml;
}

// NEW FUNCTION: Generate image XML that maintains placeholder dimensions
function generateImageXmlForPlaceholder(placeholder: ImagePlaceholder, relId: string, imageTarget: string): string {
  return `
<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="${placeholder.id}" name="${placeholder.name}" descr="AI Generated Image"/>
    <p:cNvPicPr>
      <a:picLocks noGrp="1" noChangeAspect="1"/>
    </p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="${relId}">
      <a:extLst>
        <a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">
          <a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/>
        </a:ext>
      </a:extLst>
    </a:blip>
    <a:stretch>
      <a:fillRect/>
    </a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm>
      <a:off x="${placeholder.x}" y="${placeholder.y}"/>
      <a:ext cx="${placeholder.width}" cy="${placeholder.height}"/>
    </a:xfrm>
    <a:prstGeom prst="rect">
      <a:avLst/>
    </a:prstGeom>
    <a:ln w="9525">
      <a:solidFill>
        <a:schemeClr val="accent1"/>
      </a:solidFill>
    </a:ln>
  </p:spPr>
</p:pic>`;
}

// NEW FUNCTION: Update single slide relationship
async function updateSlideRelationship(zip: JSZip, slideNum: number, relId: string, imageTarget: string): Promise<void> {
  const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
  
  let relsXml: string;
  
  try {
    const existingRelsFile = zip.file(relsPath);
    if (existingRelsFile) {
      relsXml = await existingRelsFile.async('string');
      
      // Check if relationship already exists
      if (!relsXml.includes(`Id="${relId}"`)) {
        // Add new relationship before closing tag
        const relationshipTag = `  <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${imageTarget}"/>\n</Relationships>`;
        relsXml = relsXml.replace('</Relationships>', relationshipTag);
      }
    } else {
      // Create new relationships file
      relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${imageTarget}"/>
</Relationships>`;
    }
    
    zip.file(relsPath, relsXml);
  } catch (error) {
    console.log(`      ⚠️  Error updating relationships for slide ${slideNum}:`, error);
  }
}

// NEW FUNCTION: Fill title and content for placeholder slides
function fillTitleAndContent(slideXml: string, slideConfig: ContentSection): string {
  let updatedXml = slideXml;
  
  // Fill title
  updatedXml = fillTitlePlaceholder(updatedXml, slideConfig.slide_title);
  
  // Fill content if available
  if (slideConfig.content_sections && slideConfig.content_sections.length > 0) {
    const content = slideConfig.content_sections.join('\n• ');
    updatedXml = fillContentPlaceholder(updatedXml, `• ${content}`);
  }
  
  return updatedXml;
}

// HELPER FUNCTIONS: Extract data from new or legacy config format
function getSlideType(slide: ContentSection): string {
  // New format: visual_directives.type
  if (slide.visual_directives?.type) {
    return slide.visual_directives.type;
  }
  // Legacy format: slide_type
  return slide.slide_type || 'text_slide';
}

function getTableData(slide: ContentSection): TableData | undefined {
  // New format: visual_directives.data_specification.table
  if (slide.visual_directives?.data_specification?.table) {
    return slide.visual_directives.data_specification.table;
  }
  // Legacy format: table
  return slide.table;
}

function getTimelineData(slide: ContentSection): TimelineData | undefined {
  // New format: visual_directives.data_specification.phases
  if (slide.visual_directives?.data_specification?.phases) {
    return { phases: slide.visual_directives.data_specification.phases };
  }
  // Legacy format: timeline
  return slide.timeline;
}

function getImagePrompt(slide: ContentSection): string | undefined {
  // New format: visual_directives.image_prompt
  if (slide.visual_directives?.image_prompt) {
    return slide.visual_directives.image_prompt;
  }
  // Legacy format: image_prompt
  return slide.image_prompt;
}

function getPresentationTitle(config: PresentationConfig): string {
  // New format: presentation_metadata.title
  if (config.presentation_metadata?.title) {
    return config.presentation_metadata.title;
  }
  // Legacy format: presentation_title
  return config.presentation_title || 'Untitled Presentation';
}

// MODIFIED: Main presentation generation function with DYNAMIC template analysis
async function generatePresentation() {
  console.log('🎨 PowerPoint Generator - Dynamic Template Analysis\n');

  const baseDir = process.cwd();
  const configPath = path.join(baseDir, 'presentation-config.json');
  const config: PresentationConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const presentationTitle = getPresentationTitle(config);
  console.log(`📊 Presentation: ${presentationTitle}`);
  console.log(`📄 Config Slides: ${config.slides.length}\n`);

  // Read template
  const templatePath = path.join(baseDir, 'Northstar Integrators_Template.pptx');
  console.log(`📂 Reading template: ${templatePath}`);
  const templateData = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateData);

  // DYNAMIC: Analyze template structure
  const templateAnalysis = await analyzeTemplate(zip);

  // Create slide pool indices for each category
  let contentOnlyIndex = 0;
  let textAndImageIndex = 0;
  let imageOnlyIndex = 0;
  let complexIndex = 0;
  let emptyIndex = 0;

  const usedSlides: number[] = [];
  const slideProcessingOrder: number[] = []; // Track the order slides were processed

  // Fill slides - DYNAMIC MAPPING
  console.log(`✏️  FILLING SLIDES WITH CONTENT:\n`);

  // STEP 1: Create Title Slide (first available empty or content slide)
  let titleSlideNum: number;
  if (emptyIndex < templateAnalysis.emptySlides.length) {
    titleSlideNum = templateAnalysis.emptySlides[emptyIndex++];
  } else if (contentOnlyIndex < templateAnalysis.contentOnlySlides.length) {
    titleSlideNum = templateAnalysis.contentOnlySlides[contentOnlyIndex++];
  } else {
    console.log(`   ⚠️  No suitable slide for title. Skipping title slide.`);
    titleSlideNum = -1;
  }

  if (titleSlideNum !== -1) {
    console.log(`   📋 CREATING Title Slide ${titleSlideNum}: ${presentationTitle}`);
    const companyName = config.client_context?.company || 'Valued Partner';
    const subtitle = `Presented for ${companyName}`;
    const titleSlideXml = createTitleSlide(presentationTitle, subtitle, titleSlideNum);
    const titleSlidePath = `ppt/slides/slide${titleSlideNum}.xml`;
    zip.file(titleSlidePath, applyFontStyling(titleSlideXml));

    const debugDir = path.join(process.cwd(), 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    fs.writeFileSync(path.join(debugDir, `slide${titleSlideNum}_debug.xml`), titleSlideXml);
    console.log(`      💾 Debug XML saved: debug/slide${titleSlideNum}_debug.xml`);

    usedSlides.push(titleSlideNum);
    slideProcessingOrder.push(titleSlideNum);
  }

  // STEP 2: Create Agenda Slide (second available empty or content slide)
  let agendaSlideNum: number;
  if (emptyIndex < templateAnalysis.emptySlides.length) {
    agendaSlideNum = templateAnalysis.emptySlides[emptyIndex++];
  } else if (contentOnlyIndex < templateAnalysis.contentOnlySlides.length) {
    agendaSlideNum = templateAnalysis.contentOnlySlides[contentOnlyIndex++];
  } else {
    console.log(`   ⚠️  No suitable slide for agenda. Skipping agenda slide.`);
    agendaSlideNum = -1;
  }

  if (agendaSlideNum !== -1) {
    console.log(`   📋 CREATING Agenda Slide ${agendaSlideNum}`);
    const agendaItems = config.slides.map(s => s.slide_title);
    const agendaSlideXml = createAgendaSlide(agendaItems, agendaSlideNum);
    const agendaSlidePath = `ppt/slides/slide${agendaSlideNum}.xml`;
    zip.file(agendaSlidePath, applyFontStyling(agendaSlideXml));

    const debugDir = path.join(process.cwd(), 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    fs.writeFileSync(path.join(debugDir, `slide${agendaSlideNum}_debug.xml`), agendaSlideXml);
    console.log(`      💾 Debug XML saved: debug/slide${agendaSlideNum}_debug.xml`);

    usedSlides.push(agendaSlideNum);
    slideProcessingOrder.push(agendaSlideNum);
  }

  // STEP 3: Process all content slides from config
  for (let i = 0; i < config.slides.length; i++) {
    const slideConfig = config.slides[i];
    let targetSlideNumber: number;
    let targetSlidePath: string;
    let slideXml: string = '';

    // Get slide type and data using helper functions
    const slideType = getSlideType(slideConfig);
    const tableData = getTableData(slideConfig);
    const timelineData = getTimelineData(slideConfig);
    const imagePrompt = getImagePrompt(slideConfig);

    // DYNAMIC DECISION TREE: Choose the right template slide based on content type and available slides

    // 1. TABLE/GRID/TIMELINE SLIDES -> Use complex slides (if available) or create from scratch
    if (slideType === 'table' && tableData) {
      // Prefer complex slides for tables
      if (complexIndex < templateAnalysis.complexSlides.length) {
        targetSlideNumber = templateAnalysis.complexSlides[complexIndex++];
      } else if (emptyIndex < templateAnalysis.emptySlides.length) {
        targetSlideNumber = templateAnalysis.emptySlides[emptyIndex++];
      } else {
        console.log(`   ⚠️  No suitable slides for table. Skipping: ${slideConfig.slide_title}`);
        continue;
      }
      targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
      slideXml = createTableSlide(slideConfig.slide_title, tableData, targetSlideNumber);
    }

    // 2. GRID SLIDES
    else if (slideType === 'grid') {
      if (complexIndex < templateAnalysis.complexSlides.length) {
        targetSlideNumber = templateAnalysis.complexSlides[complexIndex++];
      } else if (emptyIndex < templateAnalysis.emptySlides.length) {
        targetSlideNumber = templateAnalysis.emptySlides[emptyIndex++];
      } else {
        console.log(`   ⚠️  No suitable slides for grid. Skipping: ${slideConfig.slide_title}`);
        continue;
      }
      targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
      slideXml = createGridContentSlide(slideConfig.slide_title, slideConfig.content_sections, targetSlideNumber);
    }

    // 3. TIMELINE SLIDES
    else if (slideType === 'timeline' && timelineData) {
      if (complexIndex < templateAnalysis.complexSlides.length) {
        targetSlideNumber = templateAnalysis.complexSlides[complexIndex++];
      } else if (emptyIndex < templateAnalysis.emptySlides.length) {
        targetSlideNumber = templateAnalysis.emptySlides[emptyIndex++];
      } else {
        console.log(`   ⚠️  No suitable slides for timeline. Skipping: ${slideConfig.slide_title}`);
        continue;
      }
      targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;

      console.log(`   📅 FILLING Slide ${targetSlideNumber}: ${slideConfig.slide_title} (TIMELINE)`);
      slideXml = createTimelineSlide(slideConfig.slide_title, timelineData, targetSlideNumber);
    }

    // 4. IMAGE SLIDES -> Generate image with DALL-E and embed
    else if ((slideType === 'image' || slideType === 'text_and_image') && imagePrompt) {
      // Try template slides with image placeholders first
      if (textAndImageIndex < templateAnalysis.textAndImageSlides.length) {
        targetSlideNumber = templateAnalysis.textAndImageSlides[textAndImageIndex++];
        targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
        const slideFile = zip.file(targetSlidePath);
        if (slideFile) {
          slideXml = await slideFile.async('string');
          slideXml = await processImagePlaceholderSlide(slideXml, slideConfig, targetSlideNumber, zip);
        } else {
          console.log(`   ❌ Slide ${targetSlideNumber} not found in template!`);
          continue;
        }
      } else if (imageOnlyIndex < templateAnalysis.imageOnlySlides.length) {
        targetSlideNumber = templateAnalysis.imageOnlySlides[imageOnlyIndex++];
        targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
        const slideFile = zip.file(targetSlidePath);
        if (slideFile) {
          slideXml = await slideFile.async('string');
          slideXml = await processImagePlaceholderSlide(slideXml, slideConfig, targetSlideNumber, zip);
        } else {
          console.log(`   ❌ Slide ${targetSlideNumber} not found in template!`);
          continue;
        }
      } else if (emptyIndex < templateAnalysis.emptySlides.length) {
        targetSlideNumber = templateAnalysis.emptySlides[emptyIndex++];
        targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
        console.log(`   🖼️ CREATING Image Slide ${targetSlideNumber}: ${slideConfig.slide_title}`);
        slideXml = await createImageSlide(slideConfig.slide_title, imagePrompt, slideConfig.content_sections, targetSlideNumber, zip);
      } else if (contentOnlyIndex < templateAnalysis.contentOnlySlides.length) {
        targetSlideNumber = templateAnalysis.contentOnlySlides[contentOnlyIndex++];
        targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
        console.log(`   🖼️ CREATING Image Slide ${targetSlideNumber}: ${slideConfig.slide_title} (overwriting content slide)`);
        slideXml = await createImageSlide(slideConfig.slide_title, imagePrompt, slideConfig.content_sections, targetSlideNumber, zip);
      } else {
        console.log(`   ⚠️  No suitable slides for image content. Skipping: ${slideConfig.slide_title}`);
        continue;
      }
    }

    // 5. REGULAR CONTENT SLIDES -> Use content_only slides (best match)
    else {
      if (contentOnlyIndex < templateAnalysis.contentOnlySlides.length) {
        targetSlideNumber = templateAnalysis.contentOnlySlides[contentOnlyIndex++];
      } else if (textAndImageIndex < templateAnalysis.textAndImageSlides.length) {
        // Fallback to text_and_image (just won't fill the image)
        targetSlideNumber = templateAnalysis.textAndImageSlides[textAndImageIndex++];
      } else if (emptyIndex < templateAnalysis.emptySlides.length) {
        targetSlideNumber = templateAnalysis.emptySlides[emptyIndex++];
      } else {
        console.log(`   ⚠️  No suitable slides for content. Skipping: ${slideConfig.slide_title}`);
        continue;
      }
      targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;

      console.log(`   📝 FILLING Slide ${targetSlideNumber}: ${slideConfig.slide_title} (REGULAR CONTENT)`);

      const slideFile = zip.file(targetSlidePath);
      if (slideFile) {
        slideXml = await slideFile.async('string');
        slideXml = fillTitleAndContent(slideXml, slideConfig);
      } else {
        console.log(`   ❌ Slide ${targetSlideNumber} not found in template!`);
        continue;
      }
    }

    // Apply styling and save
    slideXml = applyFontStyling(slideXml);
    zip.file(targetSlidePath, slideXml);

    // Write debug file
    const debugDir = path.join(baseDir, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    fs.writeFileSync(path.join(debugDir, `slide${targetSlideNumber}_debug.xml`), slideXml);
    console.log(`      💾 Debug XML saved: debug/slide${targetSlideNumber}_debug.xml`);

    usedSlides.push(targetSlideNumber);
    slideProcessingOrder.push(targetSlideNumber); // Track the order for presentation.xml
  }

  // STEP 4: Create Thank You Slide (last available empty or content slide)
  let thankYouSlideNum: number;
  if (emptyIndex < templateAnalysis.emptySlides.length) {
    thankYouSlideNum = templateAnalysis.emptySlides[emptyIndex++];
  } else if (contentOnlyIndex < templateAnalysis.contentOnlySlides.length) {
    thankYouSlideNum = templateAnalysis.contentOnlySlides[contentOnlyIndex++];
  } else {
    console.log(`   ⚠️  No suitable slide for thank you. Skipping thank you slide.`);
    thankYouSlideNum = -1;
  }

  if (thankYouSlideNum !== -1) {
    console.log(`   📋 CREATING Thank You Slide ${thankYouSlideNum}`);
    const companyName = config.client_context?.company || undefined;
    const thankYouSlideXml = createThankYouSlide(thankYouSlideNum, companyName);
    const thankYouSlidePath = `ppt/slides/slide${thankYouSlideNum}.xml`;
    zip.file(thankYouSlidePath, applyFontStyling(thankYouSlideXml));

    const debugDir = path.join(process.cwd(), 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    fs.writeFileSync(path.join(debugDir, `slide${thankYouSlideNum}_debug.xml`), thankYouSlideXml);
    console.log(`      💾 Debug XML saved: debug/slide${thankYouSlideNum}_debug.xml`);

    usedSlides.push(thankYouSlideNum);
    slideProcessingOrder.push(thankYouSlideNum);
  }

  // Identify unused slides
  const allTemplateSlides = Array.from(templateAnalysis.slides.keys());
  const unusedSlides = allTemplateSlides.filter(slideNum => !usedSlides.includes(slideNum));

  console.log(`📊 Slide usage: ${usedSlides.length} used, ${unusedSlides.length} unused`);

  // Remove ALL unused slides

  let removedCount = 0;
  for (const slideNum of unusedSlides) {
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const relPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

    if (zip.file(slidePath)) {
      zip.remove(slidePath);
      console.log(`   🗑️  REMOVED: ${slidePath}`);
      removedCount++;
    }
    if (zip.file(relPath)) {
      zip.remove(relPath);
      console.log(`   🗑️  REMOVED: ${relPath}`);
      removedCount++;
    }
  }

  console.log(`🗑️  Removed ${removedCount} unused slide files`);

  // Update presentation.xml to reflect actual slide count and order
  const finalSlideCount = usedSlides.length;
  await updatePresentationXml(zip, slideProcessingOrder);

  // Generate output
  const outputDir = path.join(baseDir, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const baseFileName = presentationTitle.replace(/\s+/g, '_');
  let version = 1;
  let outputPath = path.join(outputDir, `${baseFileName}.pptx`);

  while (fs.existsSync(outputPath)) {
    version++;
    outputPath = path.join(outputDir, `${baseFileName}_v${version}.pptx`);
  }

  console.log(`\n📝 OUTPUT FILE: ${path.basename(outputPath)}`);
  console.log(`\n💾 GENERATING POWERPOINT FILE...`);
  
  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  fs.writeFileSync(outputPath, content);

  console.log(`\n✅ SUCCESS!`);
  console.log(`📄 Generated: ${outputPath}`);
  console.log(`📊 Final Slide Count: ${finalSlideCount} slides`);
  console.log(`\n📈 TEMPLATE UTILIZATION:`);
  console.log(`   Content Only Slides Used: ${contentOnlyIndex}/${templateAnalysis.contentOnlySlides.length}`);
  console.log(`   Text & Image Slides Used: ${textAndImageIndex}/${templateAnalysis.textAndImageSlides.length}`);
  console.log(`   Image Only Slides Used: ${imageOnlyIndex}/${templateAnalysis.imageOnlySlides.length}`);
  console.log(`   Complex Slides Used: ${complexIndex}/${templateAnalysis.complexSlides.length}`);
  console.log(`   Empty Slides Used: ${emptyIndex}/${templateAnalysis.emptySlides.length}`);
  console.log(`✅ Generated ${finalSlideCount} slides with ${imageBufferCache.size} AI images`);
  console.log(`🗑️  Removed ${unusedSlides.length} unused slides\n`);
}

function fillTitlePlaceholder(slideXml: string, title: string): string {
  // Multiple approaches to find and replace title placeholder
  
  // Approach 1: Replace empty title tags
  let updatedXml = slideXml.replace(/<a:t><\/a:t>/g, (match, offset) => {
    // Only replace the first occurrence (title)
    if (offset === slideXml.indexOf('<a:t></a:t>')) {
      return `<a:t>${escapeXml(title)}</a:t>`;
    }
    return match;
  });
  
  // Approach 2: If first approach didn't work, look for specific title patterns
  if (updatedXml === slideXml) {
    // Look for title placeholder text or specific patterns
    updatedXml = slideXml.replace(/<a:t>Click to add title<\/a:t>/i, `<a:t>${escapeXml(title)}</a:t>`);
    updatedXml = updatedXml.replace(/<a:t>.*Title.*<\/a:t>/i, `<a:t>${escapeXml(title)}</a:t>`);
  }
  
  // Approach 3: Replace first non-empty text element (fallback)
  if (updatedXml === slideXml) {
    const titleMatch = slideXml.match(/<a:t>([^<]*)<\/a:t>/);
    if (titleMatch && titleMatch[1].trim() === '') {
      updatedXml = slideXml.replace(titleMatch[0], `<a:t>${escapeXml(title)}</a:t>`);
    }
  }
  
  return updatedXml;
}

function fillContentPlaceholder(slideXml: string, content: string): string {
  // Multiple approaches to find and replace content placeholder
  
  // Approach 1: Replace second empty text tag
  let placeholderCount = 0;
  let updatedXml = slideXml.replace(/<a:t><\/a:t>/g, (match) => {
    placeholderCount++;
    if (placeholderCount === 2) {
      return `<a:t>${escapeXml(content)}</a:t>`;
    }
    return match;
  });
  
  // Approach 2: If that didn't work, look for content placeholders
  if (updatedXml === slideXml) {
    updatedXml = slideXml.replace(/<a:t>Click to add text<\/a:t>/i, `<a:t>${escapeXml(content)}</a:t>`);
    updatedXml = updatedXml.replace(/<a:t>.*Text.*<\/a:t>/i, `<a:t>${escapeXml(content)}</a:t>`);
  }
  
  // Approach 3: Replace the second text element found
  if (updatedXml === slideXml) {
    const textMatches = [];
    const regex = /<a:t>([^<]*)<\/a:t>/g;
    let match;
    
    while ((match = regex.exec(slideXml)) !== null) {
      textMatches.push(match);
    }
    
    if (textMatches.length >= 2) {
      // Replace the second text element (assuming first is title, second is content)
      updatedXml = slideXml.replace(textMatches[1][0], `<a:t>${escapeXml(content)}</a:t>`);
    }
  }
  
  return updatedXml;
}

function createTableSlide(title: string, tableData: TableData, slideNum: number): string {
  console.log(`      Creating table on Slide ${slideNum}`);
  
  const { headers, rows } = tableData;
  const numCols = headers.length;
  const numRows = rows.length + 1;

  const tableWidth = 8000000;
  const tableHeight = Math.max(3000000, numRows * 500000);
  const startX = 1500000;
  const startY = 2000000;
  const colWidth = Math.floor(tableWidth / numCols);
  const rowHeight = Math.floor(tableHeight / numRows);

  console.log(`      Table: ${numCols} cols x ${numRows} rows`);

  const gridCols = Array(numCols).fill(colWidth)
    .map(width => `<a:gridCol w="${width}"/>`)
    .join('');

  let tableRows = '';
  tableRows += generateTableRow(headers, 0, rowHeight, true, 'header');
  rows.forEach((row, rowIndex) => {
    tableRows += generateTableRow(row, rowIndex + 1, rowHeight, false, 'data');
  });

  const tableXml = `
<p:graphicFrame>
  <p:nvGraphicFramePr>
    <p:cNvPr id="${3 + slideNum}" name="Table ${slideNum}"/>
    <p:cNvGraphicFramePr>
      <a:graphicFrameLocks noGrp="1"/>
    </p:cNvGraphicFramePr>
    <p:nvPr/>
  </p:nvGraphicFramePr>
  <p:xfrm>
    <a:off x="${startX}" y="${startY}"/>
    <a:ext cx="${tableWidth}" cy="${tableHeight}"/>
  </p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
      <a:tbl>
        <a:tblPr firstRow="1" bandRow="1">
          <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>
        </a:tblPr>
        <a:tblGrid>
          ${gridCols}
        </a:tblGrid>
        ${tableRows}
      </a:tbl>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>`;

  // Create complete slide XML
  const slideXml = `
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <!-- Title Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="457200"/>
            <a:ext cx="8229600" cy="1371600"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr rtlCol="0" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="3600" b="1">
                <a:latin typeface="+mn-lt"/>
                <a:ea typeface="+mn-ea"/>
                <a:cs typeface="+mn-cs"/>
              </a:rPr>
              <a:t>${escapeXml(title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Table -->
      ${tableXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

  return slideXml;
}

function createGridContentSlide(title: string, contentSections: string[], slideNum: number): string {
  console.log(`      Creating grid content slide on Slide ${slideNum}`);
  
  // Generate the grid XML
  const gridXml = generateGridXml(contentSections, slideNum);
  
  // Create complete slide XML
  const slideXml = `
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <!-- Title Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="457200"/>
            <a:ext cx="8229600" cy="1371600"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr rtlCol="0" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="3600" b="1">
                <a:latin typeface="+mn-lt"/>
                <a:ea typeface="+mn-ea"/>
                <a:cs typeface="+mn-cs"/>
              </a:rPr>
              <a:t>${escapeXml(title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Grid Content Boxes -->
      ${gridXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

  return slideXml;
}

function createTimelineSlide(title: string, timelineData: TimelineData, slideNum: number): string {
  console.log(`      Creating timeline on Slide ${slideNum}`);
  
  // Generate the timeline XML
  const timelineXml = generateTimelineXml(timelineData, slideNum);
  
  // Create complete slide XML
  const slideXml = `
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <!-- Title Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="457200"/>
            <a:ext cx="8229600" cy="1371600"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr rtlCol="0" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="3600" b="1">
                <a:latin typeface="+mn-lt"/>
                <a:ea typeface="+mn-ea"/>
                <a:cs typeface="+mn-cs"/>
              </a:rPr>
              <a:t>${escapeXml(title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Timeline -->
      ${timelineXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

  return slideXml;
}

// New Image Slide Function
async function createImageSlide(title: string, imagePrompt: string, contentSections: string[], slideNum: number, zip: JSZip): Promise<string> {
  console.log(`      Creating image slide on Slide ${slideNum}`);

  // Generate image buffer using OpenAI (memory-only)
  const imageBuffer = await generateImageWithOpenAI(imagePrompt, 6000000, 4000000);

  // Add image to ZIP
  const imageName = `image_slide${slideNum}.png`;
  const imageRelId = `rId${slideNum + 100}`;
  const imageTarget = `../media/${imageName}`;

  // Add image buffer directly to media folder (no disk I/O)
  zip.file(`ppt/media/${imageName}`, imageBuffer);
  
  // Generate the image XML
  const imageXml = generateImageXml(slideNum, imageRelId, imageTarget);
  
  // Generate content XML if there are content sections
  let contentXml = '';
  if (contentSections && contentSections.length > 0) {
    contentXml = generateImageContentXml(contentSections, slideNum);
  }
  
  // Create complete slide XML
  const slideXml = `
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <!-- Title Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="457200"/>
            <a:ext cx="8229600" cy="1371600"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr rtlCol="0" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="3600" b="1">
                <a:latin typeface="+mn-lt"/>
                <a:ea typeface="+mn-ea"/>
                <a:cs typeface="+mn-cs"/>
              </a:rPr>
              <a:t>${escapeXml(title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Image -->
      ${imageXml}
      <!-- Content (if any) -->
      ${contentXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

  // Update slide relationships
  await updateSlideRelationships(zip, slideNum, imageRelId, imageTarget);

  return slideXml;
}

// Fallback function for when image generation fails
function createContentSlideWithImagePlaceholder(title: string, contentSections: string[], slideNum: number): string {
  console.log(`      Creating content slide with image placeholder on Slide ${slideNum}`);
  
  let contentXml = '';
  if (contentSections && contentSections.length > 0) {
    const content = contentSections
      .map((item, idx) => `• ${item}`)
      .join('\n');
    
    contentXml = `
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${slideNum + 10}" name="Content ${slideNum}"/>
    <p:cNvSpPr>
      <a:spLocks noGrp="1"/>
    </p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="457200" y="2000000"/>
      <a:ext cx="8229600" cy="4000000"/>
    </a:xfrm>
    <a:prstGeom prst="rect">
      <a:avLst/>
    </a:prstGeom>
    <a:noFill/>
    <a:ln w="0">
      <a:noFill/>
    </a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" lIns="91440" tIns="91440" rIns="91440" bIns="91440" rtlCol="0">
      <a:spAutoFit/>
    </a:bodyPr>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r>
        <a:rPr lang="en-US" sz="1800">
          <a:latin typeface="Barlow"/>
          <a:cs typeface="Barlow"/>
        </a:rPr>
        <a:t>${escapeXml(content)}</a:t>
      </a:r>
    </a:p>
  </p:txBody>
</p:sp>`;
  }

  return `
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <!-- Title Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="457200"/>
            <a:ext cx="8229600" cy="1371600"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr rtlCol="0" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="3600" b="1">
                <a:latin typeface="+mn-lt"/>
                <a:ea typeface="+mn-ea"/>
                <a:cs typeface="+mn-cs"/>
              </a:rPr>
              <a:t>${escapeXml(title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Content -->
      ${contentXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;
}

function generateImageXml(slideNum: number, relId: string, imageTarget: string): string {
  return `
<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="${slideNum + 10}" name="Generated Image ${slideNum}" descr="AI Generated Image"/>
    <p:cNvPicPr>
      <a:picLocks noGrp="1" noChangeAspect="1"/>
    </p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="${relId}">
      <a:extLst>
        <a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">
          <a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/>
        </a:ext>
      </a:extLst>
    </a:blip>
    <a:stretch>
      <a:fillRect/>
    </a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm>
      <a:off x="1500000" y="2000000"/>
      <a:ext cx="6000000" cy="4000000"/>
    </a:xfrm>
    <a:prstGeom prst="rect">
      <a:avLst/>
    </a:prstGeom>
    <a:ln w="9525">
      <a:solidFill>
        <a:schemeClr val="accent1"/>
      </a:solidFill>
    </a:ln>
  </p:spPr>
</p:pic>`;
}

function generateImageContentXml(contentSections: string[], slideNum: number): string {
  const content = contentSections
    .map((item, idx) => `• ${item}`)
    .join('\n');

  return `
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${slideNum + 20}" name="Content ${slideNum}"/>
    <p:cNvSpPr>
      <a:spLocks noGrp="1"/>
    </p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="7700000" y="2000000"/>
      <a:ext cx="3000000" cy="4000000"/>
    </a:xfrm>
    <a:prstGeom prst="rect">
      <a:avLst/>
    </a:prstGeom>
    <a:noFill/>
    <a:ln w="0">
      <a:noFill/>
    </a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" lIns="91440" tIns="91440" rIns="91440" bIns="91440" rtlCol="0">
      <a:spAutoFit/>
    </a:bodyPr>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r>
        <a:rPr lang="en-US" sz="1400">
          <a:latin typeface="Barlow"/>
          <a:cs typeface="Barlow"/>
        </a:rPr>
        <a:t>${escapeXml(content)}</a:t>
      </a:r>
    </a:p>
  </p:txBody>
</p:sp>`;
}

async function updateSlideRelationships(zip: JSZip, slideNum: number, relId: string, imageTarget: string): Promise<void> {
  const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
  
  let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${imageTarget}"/>
</Relationships>`;

  zip.file(relsPath, relsXml);
}

function generateGridXml(contentSections: string[], slideNum: number): string {
  console.log(`      Creating 4-grid layout with ${contentSections.length} content sections`);
  
  // Ensure we have exactly 4 content sections (fill with empty strings if needed)
  const sections = [...contentSections];
  while (sections.length < 4) {
    sections.push('');
  }

  const gridWidth = 8000000;
  const gridHeight = 4000000;
  const startX = 1500000;
  const startY = 2000000;
  
  const boxWidth = Math.floor(gridWidth / 2) - 200000;
  const boxHeight = Math.floor(gridHeight / 2) - 200000;
  
  const gridBoxes = [
    // Top Left Box
    {
      x: startX,
      y: startY,
      content: sections[0] || 'Content 1'
    },
    // Top Right Box
    {
      x: startX + boxWidth + 400000,
      y: startY,
      content: sections[1] || 'Content 2'
    },
    // Bottom Left Box
    {
      x: startX,
      y: startY + boxHeight + 400000,
      content: sections[2] || 'Content 3'
    },
    // Bottom Right Box
    {
      x: startX + boxWidth + 400000,
      y: startY + boxHeight + 400000,
      content: sections[3] || 'Content 4'
    }
  ];

  let gridXml = '';
  
  gridBoxes.forEach((box, index) => {
    gridXml += generateGridBox(box.content, box.x, box.y, boxWidth, boxHeight, slideNum, index + 1);
  });

  return gridXml;
}

function generateTimelineXml(timelineData: TimelineData, slideNum: number): string {
  const { phases } = timelineData;
  console.log(`      Timeline: ${phases.length} phases`);

  // Calculate dynamic sizing based on number of phases
  const slideWidth = 9144000; // Total available width
  const startX = 400000; // Start even closer to edge for maximum space
  const startY = 2000000;
  const spacing = 150000; // Further reduced spacing between phases for more box width

  // Dynamic phase width based on number of phases
  let phaseWidth: number;
  let phaseHeight: number;

  if (phases.length <= 2) {
    phaseWidth = 4500000; // Much wider boxes for fewer phases
    phaseHeight = 2600000; // Taller boxes
  } else if (phases.length === 3) {
    phaseWidth = 2800000; // Reduced width for 3 boxes
    phaseHeight = 2400000;
  } else if (phases.length === 4) {
    phaseWidth = 2200000; // Reduced width for 4 boxes
    phaseHeight = 2200000;
  } else {
    // For 5+ phases, fit them all with reduced spacing (no change)
    phaseWidth = Math.floor((slideWidth - startX - (phases.length * spacing)) / phases.length);
    phaseHeight = 2000000;
  }

  console.log(`      Phase boxes: ${phaseWidth/914400}x${phaseHeight/914400} inches for ${phases.length} phases`);
  
  let timelineXml = '';
  
  phases.forEach((phase, index) => {
    const phaseX = startX + (index * (phaseWidth + spacing));
    timelineXml += generateTimelinePhase(phase, phaseX, startY, phaseWidth, phaseHeight, slideNum, index + 1);
  });

  // Add connecting lines between phases
  for (let i = 0; i < phases.length - 1; i++) {
    const lineStartX = startX + ((i + 1) * (phaseWidth + spacing)) - spacing;
    const lineEndX = startX + ((i + 1) * (phaseWidth + spacing));
    const lineY = startY + (phaseHeight / 2);
    
    timelineXml += generateConnectingLine(lineStartX, lineY, lineEndX, lineY, slideNum, i + 1);
  }

  return timelineXml;
}

function generateGridBox(content: string, x: number, y: number, width: number, height: number, slideNum: number, boxNum: number): string {
  const boxId = 10 + slideNum + boxNum;
  
  return `
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${boxId}" name="Grid Box ${boxNum}"/>
    <p:cNvSpPr>
      <a:spLocks noGrp="1"/>
    </p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="${x}" y="${y}"/>
      <a:ext cx="${width}" cy="${height}"/>
    </a:xfrm>
    <a:prstGeom prst="rect">
      <a:avLst/>
    </a:prstGeom>
    <a:solidFill>
      <a:schemeClr val="accent1">
        <a:lumMod val="90000"/>
        <a:lumOff val="10000"/>
      </a:schemeClr>
    </a:solidFill>
    <a:ln w="9525">
      <a:solidFill>
        <a:schemeClr val="accent1">
          <a:lumMod val="75000"/>
        </a:schemeClr>
      </a:solidFill>
    </a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" lIns="91440" tIns="91440" rIns="91440" bIns="91440" anchor="ctr" rtlCol="0">
      <a:spAutoFit/>
    </a:bodyPr>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="ctr"/>
      <a:r>
        <a:rPr lang="en-US" sz="1800" b="0">
          <a:latin typeface="Barlow"/>
          <a:cs typeface="Barlow"/>
        </a:rPr>
        <a:t>${escapeXml(content)}</a:t>
      </a:r>
      <a:endParaRPr lang="en-US"/>
    </a:p>
  </p:txBody>
</p:sp>`;
}

function generateTimelinePhase(phase: TimelinePhase, x: number, y: number, width: number, height: number, slideNum: number, phaseNum: number): string {
  const phaseId = 20 + slideNum + phaseNum;

  // Dynamic font sizing based on box dimensions
  const boxSizeInInches = width / 914400;
  let titleSize: number;
  let durationSize: number;
  let taskSize: number;

  if (boxSizeInInches >= 3.5) {
    titleSize = 1800; // 18pt
    durationSize = 1400; // 14pt
    taskSize = 1200; // 12pt
  } else if (boxSizeInInches >= 2.5) {
    titleSize = 1600; // 16pt
    durationSize = 1300; // 13pt
    taskSize = 1100; // 11pt
  } else {
    titleSize = 1400; // 14pt
    durationSize = 1200; // 12pt
    taskSize = 1000; // 10pt
  }

  // Create separate paragraphs for each task
  const taskParagraphs = phase.tasks.map(task => {
    // Truncate long tasks
    const maxLength = boxSizeInInches >= 3 ? 60 : 40;
    const truncatedTask = task.length > maxLength ? task.substring(0, maxLength - 3) + '...' : task;

    return `
    <a:p>
      <a:pPr marL="228600" indent="-228600" algn="l">
        <a:lnSpc>
          <a:spcPct val="95000"/>
        </a:lnSpc>
      </a:pPr>
      <a:r>
        <a:rPr lang="en-US" sz="${taskSize}">
          <a:latin typeface="Barlow"/>
          <a:cs typeface="Barlow"/>
        </a:rPr>
        <a:t>• ${escapeXml(truncatedTask)}</a:t>
      </a:r>
    </a:p>`;
  }).join('');

  return `
<!-- Phase ${phaseNum} -->
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${phaseId}" name="Phase ${phaseNum}"/>
    <p:cNvSpPr>
      <a:spLocks noGrp="1"/>
    </p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="${x}" y="${y}"/>
      <a:ext cx="${width}" cy="${height}"/>
    </a:xfrm>
    <a:prstGeom prst="roundRect">
      <a:avLst/>
    </a:prstGeom>
    <a:solidFill>
      <a:schemeClr val="accent${phaseNum}">
        <a:lumMod val="80000"/>
        <a:lumOff val="10000"/>
      </a:schemeClr>
    </a:solidFill>
    <a:ln w="12700">
      <a:solidFill>
        <a:schemeClr val="accent${phaseNum}">
          <a:lumMod val="60000"/>
        </a:schemeClr>
      </a:solidFill>
    </a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" lIns="127000" tIns="127000" rIns="127000" bIns="127000" rtlCol="0" anchor="t">
      <a:normAutofit fontScale="95000" lnSpcReduction="10000"/>
    </a:bodyPr>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l">
        <a:lnSpc>
          <a:spcPct val="100000"/>
        </a:lnSpc>
      </a:pPr>
      <a:r>
        <a:rPr lang="en-US" sz="${titleSize}" b="1">
          <a:latin typeface="Barlow"/>
          <a:cs typeface="Barlow"/>
        </a:rPr>
        <a:t>${escapeXml(phase.name)}</a:t>
      </a:r>
    </a:p>
    <a:p>
      <a:pPr algn="l">
        <a:lnSpc>
          <a:spcPct val="100000"/>
        </a:lnSpc>
        <a:spcBef>
          <a:spcPts val="600"/>
        </a:spcBef>
      </a:pPr>
      <a:r>
        <a:rPr lang="en-US" sz="${durationSize}" b="1">
          <a:latin typeface="Barlow"/>
          <a:cs typeface="Barlow"/>
          <a:solidFill>
            <a:schemeClr val="accent${phaseNum}">
              <a:lumMod val="40000"/>
            </a:schemeClr>
          </a:solidFill>
        </a:rPr>
        <a:t>${escapeXml(phase.duration)}</a:t>
      </a:r>
    </a:p>
    <a:p>
      <a:pPr>
        <a:spcBef>
          <a:spcPts val="400"/>
        </a:spcBef>
      </a:pPr>
    </a:p>
    ${taskParagraphs}
  </p:txBody>
</p:sp>`;
}

function generateConnectingLine(startX: number, startY: number, endX: number, endY: number, slideNum: number, lineNum: number): string {
  const lineId = 50 + slideNum + lineNum;
  const width = endX - startX;
  
  return `
<!-- Connecting Line ${lineNum} -->
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${lineId}" name="Connector ${lineNum}"/>
    <p:cNvSpPr>
      <a:spLocks noGrp="1"/>
    </p:cNvSpPr>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="${startX}" y="${startY}"/>
      <a:ext cx="${width}" cy="0"/>
    </a:xfrm>
    <a:prstGeom prst="line">
      <a:avLst/>
    </a:prstGeom>
    <a:ln w="4762">
      <a:solidFill>
        <a:schemeClr val="accent1">
          <a:lumMod val="50000"/>
        </a:schemeClr>
      </a:solidFill>
      <a:headEnd type="triangle"/>
      <a:tailEnd type="triangle"/>
    </a:ln>
  </p:spPr>
</p:sp>`;
}

function generateTableRow(cells: string[], rowIndex: number, rowHeight: number, isHeader: boolean, rowType: string): string {
  const cellXml = cells.map((cell, cellIndex) => 
    generateTableCell(cell, rowIndex, cellIndex, isHeader, rowType)
  ).join('');

  return `
  <a:tr h="${rowHeight}">
    ${cellXml}
  </a:tr>`;
}

function generateTableCell(content: string, rowIndex: number, cellIndex: number, isHeader: boolean, rowType: string): string {
  const fontSize = isHeader ? '2000' : '1800';
  const fontWeight = isHeader ? 'b="1"' : '';
  const alignment = isHeader ? ' anchor="ctr"' : '';
  const textAlignment = isHeader ? ' algn="ctr"' : '';

  return `
    <a:tc>
      <a:txBody>
        <a:bodyPr rtlCol="0"${alignment}/>
        <a:lstStyle/>
        <a:p>
          <a:pPr${textAlignment}/>
          <a:r>
            <a:rPr ${fontWeight} sz="${fontSize}" lang="en-US">
              <a:latin typeface="Barlow"/>
              <a:cs typeface="Barlow"/>
            </a:rPr>
            <a:t>${escapeXml(content)}</a:t>
          </a:r>
          <a:endParaRPr lang="en-US"/>
        </a:p>
      </a:txBody>
      <a:tcPr/>
    </a:tc>`;
}

async function updatePresentationXml(zip: JSZip, slideProcessingOrder: number[]) {
  const presFile = zip.file('ppt/presentation.xml');
  if (!presFile) return;

  try {
    const presXml = await presFile.async('string');
    const presData: any = await parseXml(presXml);

    // Get existing slides
    const slideIdList = presData['p:presentation']['p:sldIdLst']?.[0]['p:sldId'] || [];

    // Create a map of slide number to slide object
    const slideMap = new Map<number, any>();
    slideIdList.forEach((slide: any, index: number) => {
      const slideNum = index + 1;
      slideMap.set(slideNum, slide);
    });

    // Reorder slides based on the processing order
    const reorderedSlides = slideProcessingOrder
      .map((slideNum: number) => slideMap.get(slideNum))
      .filter((slide: any) => slide !== undefined);

    // Update the slide list with reordered slides
    presData['p:presentation']['p:sldIdLst'][0]['p:sldId'] = reorderedSlides;

    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true }
    });
    const updatedPresXml = builder.buildObject(presData);

    zip.file('ppt/presentation.xml', updatedPresXml);
    console.log(`      ✅ Updated presentation.xml with ${reorderedSlides.length} slides in correct order`);
  } catch (error) {
    console.log('      ❌ Error updating presentation.xml:', error);
  }
}

function applyFontStyling(slideXml: string): string {
  let titleStyled = false;
  
  return slideXml.replace(
    /<a:r>(<a:t>[^<]+<\/a:t>)/g,
    (match, textTag) => {
      if (!titleStyled) {
        titleStyled = true;
        return `<a:r><a:rPr lang="en-US" sz="3600" dirty="0"><a:latin typeface="Barlow"/></a:rPr>${textTag}`;
      }
      return `<a:r><a:rPr lang="en-US" sz="1800" dirty="0"><a:latin typeface="Barlow"/></a:rPr>${textTag}`;
    }
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// NEW FUNCTION: Create title slide
function createTitleSlide(title: string, subtitle: string, slideNum: number): string {
  console.log(`      Creating title slide on Slide ${slideNum}`);

  const slideXml = `
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <!-- Title Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="ctrTitle"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="1600000"/>
            <a:ext cx="8229600" cy="2000000"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr rtlCol="0" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="4800" b="1">
                <a:latin typeface="Barlow"/>
                <a:cs typeface="Barlow"/>
              </a:rPr>
              <a:t>${escapeXml(title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Subtitle Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Subtitle ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="subTitle" idx="1"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="3800000"/>
            <a:ext cx="8229600" cy="1200000"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr rtlCol="0" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="2400">
                <a:latin typeface="Barlow"/>
                <a:cs typeface="Barlow"/>
              </a:rPr>
              <a:t>${escapeXml(subtitle)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

  return slideXml;
}

// NEW FUNCTION: Create agenda slide with dynamic font sizing
function createAgendaSlide(agendaItems: string[], slideNum: number): string {
  console.log(`      Creating agenda slide on Slide ${slideNum} with ${agendaItems.length} items`);

  // Dynamic font size based on number of items
  // Slide content area: 4000000 EMUs (approx 4.4 inches)
  // Each line needs space for text + line spacing
  let fontSize: number;
  let lineSpacing: number;

  if (agendaItems.length <= 5) {
    fontSize = 2400; // 24pt
    lineSpacing = 120; // 120% spacing
  } else if (agendaItems.length <= 8) {
    fontSize = 2000; // 20pt
    lineSpacing = 110; // 110% spacing
  } else if (agendaItems.length <= 12) {
    fontSize = 1800; // 18pt
    lineSpacing = 105; // 105% spacing
  } else if (agendaItems.length <= 15) {
    fontSize = 1600; // 16pt
    lineSpacing = 100; // 100% spacing
  } else {
    fontSize = 1400; // 14pt for many items
    lineSpacing = 95; // 95% spacing
  }

  console.log(`      Agenda font size: ${fontSize/100}pt for ${agendaItems.length} items`);

  // Create paragraphs for each agenda item (better spacing control)
  const agendaParagraphs = agendaItems
    .map((item, index) => {
      const truncatedItem = item.length > 80 ? item.substring(0, 77) + '...' : item;
      return `
          <a:p>
            <a:pPr marL="228600" indent="-228600" algn="l">
              <a:lnSpc>
                <a:spcPct val="${lineSpacing * 1000}"/>
              </a:lnSpc>
            </a:pPr>
            <a:r>
              <a:rPr lang="en-US" sz="${fontSize}">
                <a:latin typeface="Barlow"/>
                <a:cs typeface="Barlow"/>
              </a:rPr>
              <a:t>${index + 1}. ${escapeXml(truncatedItem)}</a:t>
            </a:r>
          </a:p>`;
    })
    .join('');

  const slideXml = `
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <!-- Title Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="457200"/>
            <a:ext cx="8229600" cy="1200000"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr rtlCol="0" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="3600" b="1">
                <a:latin typeface="Barlow"/>
                <a:cs typeface="Barlow"/>
              </a:rPr>
              <a:t>Agenda</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Content Shape with dynamic sizing -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="1800000"/>
            <a:ext cx="8229600" cy="4500000"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="none" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="t">
            <a:normAutofit fontScale="100000" lnSpcReduction="0"/>
          </a:bodyPr>
          <a:lstStyle/>
          ${agendaParagraphs}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

  return slideXml;
}

// NEW FUNCTION: Create thank you slide
function createThankYouSlide(slideNum: number, companyName?: string): string {
  console.log(`      Creating thank you slide on Slide ${slideNum}`);

  const subtitle = companyName ? `Thank you, ${companyName}!` : 'Thank You!';
  const message = 'We look forward to partnering with you.';

  const slideXml = `
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <!-- Main Title Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="ctrTitle"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="2000000"/>
            <a:ext cx="8229600" cy="1500000"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr rtlCol="0" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="5400" b="1">
                <a:latin typeface="Barlow"/>
                <a:cs typeface="Barlow"/>
              </a:rPr>
              <a:t>${escapeXml(subtitle)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Subtitle/Message Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Subtitle ${slideNum}"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="subTitle" idx="1"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="3700000"/>
            <a:ext cx="8229600" cy="800000"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
          <a:ln w="0">
            <a:noFill/>
          </a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr rtlCol="0" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="2400">
                <a:latin typeface="Barlow"/>
                <a:cs typeface="Barlow"/>
              </a:rPr>
              <a:t>${escapeXml(message)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

  return slideXml;
}

// Function to add speaker notes to a slide
async function addSpeakerNotes(zip: JSZip, slideNumber: number, speakerNotes: string): Promise<void> {
  const notesPath = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
  const notesRelsPath = `ppt/notesSlides/_rels/notesSlide${slideNumber}.xml.rels`;

  // Check if notes slide already exists
  let notesXml: string;
  const existingNotes = zip.file(notesPath);

  if (existingNotes) {
    // Update existing notes slide
    notesXml = await existingNotes.async('string');

    // Parse and update the notes content
    const parsed: any = await parseXml(notesXml);

    // Find the notes text body
    if (parsed['p:notes'] && parsed['p:notes']['p:cSld'] && parsed['p:notes']['p:cSld'][0]['p:spTree'] && parsed['p:notes']['p:cSld'][0]['p:spTree'][0]['p:sp']) {
      const shapes = parsed['p:notes']['p:cSld'][0]['p:spTree'][0]['p:sp'];

      // Find the notes body shape (usually the second shape, idx=1)
      for (const shape of shapes) {
        if (shape['p:nvSpPr'] && shape['p:nvSpPr'][0]['p:nvPr'] && shape['p:nvSpPr'][0]['p:nvPr'][0]['p:ph'] && shape['p:nvSpPr'][0]['p:nvPr'][0]['p:ph'][0]['$'] && shape['p:nvSpPr'][0]['p:nvPr'][0]['p:ph'][0]['$'].type === 'body') {
          // Update the text body with speaker notes
          shape['p:txBody'][0]['a:p'] = [{
            'a:r': [{
              'a:rPr': [{ '$': { lang: 'en-US', sz: '1200', dirty: '0' } }],
              'a:t': [speakerNotes]
            }]
          }];
          break;
        }
      }
    }

    const builder = new Builder();
    notesXml = builder.buildObject(parsed);
  } else {
    // Create new notes slide
    notesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Slide Image Placeholder 1"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="sldreplacement"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Notes Placeholder 2"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="body" idx="1"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1200" dirty="0"/>
              <a:t>${speakerNotes}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:notes>`;

    // Create notes relationship file if it doesn't exist
    const notesRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${slideNumber}.xml"/>
</Relationships>`;

    zip.file(notesRelsPath, notesRels);
  }

  // Save the notes slide
  zip.file(notesPath, notesXml);

  // Update [Content_Types].xml to include this specific notes slide
  const contentTypesPath = '[Content_Types].xml';
  const contentTypesFile = zip.file(contentTypesPath);

  if (contentTypesFile) {
    let contentTypesXml = await contentTypesFile.async('string');
    const parsed: any = await parseXml(contentTypesXml);

    const overrides = parsed.Types.Override || [];

    // Add this specific notes slide if not exists
    const notesSlidePartName = `/ppt/notesSlides/notesSlide${slideNumber}.xml`;
    const hasNotesSlide = overrides.some((override: any) =>
      override.$.PartName === notesSlidePartName
    );

    if (!hasNotesSlide) {
      overrides.push({
        $: {
          PartName: notesSlidePartName,
          ContentType: 'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml'
        }
      });

      parsed.Types.Override = overrides;

      const builder = new Builder();
      contentTypesXml = builder.buildObject(parsed);
      zip.file(contentTypesPath, contentTypesXml);
    }
  }

  // Update the slide's relationship to include notes
  const slideRelsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
  const slideRels = zip.file(slideRelsPath);

  if (slideRels) {
    let relsXml = await slideRels.async('string');
    const relsParsed: any = await parseXml(relsXml);

    // Check if notes relationship already exists
    const relationships = relsParsed.Relationships.Relationship;
    const hasNotesRel = relationships.some((rel: any) =>
      rel.$.Type === "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"
    );

    if (!hasNotesRel) {
      // Find the highest rId
      let maxId = 0;
      relationships.forEach((rel: any) => {
        const id = parseInt(rel.$.Id.replace('rId', ''));
        if (id > maxId) maxId = id;
      });

      // Add notes relationship
      relationships.push({
        $: {
          Id: `rId${maxId + 1}`,
          Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide",
          Target: `../notesSlides/notesSlide${slideNumber}.xml`
        }
      });

      const builder = new Builder();
      relsXml = builder.buildObject(relsParsed);
      zip.file(slideRelsPath, relsXml);
    }
  }
}

// Function to ensure notes master exists in the presentation
async function ensureNotesMaster(zip: JSZip): Promise<void> {
  const notesMasterPath = 'ppt/notesMasters/notesMaster1.xml';
  const notesMasterRelsPath = 'ppt/notesMasters/_rels/notesMaster1.xml.rels';

  // Check if notes master already exists
  if (!zip.file(notesMasterPath)) {
    // Create notes master
    const notesMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Header Placeholder 1"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="hdr"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p/>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Date Placeholder 2"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="dt" idx="1"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p/>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="4" name="Slide Image Placeholder 3"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="sldImg" idx="2"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="5" name="Notes Placeholder 4"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="body" idx="3"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr>
              <a:defRPr sz="1200"/>
            </a:pPr>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="6" name="Footer Placeholder 5"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="ftr" idx="4"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p/>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="7" name="Slide Number Placeholder 6"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="sldNum" idx="5"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p/>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
</p:notesMaster>`;

    zip.file(notesMasterPath, notesMasterXml);

    // Create notes master relationships
    const notesMasterRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;

    zip.file(notesMasterRelsPath, notesMasterRels);
  }

  // Update [Content_Types].xml to include notes slide types
  const contentTypesPath = '[Content_Types].xml';
  const contentTypesFile = zip.file(contentTypesPath);

  if (contentTypesFile) {
    let contentTypesXml = await contentTypesFile.async('string');
    const parsed: any = await parseXml(contentTypesXml);

    const overrides = parsed.Types.Override || [];

    // Add notesMaster if not exists
    const hasNotesMaster = overrides.some((override: any) =>
      override.$.PartName === '/ppt/notesMasters/notesMaster1.xml'
    );

    if (!hasNotesMaster) {
      overrides.push({
        $: {
          PartName: '/ppt/notesMasters/notesMaster1.xml',
          ContentType: 'application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml'
        }
      });
    }

    parsed.Types.Override = overrides;

    const builder = new Builder();
    contentTypesXml = builder.buildObject(parsed);
    zip.file(contentTypesPath, contentTypesXml);
  }

  // Update presentation.xml.rels to include notes master reference
  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  const presRels = zip.file(presRelsPath);

  if (presRels) {
    let relsXml = await presRels.async('string');
    const relsParsed: any = await parseXml(relsXml);

    const relationships = relsParsed.Relationships.Relationship;
    const hasNotesMasterRel = relationships.some((rel: any) =>
      rel.$.Type === "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster"
    );

    if (!hasNotesMasterRel) {
      // Find the highest rId
      let maxId = 0;
      relationships.forEach((rel: any) => {
        const id = parseInt(rel.$.Id.replace('rId', ''));
        if (id > maxId) maxId = id;
      });

      relationships.push({
        $: {
          Id: `rId${maxId + 1}`,
          Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster",
          Target: "notesMasters/notesMaster1.xml"
        }
      });

      const builder = new Builder();
      relsXml = builder.buildObject(relsParsed);
      zip.file(presRelsPath, relsXml);
    }
  }
}

// Export function to generate PPTX buffer from presentation data (memory-only)
export async function generatePPTXBuffer(
  presentationData: any,
  templatePath: string
): Promise<Buffer> {
  console.log('🎨 PowerPoint Generator - Dynamic Template Analysis (Memory Mode)\n');

  // Use the presentation data passed in instead of reading from file
  const config: PresentationConfig = {
    presentation_metadata: presentationData.presentation_metadata,
    client_context: presentationData.client_context,
    slides: presentationData.slides || []
  };

  const presentationTitle = getPresentationTitle(config);
  console.log(`📊 Presentation: ${presentationTitle}`);
  console.log(`📄 Config Slides: ${config.slides.length}\n`);

  // Read template
  console.log(`📂 Reading template: ${templatePath}`);
  const templateData = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateData);

  // Ensure notes master exists for speaker notes
  await ensureNotesMaster(zip);

  // DYNAMIC: Analyze template structure
  const templateAnalysis = await analyzeTemplate(zip);

  // Create slide pool indices for each category
  let contentOnlyIndex = 0;
  let textAndImageIndex = 0;
  let imageOnlyIndex = 0;
  let complexIndex = 0;
  let emptyIndex = 0;

  const usedSlides: number[] = [];
  const slideProcessingOrder: number[] = [];

  // Fill slides - DYNAMIC MAPPING
  console.log(`✏️  FILLING SLIDES WITH CONTENT:\n`);

  // STEP 1: Create Title Slide
  let titleSlideNum: number;
  if (emptyIndex < templateAnalysis.emptySlides.length) {
    titleSlideNum = templateAnalysis.emptySlides[emptyIndex++];
  } else if (contentOnlyIndex < templateAnalysis.contentOnlySlides.length) {
    titleSlideNum = templateAnalysis.contentOnlySlides[contentOnlyIndex++];
  } else {
    console.log(`   ⚠️  No suitable slide for title. Skipping title slide.`);
    titleSlideNum = -1;
  }

  if (titleSlideNum !== -1) {
    console.log(`   📋 CREATING Title Slide ${titleSlideNum}: ${presentationTitle}`);
    const companyName = config.client_context?.company || 'Valued Partner';
    const subtitle = `Presented for ${companyName}`;
    const titleSlideXml = createTitleSlide(presentationTitle, subtitle, titleSlideNum);
    const titleSlidePath = `ppt/slides/slide${titleSlideNum}.xml`;
    zip.file(titleSlidePath, applyFontStyling(titleSlideXml));

    usedSlides.push(titleSlideNum);
    slideProcessingOrder.push(titleSlideNum);
  }

  // STEP 2: Create Agenda Slide
  let agendaSlideNum: number;
  if (emptyIndex < templateAnalysis.emptySlides.length) {
    agendaSlideNum = templateAnalysis.emptySlides[emptyIndex++];
  } else if (contentOnlyIndex < templateAnalysis.contentOnlySlides.length) {
    agendaSlideNum = templateAnalysis.contentOnlySlides[contentOnlyIndex++];
  } else {
    console.log(`   ⚠️  No suitable slide for agenda. Skipping agenda slide.`);
    agendaSlideNum = -1;
  }

  if (agendaSlideNum !== -1) {
    console.log(`   📋 CREATING Agenda Slide ${agendaSlideNum}`);
    const agendaItems = config.slides.map(s => s.slide_title);
    const agendaSlideXml = createAgendaSlide(agendaItems, agendaSlideNum);
    const agendaSlidePath = `ppt/slides/slide${agendaSlideNum}.xml`;
    zip.file(agendaSlidePath, applyFontStyling(agendaSlideXml));

    usedSlides.push(agendaSlideNum);
    slideProcessingOrder.push(agendaSlideNum);
  }

  // STEP 3: Process all content slides from config
  for (let i = 0; i < config.slides.length; i++) {
    const slideConfig = config.slides[i];
    let targetSlideNumber: number;
    let targetSlidePath: string;
    let slideXml: string = '';

    // Get slide type and data using helper functions
    const slideType = getSlideType(slideConfig);
    const tableData = getTableData(slideConfig);
    const timelineData = getTimelineData(slideConfig);
    const imagePrompt = getImagePrompt(slideConfig);

    // DYNAMIC DECISION TREE: Choose the right template slide based on content type and available slides

    // 1. TABLE SLIDES -> Use complex slides (if available) or create from scratch
    if (slideType === 'table' && tableData) {
      // Prefer complex slides for tables
      if (complexIndex < templateAnalysis.complexSlides.length) {
        targetSlideNumber = templateAnalysis.complexSlides[complexIndex++];
      } else if (emptyIndex < templateAnalysis.emptySlides.length) {
        targetSlideNumber = templateAnalysis.emptySlides[emptyIndex++];
      } else {
        console.log(`   ⚠️  No suitable slides for table. Skipping: ${slideConfig.slide_title}`);
        continue;
      }
      targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
      slideXml = createTableSlide(slideConfig.slide_title, tableData, targetSlideNumber);
    }

    // 2. GRID SLIDES
    else if (slideType === 'grid') {
      if (complexIndex < templateAnalysis.complexSlides.length) {
        targetSlideNumber = templateAnalysis.complexSlides[complexIndex++];
      } else if (emptyIndex < templateAnalysis.emptySlides.length) {
        targetSlideNumber = templateAnalysis.emptySlides[emptyIndex++];
      } else {
        console.log(`   ⚠️  No suitable slides for grid. Skipping: ${slideConfig.slide_title}`);
        continue;
      }
      targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
      slideXml = createGridContentSlide(slideConfig.slide_title, slideConfig.content_sections, targetSlideNumber);
    }

    // 3. TIMELINE SLIDES
    else if (slideType === 'timeline' && timelineData) {
      if (complexIndex < templateAnalysis.complexSlides.length) {
        targetSlideNumber = templateAnalysis.complexSlides[complexIndex++];
      } else if (emptyIndex < templateAnalysis.emptySlides.length) {
        targetSlideNumber = templateAnalysis.emptySlides[emptyIndex++];
      } else {
        console.log(`   ⚠️  No suitable slides for timeline. Skipping: ${slideConfig.slide_title}`);
        continue;
      }
      targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;

      console.log(`   📅 FILLING Slide ${targetSlideNumber}: ${slideConfig.slide_title} (TIMELINE)`);
      slideXml = createTimelineSlide(slideConfig.slide_title, timelineData, targetSlideNumber);
    }

    // 4. IMAGE SLIDES -> Generate image with DALL-E and embed
    else if ((slideType === 'image' || slideType === 'text_and_image') && imagePrompt) {
      // Try template slides with image placeholders first
      if (textAndImageIndex < templateAnalysis.textAndImageSlides.length) {
        targetSlideNumber = templateAnalysis.textAndImageSlides[textAndImageIndex++];
        targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
        const slideFile = zip.file(targetSlidePath);
        if (slideFile) {
          slideXml = await slideFile.async('string');
          slideXml = await processImagePlaceholderSlide(slideXml, slideConfig, targetSlideNumber, zip);
        } else {
          console.log(`   ❌ Slide ${targetSlideNumber} not found in template!`);
          continue;
        }
      } else if (imageOnlyIndex < templateAnalysis.imageOnlySlides.length) {
        targetSlideNumber = templateAnalysis.imageOnlySlides[imageOnlyIndex++];
        targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
        const slideFile = zip.file(targetSlidePath);
        if (slideFile) {
          slideXml = await slideFile.async('string');
          slideXml = await processImagePlaceholderSlide(slideXml, slideConfig, targetSlideNumber, zip);
        } else {
          console.log(`   ❌ Slide ${targetSlideNumber} not found in template!`);
          continue;
        }
      } else if (emptyIndex < templateAnalysis.emptySlides.length) {
        targetSlideNumber = templateAnalysis.emptySlides[emptyIndex++];
        targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
        console.log(`   🖼️ CREATING Image Slide ${targetSlideNumber}: ${slideConfig.slide_title}`);
        slideXml = await createImageSlide(slideConfig.slide_title, imagePrompt, slideConfig.content_sections, targetSlideNumber, zip);
      } else if (contentOnlyIndex < templateAnalysis.contentOnlySlides.length) {
        targetSlideNumber = templateAnalysis.contentOnlySlides[contentOnlyIndex++];
        targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
        console.log(`   🖼️ CREATING Image Slide ${targetSlideNumber}: ${slideConfig.slide_title} (overwriting content slide)`);
        slideXml = await createImageSlide(slideConfig.slide_title, imagePrompt, slideConfig.content_sections, targetSlideNumber, zip);
      } else {
        console.log(`   ⚠️  No suitable slides for image content. Skipping: ${slideConfig.slide_title}`);
        continue;
      }
    }

    // 5. REGULAR CONTENT SLIDES -> Use content_only slides (best match)
    else {
      if (contentOnlyIndex < templateAnalysis.contentOnlySlides.length) {
        targetSlideNumber = templateAnalysis.contentOnlySlides[contentOnlyIndex++];
      } else if (textAndImageIndex < templateAnalysis.textAndImageSlides.length) {
        // Fallback to text_and_image (just won't fill the image)
        targetSlideNumber = templateAnalysis.textAndImageSlides[textAndImageIndex++];
      } else if (emptyIndex < templateAnalysis.emptySlides.length) {
        targetSlideNumber = templateAnalysis.emptySlides[emptyIndex++];
      } else {
        console.log(`   ⚠️  No suitable slides for content. Skipping: ${slideConfig.slide_title}`);
        continue;
      }
      targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;

      console.log(`   📝 FILLING Slide ${targetSlideNumber}: ${slideConfig.slide_title} (REGULAR CONTENT)`);

      const slideFile = zip.file(targetSlidePath);
      if (slideFile) {
        slideXml = await slideFile.async('string');
        slideXml = fillTitleAndContent(slideXml, slideConfig);
      } else {
        console.log(`   ❌ Slide ${targetSlideNumber} not found in template!`);
        continue;
      }
    }

    // Apply styling and save
    slideXml = applyFontStyling(slideXml);
    zip.file(targetSlidePath, slideXml);

    // Add speaker notes if available
    if (slideConfig.speaker_notes) {
      console.log(`   🗣️  Adding speaker notes to Slide ${targetSlideNumber}`);
      await addSpeakerNotes(zip, targetSlideNumber, slideConfig.speaker_notes);
    }

    usedSlides.push(targetSlideNumber);
    slideProcessingOrder.push(targetSlideNumber);
  }

  // STEP 4: Create Thank You Slide
  let thankYouSlideNum: number;
  if (emptyIndex < templateAnalysis.emptySlides.length) {
    thankYouSlideNum = templateAnalysis.emptySlides[emptyIndex++];
  } else if (contentOnlyIndex < templateAnalysis.contentOnlySlides.length) {
    thankYouSlideNum = templateAnalysis.contentOnlySlides[contentOnlyIndex++];
  } else {
    console.log(`   ⚠️  No suitable slide for thank you. Skipping thank you slide.`);
    thankYouSlideNum = -1;
  }

  if (thankYouSlideNum !== -1) {
    console.log(`   📋 CREATING Thank You Slide ${thankYouSlideNum}`);
    const companyName = config.client_context?.company || undefined;
    const thankYouSlideXml = createThankYouSlide(thankYouSlideNum, companyName);
    const thankYouSlidePath = `ppt/slides/slide${thankYouSlideNum}.xml`;
    zip.file(thankYouSlidePath, applyFontStyling(thankYouSlideXml));

    usedSlides.push(thankYouSlideNum);
    slideProcessingOrder.push(thankYouSlideNum);
  }

  // Identify unused slides
  const allTemplateSlides = Array.from(templateAnalysis.slides.keys());
  const unusedSlides = allTemplateSlides.filter(slideNum => !usedSlides.includes(slideNum));

  console.log(`\n📊 SLIDE USAGE SUMMARY:`);
  console.log(`   ✅ USED SLIDES (${usedSlides.length}): ${usedSlides.sort((a, b) => a - b).join(', ')}`);

  // Remove ALL unused slides
  let removedCount = 0;
  for (const slideNum of unusedSlides) {
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const relPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

    if (zip.file(slidePath)) {
      zip.remove(slidePath);
      console.log(`   🗑️  REMOVED: ${slidePath}`);
      removedCount++;
    }
    if (zip.file(relPath)) {
      zip.remove(relPath);
      console.log(`   🗑️  REMOVED: ${relPath}`);
      removedCount++;
    }
  }

  console.log(`🗑️  Removed ${removedCount} unused slide files`);

  // Update presentation.xml to reflect actual slide count and order
  const finalSlideCount = usedSlides.length;
  await updatePresentationXml(zip, slideProcessingOrder);

  // Generate PPTX buffer instead of writing to disk
  console.log(`\n💾 GENERATING POWERPOINT BUFFER...`);

  const pptxBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  console.log(`\n✅ SUCCESS!`);
  console.log(`📊 Final Slide Count: ${finalSlideCount} slides`);
  console.log(`💾 Buffer Size: ${(pptxBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  return pptxBuffer;
}

// Remove auto-execution - this is now a service module
// generatePresentation().catch(console.error);