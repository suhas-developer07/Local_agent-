"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const util_1 = require("util");
function getPDFOrientation(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const execAsync = (0, util_1.promisify)(child_process_1.exec);
            const { stdout } = yield execAsync(`pdfinfo "${filePath}"`);
            const match = stdout.match(/Page size:\s+(\d+)\s+x\s+(\d+)/);
            if (match) {
                const width = parseInt(match[1], 10);
                const height = parseInt(match[2], 10);
                return width > height ? 'landscape' : 'portrait';
            }
        }
        catch (err) {
            console.error('⚠️ Could not detect orientation, defaulting to portrait:', err);
        }
        return 'portrait';
    });
}
exports.default = getPDFOrientation;
