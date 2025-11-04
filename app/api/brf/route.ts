import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Vercel serverless functions have timeout limits (10s for Hobby, 60s for Pro)
const PYTHON_TIMEOUT_MS = 8000; // 8 seconds to stay under Vercel limits

export async function POST(request: NextRequest) {
  try {
    const { unicodeText } = await request.json();

    if (!unicodeText || typeof unicodeText !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input: unicodeText is required and must be a string' },
        { status: 400 }
      );
    }

    // On Vercel, Python is typically not available in the Node.js runtime
    // Return error quickly so TypeScript fallback can be used
    if (process.env.VERCEL) {
      return NextResponse.json(
        { 
          error: 'Python is not available in Vercel serverless functions',
          suggestion: 'The application will automatically use TypeScript fallback for conversion.'
        },
        { status: 503 } // Service Unavailable - indicates temporary/unavailable service
      );
    }

    // Get the path to the Python script (Linux-compatible path)
    const scriptPath = path.join(process.cwd(), 'lib', 'unicode-to-brf.py');
    
    // Check if Python script exists
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: 'Python conversion script not found' },
        { status: 500 }
      );
    }

    // Determine Python command (try python3 first on Linux, then python)
    const isWindows = process.platform === 'win32';
    let pythonCmd: string | null = null;
    
    // Try to find Python with timeout
    const commands = isWindows ? ['python', 'python3'] : ['python3', 'python'];
    
    for (const cmd of commands) {
      try {
        const check = spawn(cmd, ['--version']);
        await Promise.race([
          new Promise<void>((resolve, reject) => {
            check.on('close', (code) => {
              if (code === 0) {
                pythonCmd = cmd;
                resolve();
              } else {
                reject(new Error(`Command ${cmd} failed with code ${code}`));
              }
            });
            check.on('error', reject);
          }),
          new Promise<void>((_, reject) => 
            setTimeout(() => reject(new Error('Python check timeout')), 2000)
          )
        ]).catch(() => {
          // Continue to next command if this one fails
        });
        if (pythonCmd) break;
      } catch {
        continue;
      }
    }
    
    if (!pythonCmd) {
      return NextResponse.json(
        { error: 'Python is not installed or not found in PATH' },
        { status: 503 }
      );
    }

    // Execute Python script with stdin input and timeout
    const pythonProcess = spawn(pythonCmd, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Write input to stdin
    try {
      pythonProcess.stdin.write(unicodeText, 'utf8');
      pythonProcess.stdin.end();
    } catch (writeError) {
      pythonProcess.kill();
      throw new Error(`Failed to write to Python stdin: ${writeError instanceof Error ? writeError.message : 'Unknown error'}`);
    }

    // Wait for process to complete with timeout
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Python script exited with code ${code}: ${stderr.slice(0, 200)}`));
          }
        });
        pythonProcess.on('error', (err) => {
          reject(new Error(`Python process error: ${err.message}`));
        });
      }),
      new Promise<void>((_, reject) => 
        setTimeout(() => {
          pythonProcess.kill('SIGTERM');
          reject(new Error(`Python script execution timed out after ${PYTHON_TIMEOUT_MS}ms`));
        }, PYTHON_TIMEOUT_MS)
      )
    ]);

    // Filter out warnings from stderr
    const errors = stderr.split('\n').filter(line => 
      line && !line.includes('Warning:') && !line.trim().startsWith('⚠')
    );

    if (errors.length > 0) {
      console.error('Python script errors:', errors.join('\n'));
    }

    return NextResponse.json({
      brfText: stdout.trim(),
    });

  } catch (error) {
    console.error('BRF conversion error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return 503 (Service Unavailable) instead of 500 so client knows to use fallback
    return NextResponse.json(
      { 
        error: 'Failed to convert Unicode Braille to BRF using Python',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        suggestion: 'The application will automatically use TypeScript fallback for conversion.'
      },
      { status: 503 }
    );
  }
}
