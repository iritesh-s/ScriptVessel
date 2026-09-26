import { asyncHandler } from "../utils/asyncHandler.js"
import { exec } from 'node:child_process'
import util from 'node:util'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'; // v4 is standard for random UUIDs
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { scriptGenerator } from "../utils/scripts/scriptGenerator.js";

// Convert the callback-based exec into a Promise-based function
const execPromise = util.promisify(exec);

const Mapping = {
    'python': 'py',
    'javascript' : 'js',
    'java' : 'java',
    'c++': 'cpp',
    'c' : 'c'
}

const execPyCode = asyncHandler(async (req, res) => {
    const { language, code } = req.body;
    
    if (!Object.keys(Mapping).includes(language)) {
        throw new ApiError(409, 'Unsupported language selected!');
    }
    if (!code || code.trim() === "") {
        throw new ApiError(409, 'Empty code block!');
    }

    const uid = uuidv4();
    
    const userFolderPath = path.join(process.cwd(), "public", "temp");
    const filePath = path.join(userFolderPath, `${uid}.${Mapping[language]}`);

    
    fs.mkdirSync(userFolderPath, { recursive: true });
    
    try {
        await fs.promises.writeFile(filePath, code);
    } catch (err) {
        throw new ApiError(500, 'Server failed to store your code locally');
    }

    let output = "";
    let errorOutput = "";

    try {
        
        const script = scriptGenerator(language, uid, userFolderPath);
        
        const { stdout, stderr } = await execPromise(script);
        output = stdout;
        errorOutput = stderr;

    } catch (error) {
        output = error.stdout;
        errorOutput = error.stderr || error.message;
    } finally {
        try {
            await fs.promises.unlink(filePath);
        } catch (unlinkErr) {
            console.error("Critical: Failed to delete temp file:", filePath);
        }
    }

    res.status(200).json(
        new ApiResponse(200, { output, error: errorOutput }, "Execution completed")
    );
});

export {
    execPyCode,
}