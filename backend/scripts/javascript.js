const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const TEST_CASES_PATH = './testCases.json';
const USER_CODE_PATH = './userCode.js';
const RESULTS_PATH = './result.json';
const TIMEOUT_LIMIT = 2000; 
const USER_METHOD = 'solve';

async function runEvaluation() {
    console.log("🚀 Starting JavaScript end-to-end sandboxed evaluation...\n");

    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    let testCases = [];
    let userCode = "";

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

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const inputs = testCase.inputs || [];
        const expected = testCase.expectedOutput;

        let passed = false;
        let actualOutput = null;

        try {
            const sandbox = {};
            const context = vm.createContext(sandbox);

            vm.runInContext(userCode, context);

            const isClassDefined = vm.runInContext("typeof Solution === 'function'", context);
            if (!isClassDefined) {
                throw new ReferenceError("Class 'Solution' is not defined in user code.");
            }

            sandbox.__inputs = inputs;

            actualOutput = vm.runInContext(
                `const sol = new Solution(); sol.${USER_METHOD}(...__inputs);`, 
                context, 
                { timeout: TIMEOUT_LIMIT }
            );

            passed = JSON.stringify(actualOutput) === JSON.stringify(expected);

        } catch (error) {
            passed = false;
            if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
                actualOutput = "TimeoutError: Time Limit Exceeded";
            } else {
                actualOutput = `${error.name}: ${error.message}`;
            }
        }

        results.push({
            passed: passed,
            actual: actualOutput,
            expected: expected
        });

        const statusIcon = passed ? "✅" : (actualOutput.includes("TimeoutError") ? "⏳" : "❌");
        console.log(`${statusIcon} Case ${i + 1} -> Passed: ${passed} | Output: ${JSON.stringify(actualOutput)}`);

        if (!passed) {
            console.log(`🛑 Execution halted at Case ${i + 1} due to failure.`);
            break;
        }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    // Convert to proper Floats, not Strings
    const runtimeMs = parseFloat((endTime - startTime).toFixed(2));
    const memoryMb = parseFloat(Math.max(0, (endMemory - startMemory) / 1024 / 1024).toFixed(2));

    const finalOutput = {
        results,
        metrics: {
            runtimeMs,
            memoryMb
        }
    };

    try {
        await fs.writeFile(RESULTS_PATH, JSON.stringify(finalOutput, null, 4), 'utf8');
        console.log(`\n🎉 Performance metrics successfully cached in '${RESULTS_PATH}'!`);
    } catch (err) {
        console.error("❌ Error writing output logs:", err.message);
    }
}

runEvaluation();