// // ✅ Windows-compatible print agent using pdf-to-printer
// import redis from "./redisClient";
// import axios from "axios";
// import fs, { createWriteStream } from "fs";
// import path from "path";
// import { tmpdir } from "os";
// import { Readable } from "stream";
// import printer from "pdf-to-printer";

// const QUEUE_NAME = process.env.QUEUE_NAME || "print_jobs";
// const PRINTER_NAME = process.env.PRINTER_NAME || undefined;

// interface PrintOptions {
//   copies: number;
//   colorMode: string; // 'color' or 'bw'
//   duplex: string; // 'single' or 'double'
//   paperSize: string; // e.g., 'A4'
//   pageRange: string; // e.g., '1-2'
// }

// interface PrintJob {
//   fileUrl: string;
//   options: PrintOptions;
// }

// // 🖨️ Print logic using Windows printer
// export async function printFile(filePath: string, options: PrintOptions): Promise<string> {
//   const win32Options = [
//     `copies=${options.copies}`,
//     `Duplex=${options.duplex === 'double' ? 'DuplexNoTumble' : 'Simplex'}`,
//     `Color=${options.colorMode === 'color' ? 'Color' : 'Grayscale'}`,
//     `PaperSize=${options.paperSize || 'A4'}`,
//   ];

//   if (options.pageRange) win32Options.push(`PageRange=${options.pageRange}`);

//   try {
//     await printer.print(filePath, {
//       printer: PRINTER_NAME,
//       win32: win32Options,
//     });

//     fs.unlink(filePath, () => {}); // Clean up file after printing
//     return "completed";
//   } catch (err) {
//     console.error("Print error:", err);
//     throw new Error("Print failed");
//   }
// }

// // 🔁 Worker loop
// export async function startWorker() {
//   console.log("🔧 Windows print agent started. Waiting for jobs...");

//   while (true) {
//     try {
//       const jobRaw = await redis.lpop(QUEUE_NAME);
//       if (!jobRaw) {
//         await new Promise((res) => setTimeout(res, 1000));
//         continue;
//       }

//       const job: PrintJob = JSON.parse(jobRaw);
//       const filename = path.join(tmpdir(), `print-${Date.now()}.pdf`);

//       const response = await axios.get(job.fileUrl, { responseType: "stream" });
//       const writer = createWriteStream(filename);

//       await new Promise((resolve, reject) => {
//         (response.data as Readable).pipe(writer);
//         writer.on("finish", resolve);
//         writer.on("error", reject);
//       });

//       const status = await printFile(filename, job.options);
//       console.log("✅ Job finished with status:", status);
//     } catch (err) {
//       console.error("❌ Error processing job:", err);
//     }
//   }
// }
