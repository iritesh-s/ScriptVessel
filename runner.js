import fs from 'fs/promises';
import path from 'path';
import vm from 'vm';
import { performance } from 'perf_hooks';


// Configuration
const TEST_CASES_PATH = './testCases.json';
const USER_CODE_PATH = './userCode.js';
const RESULTS_PATH = './result.json';
const TIMEOUT_LIMIT = 2000; 
const USER_METHOD = 'solve'

async function runEvaluation() {
    console.log("🚀 Starting JavaScript end-to-end sandboxed evaluation...\n");
    
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    let testCases = [];
    let userCode = "";

    // 1. Safe File Reading
    try {
        const rawTestData = await fs.readFile(TEST_CASES_PATH, 'utf8');
        testCases = JSON.parse(rawTestData);
    } catch (err) {
        console.error(`❌ Setup Error: Could not read or parse ${TEST_CASES_PATH}:`, err.message);
        process.exit(1);
    }

    try {
        userCode = await fs.readFile(USER_CODE_PATH, 'utf8');
    } catch (err) {
        console.error(`❌ Setup Error: Could not read ${USER_CODE_PATH}:`, err.message);
        process.exit(1);
    }

    const results = [];

    // 2. Iterate and evaluate each test case
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const inputs = testCase.inputs || [];
        const expected = testCase.expectedOutput;

        let passed = false;
        let actualOutput = null;

        try {
            // Create an isolated V8 global context for this iteration
            const sandbox = {};
            const context = vm.createContext(sandbox);

            // Run the user's file code inside the sandbox to compile the 'Solution' class
            vm.runInContext(userCode, context);

            // Verify the user defined the Solution class
            if (typeof sandbox.Solution !== 'function') {
                throw new ReferenceError("Class 'Solution' is not defined in user code.");
            }

            // Expose the dynamic input arguments safely to the sandbox environment
            sandbox.__inputs = inputs;

            // Instantiate and dynamically call 'solve' using the arguments unpacking sequence (...args)
            // The { timeout: TIMEOUT_LIMIT } instantly halts infinite loops
            actualOutput = vm.runInContext(
                `const sol = new Solution(); sol.${USER_METHOD}(...__inputs);`, 
                context, 
                { timeout: TIMEOUT_LIMIT }
            );

            // Structured deep evaluation check
            passed = JSON.stringify(actualOutput) === JSON.stringify(expected);

        } catch (error) {
            passed = false;
            if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
                actualOutput = "TimeoutError: Time Limit Exceeded";
            } else {
                // Catch typical runtime crashes (e.g. TypeError, ReferenceError)
                actualOutput = `${error.name}: ${error.message}`;
            }
        }

        // Add to result matrix
        results.push({
            passed: passed,
            actual: actualOutput,
            expected: expected
        });

        const statusIcon = passed ? "✅" : (actualOutput.includes("TimeoutError") ? "⏳" : "❌");
        console.log(`${statusIcon} Case ${i + 1} -> Passed: ${passed} | Output: ${JSON.stringify(actualOutput)}`);

        if(!passed){
            console.log(`🛑 Execution halted at Case ${i + 1} due to failure.`)
            break;
        }
    }


    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const runtimeMs = (endTime - startTime).toFixed(2);
    const memoryMb = Math.max(0, (endMemory - startMemory) / 1024 / 1024).toFixed(2);

    results.push({
            runtimeMs,
            memoryMb
        });
    // 3. Write final data out
    try {
        await fs.writeFile(RESULTS_PATH, JSON.stringify(results, null, 4), 'utf8');
        console.log(`\n🎉 Performance metrics successfully cached in '${RESULTS_PATH}'!`);
    } catch (err) {
        console.error("❌ Error writing output logs:", err.message);
    }
}

runEvaluation();
