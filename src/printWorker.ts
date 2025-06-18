import redis from "./redisClient";
import axios from "axios";
import fs, { createWriteStream } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { tmpdir } from "os";
import { Readable } from "stream";
import getPDFOrientation from "./Document_orientation";

const execAsync = promisify(exec);
const QUEUE_NAME = process.env.QUEUE_NAME || "print_jobs";
const COLOR_PRINTER = "Main_block";
const BW_PRINTER = "Black_And_White";

interface PrintOptions {
  copies: number;
  colorMode: string;
  duplex: string;
  paperSize: string;
  pageRange: string;
  status?: string;
}

interface PrintJob {
  fileUrl: string;
  options: PrintOptions;
}

// ✅ Check status using `lpstat`
async function getPrintStatus(jobId: string): Promise<string> {
  try {
    const { stdout } = await execAsync("lpstat -W not-completed");
    if (stdout.includes(jobId)) return "printing";
    return "completed";
  } catch {
    return "unknown";
  }
}

// ✅ Print file with options and monitor job
export async function printFile(filePath: string, options: PrintOptions): Promise<string> {
  const orientation = await getPDFOrientation(filePath);

  let duplexOption =
    options.duplex === "double"
      ? orientation === "landscape"
        ? "two-sided-short-edge"
        : options.paperSize === "2" ? "two-sided-short-edge":"two-sided-long-edge"
      : "one-sided";

      if(options.pageRange === "2"){
        duplexOption = "two-sided-short-edge" 
      }
      console.log(duplexOption);

  const flags = [
    `-d ${options.colorMode === "color" ? COLOR_PRINTER : BW_PRINTER}`,
    `-n ${options.copies}`,
    `-o Collate=True`,
    `-o ColorModel=${options.colorMode === "color" ? "RGB" : "Gray"}`,
    `-o sides=${duplexOption}`,
    options.pageRange ? `-P ${options.pageRange}` : "",
    ["1", "2", "4"].includes(options.paperSize)
      ? `-o number-up=${options.paperSize}`
      : ""
  ]
    .filter(Boolean)
    .join(" ");

  const command = `lp ${flags} "${filePath}"`;
  console.log("🖨️ Sending command:", command);

  return new Promise((resolve, reject) => {
    exec(command, async (error, stdout) => {
      if (error) {
        console.error("❌ Print error:", error.message);
        return reject("Print failed");
      }

      const jobIdMatch = stdout.match(/request id is ([\w-]+)/);
      const jobId = jobIdMatch?.[1] || "unknown";
      console.log(`✅ Print job submitted: ${jobId}`);

      // Wait for job to complete using polling
      let status = "printing";
      let retries = 20; // wait up to 60 seconds
      while (status === "printing" && retries-- > 0) {
        await new Promise((res) => setTimeout(res, 3000));
        status = await getPrintStatus(jobId);
        console.log(`⏳ Status of ${jobId}: ${status}`);
      }

      // Clean up temp file
      fs.unlink(filePath, (err) => {
        if (err) console.warn("⚠️ Could not delete temp file:", filePath);
      });

      if (status !== "completed") {
        return resolve(`⚠️ Job ${jobId} status: ${status}`);
      }

      resolve(`✅ Job ${jobId} completed`);
    });
  });
}

// ✅ Worker loop
export async function startWorker() {
  console.log("🚀 Print agent started. Waiting for jobs...");

  while (true) {
    try {
      const jobRaw = await redis.lpop(QUEUE_NAME);

      if (!jobRaw) {
        await new Promise((res) => setTimeout(res, 1000));
        continue;
      }

      const job: PrintJob = JSON.parse(jobRaw);
      console.log("📥 New Job:", job);

      const filename = path.join(tmpdir(), `print-${Date.now()}.pdf`);
      const response = await axios.get(job.fileUrl, { responseType: "stream" });
      const writer = createWriteStream(filename);

      await new Promise<void>((resolve, reject) => {
        (response.data as Readable).pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      const result = await printFile(filename, job.options);
      console.log("📤 Job result:", result);

    } catch (err: any) {
      console.error("❌ Error processing job:", err.message || err);
    }
  }
}