"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.printFile = printFile;
exports.startWorker = startWorker;
const redisClient_1 = __importDefault(require("./redisClient"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importStar(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const os_1 = require("os");
const Document_orientation_1 = __importDefault(require("./Document_orientation"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const QUEUE_NAME = process.env.QUEUE_NAME || "print_jobs";
const COLOR_PRINTER = "Main_block";
const BW_PRINTER = "Black_And_White";
// ✅ Check status using `lpstat`
function getPrintStatus(jobId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { stdout } = yield execAsync("lpstat -W not-completed");
            if (stdout.includes(jobId))
                return "printing";
            return "completed";
        }
        catch (_a) {
            return "unknown";
        }
    });
}
// ✅ Print file with options and monitor job
function printFile(filePath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const orientation = yield (0, Document_orientation_1.default)(filePath);
        const duplexOption = options.duplex === "double"
            ? orientation === "landscape"
                ? "two-sided-short-edge"
                : "two-sided-long-edge"
            : "one-sided";
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
            (0, child_process_1.exec)(command, (error, stdout) => __awaiter(this, void 0, void 0, function* () {
                if (error) {
                    console.error("❌ Print error:", error.message);
                    return reject("Print failed");
                }
                const jobIdMatch = stdout.match(/request id is ([\w-]+)/);
                const jobId = (jobIdMatch === null || jobIdMatch === void 0 ? void 0 : jobIdMatch[1]) || "unknown";
                console.log(`✅ Print job submitted: ${jobId}`);
                // Wait for job to complete using polling
                let status = "printing";
                let retries = 20; // wait up to 60 seconds
                while (status === "printing" && retries-- > 0) {
                    yield new Promise((res) => setTimeout(res, 3000));
                    status = yield getPrintStatus(jobId);
                    console.log(`⏳ Status of ${jobId}: ${status}`);
                }
                // Clean up temp file
                fs_1.default.unlink(filePath, (err) => {
                    if (err)
                        console.warn("⚠️ Could not delete temp file:", filePath);
                });
                if (status !== "completed") {
                    return resolve(`⚠️ Job ${jobId} status: ${status}`);
                }
                resolve(`✅ Job ${jobId} completed`);
            }));
        });
    });
}
// ✅ Worker loop
function startWorker() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🚀 Print agent started. Waiting for jobs...");
        while (true) {
            try {
                const jobRaw = yield redisClient_1.default.lpop(QUEUE_NAME);
                if (!jobRaw) {
                    yield new Promise((res) => setTimeout(res, 1000));
                    continue;
                }
                const job = JSON.parse(jobRaw);
                console.log("📥 New Job:", job);
                const filename = path_1.default.join((0, os_1.tmpdir)(), `print-${Date.now()}.pdf`);
                const response = yield axios_1.default.get(job.fileUrl, { responseType: "stream" });
                const writer = (0, fs_1.createWriteStream)(filename);
                yield new Promise((resolve, reject) => {
                    response.data.pipe(writer);
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });
                const result = yield printFile(filename, job.options);
                console.log("📤 Job result:", result);
            }
            catch (err) {
                console.error("❌ Error processing job:", err.message || err);
            }
        }
    });
}
