import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

// Path to local Tesseract installation
const TESSERACT_PATH = join(process.cwd(), 'requirements', 'Tesseract-OCR', 'tesseract.exe');
const TESSDATA_PATH = join(process.cwd(), 'requirements', 'Tesseract-OCR', 'tessdata');

// Check if Tesseract is available
async function checkTesseractAvailable(): Promise<boolean> {
  try {
    await access(TESSERACT_PATH);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let tempInputFile: string | null = null;
  let tempOutputFile: string | null = null;

  try {
    // Check if Tesseract is available
    const isAvailable = await checkTesseractAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        { 
          error: 'Tesseract OCR is not available',
          details: `Tesseract executable not found at: ${TESSERACT_PATH}`
        },
        { status: 500 }
      );
    }

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
    const originalName = (file as any).name as string | undefined;
    const extFromName = originalName && originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '.png';
    tempInputFile = join(tempDir, `tesseract_input_${timestamp}${extFromName}`);
    tempOutputFile = join(tempDir, `tesseract_output_${timestamp}`);
    
    // Write buffer to temporary file
    await writeFile(tempInputFile, buffer);
    
    // Run Tesseract OCR with Tamil language support
    // -l tam: Use Tamil language model
    // --tessdata-dir: Specify the directory containing language data
    const tesseractCommand = `"${TESSERACT_PATH}" "${tempInputFile}" "${tempOutputFile}" -l tam+eng --tessdata-dir "${TESSDATA_PATH}" --psm 6 --oem 1 -c preserve_interword_spaces=1`;
    
    console.log('Running Tesseract OCR...');
    console.log('Command:', tesseractCommand);
    
    let stdout: string, stderr: string;
    try {
      const result = await execAsync(tesseractCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 60000, // 60 second timeout
        env: {
          ...process.env,
          TESSDATA_PREFIX: TESSDATA_PATH,
          PATH: process.env.PATH // Ensure PATH is set
        }
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execError: any) {
      console.error('Tesseract execution error:', execError);
      throw new Error(`Tesseract OCR failed: ${execError.message || 'Unknown error'}`);
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

