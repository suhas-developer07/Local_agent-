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
const Color_printer = "Main_block";
const BlackAndWhite_printer = "Black_And_White";
// Optional: Placeholder for print status check
function getPrintStatus(jobId, type) {
    return __awaiter(this, void 0, void 0, function* () {
        // Later: `lpstat` command to check status based on type
        return Promise.resolve("completed"); // fake for now
    });
}
// 🖨️ Central print logic
function printFile(filePath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const orientation = yield (0, Document_orientation_1.default)(filePath);
        return new Promise((resolve, reject) => {
            const duplexOption = options.duplex === 'double'
                ? orientation === 'landscape'
                    ? 'two-sided-short-edge'
                    : 'two-sided-long-edge'
                : 'one-sided';
            console.log("Duplex option:", duplexOption);
            const flags = [
                `-d ${options.colorMode === 'color' ? Color_printer : BlackAndWhite_printer}`,
                `-n ${options.copies}`,
                `-o ColorModel=${options.colorMode === 'color' ? 'RGB' : 'Gray'}`,
                `-o sides=${duplexOption}`,
                options.pageRange ? `-P ${options.pageRange}` : '',
                ['1', '2', '4'].includes(options.paperSize)
                    ? `-o number-up=${options.paperSize}`
                    : ''
            ].filter(Boolean).join(' ');
            const command = `lp ${flags} "${filePath}"`;
            console.log(" Sending command:", command);
            (0, child_process_1.exec)(command, (error, stdout) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                if (error) {
                    console.error(" Print error:", error);
                    return reject("Print failed");
                }
                const jobId = ((_a = stdout.match(/request id is (\S+)/)) === null || _a === void 0 ? void 0 : _a[1]) || "unknown";
                console.log(`🖨️ Print job submitted: ${jobId}`);
                // Clean up temp file
                fs_1.default.unlink(filePath, (err) => {
                    if (err)
                        console.warn("⚠️ Could not delete temp file:", filePath);
                });
                // Optional: simulate status tracking
                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const status = yield getPrintStatus(jobId, options.status);
                        resolve(status);
                    }
                    catch (_a) {
                        resolve(`Print job ${jobId} submitted. Status unknown.`);
                    }
                }), 1000);
            }));
        });
    });
}
//  Worker loop
function startWorker() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🔧 Print agent started. Waiting for jobs...");
        while (true) {
            try {
                const jobRaw = yield redisClient_1.default.lpop(QUEUE_NAME);
                if (!jobRaw) {
                    yield new Promise((res) => setTimeout(res, 1000)); // no job? wait
                    continue;
                }
                const job = JSON.parse(jobRaw);
                console.log(jobRaw);
                const filename = path_1.default.join((0, os_1.tmpdir)(), `print-${Date.now()}.pdf`);
                //  Download file
                const response = yield axios_1.default.get(job.fileUrl, { responseType: "stream" });
                const writer = (0, fs_1.createWriteStream)(filename);
                yield new Promise((resolve, reject) => {
                    response.data.pipe(writer);
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });
                //  Send to printer
                const status = yield printFile(filename, job.options);
                console.log(" Job finished with status:", status);
            }
            catch (err) {
                console.error(" Error processing job:", err);
            }
        }
    });
}
