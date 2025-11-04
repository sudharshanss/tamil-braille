import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir, platform } from 'os';

const execAsync = promisify(exec);

// Detect platform and set appropriate Tesseract paths
const isWindows = platform() === 'win32';
const TESSERACT_EXE_NAME = isWindows ? 'tesseract.exe' : 'tesseract';
const LOCAL_TESSERACT_PATH = join(process.cwd(), 'requirements', 'Tesseract-OCR', TESSERACT_EXE_NAME);
const LOCAL_TESSDATA_PATH = join(process.cwd(), 'requirements', 'Tesseract-OCR', 'tessdata');

// Check if local Tesseract is available
async function checkLocalTesseractAvailable(): Promise<boolean> {
  try {
    await access(LOCAL_TESSERACT_PATH);
    return true;
  } catch {
    return false;
  }
}

// Check if system Tesseract is available (for Linux/Mac)
async function checkSystemTesseractAvailable(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('which tesseract');
    return stdout.trim() || null;
  } catch {
    // Try 'tesseract' directly (might be in PATH)
    try {
      await execAsync('tesseract --version');
      return 'tesseract'; // Command found in PATH
    } catch {
      return null;
    }
  }
}

// Get the appropriate Tesseract path and tessdata directory
async function getTesseractConfig(): Promise<{ tesseractPath: string; tessdataPath: string } | null> {
  // First, try local installation (for Windows or local dev)
  const hasLocalTesseract = await checkLocalTesseractAvailable();
  if (hasLocalTesseract) {
    return {
      tesseractPath: LOCAL_TESSERACT_PATH,
      tessdataPath: LOCAL_TESSDATA_PATH
    };
  }

  // On Linux/Mac/Vercel, try system tesseract
  const systemTesseract = await checkSystemTesseractAvailable();
  if (systemTesseract) {
    // For system tesseract, use default tessdata location
    // Vercel/Linux typically uses /usr/share/tesseract-ocr/5/tessdata
    return {
      tesseractPath: systemTesseract,
      tessdataPath: '/usr/share/tesseract-ocr/5/tessdata' // Common Linux path
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  let tempInputFile: string | null = null;
  let tempOutputFile: string | null = null;

  try {
    // Get Tesseract configuration
    const tesseractConfig = await getTesseractConfig();
    if (!tesseractConfig) {
      return NextResponse.json(
        { 
          error: 'Tesseract OCR is not available',
          details: 'Tesseract executable not found. Please install Tesseract OCR or ensure it is in your system PATH.',
          suggestion: process.env.VERCEL 
            ? 'Tesseract is not available in Vercel serverless functions. The application will automatically fall back to client-side OCR using Tesseract.js.'
            : `For local development, install Tesseract or place it at: ${LOCAL_TESSERACT_PATH}`
        },
        { status: 500 }
      );
    }

    const { tesseractPath, tessdataPath } = tesseractConfig;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create temporary files
    const tempDir = tmpdir();
    const timestamp = Date.now();
    // Respect original file extension if available (helps some decoders)
    const originalName = file.name as string | undefined;
    const extFromName = originalName && originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '.png';
    tempInputFile = join(tempDir, `tesseract_input_${timestamp}${extFromName}`);
    tempOutputFile = join(tempDir, `tesseract_output_${timestamp}`);
    
    // Write buffer to temporary file
    await writeFile(tempInputFile, buffer);
    
    // Run Tesseract OCR with Tamil language support
    // -l tam: Use Tamil language model
    // --tessdata-dir: Specify the directory containing language data (if local, otherwise use system default)
    let tessdataArg = '';
    try {
      await access(tessdataPath);
      tessdataArg = `--tessdata-dir "${tessdataPath}"`;
    } catch {
      // Use system default if tessdata path doesn't exist (common on Linux)
      tessdataArg = '';
    }
    
    // Quote paths for Windows, no quotes for Linux
    const quotedTesseract = isWindows ? `"${tesseractPath}"` : tesseractPath;
    const quotedInput = isWindows ? `"${tempInputFile}"` : tempInputFile;
    const quotedOutput = isWindows ? `"${tempOutputFile}"` : tempOutputFile;
    
    const tesseractCommand = `${quotedTesseract} ${quotedInput} ${quotedOutput} -l tam+eng ${tessdataArg} --psm 6 --oem 1 -c preserve_interword_spaces=1`.trim();
    
    console.log('Running Tesseract OCR...');
    console.log('Command:', tesseractCommand);
    
    let stdout: string, stderr: string;
    try {
      const result = await execAsync(tesseractCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 60000, // 60 second timeout
        env: {
          ...process.env,
          TESSDATA_PREFIX: tessdataPath,
          PATH: process.env.PATH // Ensure PATH is set
        }
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execError: unknown) {
      console.error('Tesseract execution error:', execError);
      const errorMessage = execError instanceof Error ? execError.message : 'Unknown error';
      throw new Error(`Tesseract OCR failed: ${errorMessage}`);
    }
    
    // Tesseract often outputs warnings to stderr even on success
    // Only treat as error if it doesn't contain expected messages
    if (stderr && !stderr.includes('Tesseract Open Source OCR Engine') && !stderr.includes('Estimating resolution')) {
      console.warn('Tesseract warnings:', stderr);
      // If stderr contains "Error" or "failed", it's likely a real error
      if (stderr.toLowerCase().includes('error') || stderr.toLowerCase().includes('failed')) {
        throw new Error(`Tesseract OCR error: ${stderr}`);
      }
    }
    
    // Read the output file (Tesseract adds .txt extension)
    const outputTextFile = `${tempOutputFile}.txt`;
    const fs = await import('fs/promises');
    let extractedText = '';
    
    try {
      extractedText = await fs.readFile(outputTextFile, 'utf-8');
      
      // Clean up output file
      await fs.unlink(outputTextFile).catch(() => {});
    } catch (readError) {
      console.error('Error reading Tesseract output:', readError);
      throw new Error('Failed to read OCR output');
    }
    
    // Extract only the first line to avoid overload
    const firstLine = extractedText.split(/[\r\n]+/)[0].trim().normalize('NFC');
    
    // Clean up temporary files
    if (tempInputFile) {
      await unlink(tempInputFile).catch(() => {});
    }
    if (tempOutputFile) {
      await unlink(`${tempOutputFile}.txt`).catch(() => {});
    }
    
    return NextResponse.json({
      text: (firstLine || extractedText.trim()).replace(/\s+/g, ' ').trim().normalize('NFC'),
      fullText: extractedText.trim().normalize('NFC')
    });
  } catch (error) {
    console.error('OCR error:', error);
    
    // Clean up temporary files on error
    if (tempInputFile) {
      await unlink(tempInputFile).catch(() => {});
    }
    if (tempOutputFile) {
      await unlink(`${tempOutputFile}.txt`).catch(() => {});
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('OCR processing error:', errorMessage);
    
    return NextResponse.json(
      { 
        error: `Failed to process OCR: ${errorMessage}`,
        details: process.env.NODE_ENV === 'development' ? {
          message: errorMessage,
          tesseractPath: TESSERACT_PATH,
          tessdataPath: TESSDATA_PATH,
          stack: error instanceof Error ? error.stack : undefined
        } : undefined
      },
      { status: 500 }
    );
  }
}

