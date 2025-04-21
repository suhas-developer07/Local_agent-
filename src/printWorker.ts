import redis from "./redisClient";
import axios from "axios";
import fs, { createWriteStream } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { tmpdir } from "os";
import { Readable } from "stream";

const execAsync = promisify(exec);
const QUEUE_NAME = process.env.QUEUE_NAME || "print_jobs";
const PRINTER_NAME = "Vithsuthra";

interface PrintOptions {
  copies: number;
  colorMode: string;
  duplex: string;
  paperSize: string;
  PageRange?: string;
  status?: string; // optional for tracking
}

interface PrintJob {
  fileUrl: string;
  options: PrintOptions;
}

// Optional: Placeholder for print status check
async function getPrintStatus(jobId: string, type?: string): Promise<string> {
  // Later: `lpstat` command to check status based on type
  return Promise.resolve("completed"); // fake for now
}

// 🖨️ Central print logic
export async function printFile(filePath: string, options: PrintOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const flags = [
      `-d ${PRINTER_NAME}`,
      `-n ${options.copies}`,
      `-o ColorModel=${options.colorMode === 'color' ? 'RGB' : 'Gray'}`,
      `-o sides=${options.duplex === 'double' ? 'two-sided-long-edge' : 'one-sided'}`,
      options.PageRange ? `-P ${options.PageRange}` : ''
    ].filter(Boolean).join(' ');

    const command = `lp ${flags} "${filePath}"`;
    console.log(" Sending command:", command);

    exec(command, async (error, stdout) => {
      if (error) {
        console.error(" Print error:", error);
        return reject("Print failed");
      }

      const jobId = stdout.match(/request id is (\S+)/)?.[1] || "unknown";
      console.log(`🖨️ Print job submitted: ${jobId}`);

      // Clean up temp file
      fs.unlink(filePath, (err) => {
        if (err) console.warn("⚠️ Could not delete temp file:", filePath);
      });

      // Optional: simulate status tracking
      setTimeout(async () => {
        try {
          const status = await getPrintStatus(jobId, options.status);
          resolve(status);
        } catch {
          resolve(`Print job ${jobId} submitted. Status unknown.`);
        }
      }, 1000);
    });
  });
}

// 🧠 Worker loop
export async function startWorker() {
  console.log("🔧 Print agent started. Waiting for jobs...");

  while (true) {
    try {
      const jobRaw = await redis.lpop(QUEUE_NAME);
      if (!jobRaw) {
        await new Promise((res) => setTimeout(res, 1000)); // no job? wait
        continue;
      }

      const job: PrintJob = JSON.parse(jobRaw);
      const filename = path.join(tmpdir(), `print-${Date.now()}.pdf`);

      // 📥 Download file
      const response = await axios.get(job.fileUrl, { responseType: "stream" });
      const writer = createWriteStream(filename);

      await new Promise((resolve:any, reject) => {
        (response.data as Readable).pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // 🖨️ Send to printer
      const status = await printFile(filename, job.options);
      console.log(" Job finished with status:", status);

    } catch (err) {
      console.error(" Error processing job:", err);
    }
  }
}
