import { exec } from 'child_process';
import { promisify } from "util";

async function getPDFOrientation(filePath: string): Promise<'portrait' | 'landscape'> {
    try {
      const execAsync = promisify(exec);
      const { stdout } = await execAsync(`pdfinfo "${filePath}"`);
      const match = stdout.match(/Page size:\s+(\d+)\s+x\s+(\d+)/);
  
      if (match) {
        const width = parseInt(match[1], 10);
        const height = parseInt(match[2], 10);
        return width > height ? 'landscape' : 'portrait';
      }
    } catch (err) {
      console.error('⚠️ Could not detect orientation, defaulting to portrait:', err);
    }
    return 'portrait';
  }
  
  export default getPDFOrientation;