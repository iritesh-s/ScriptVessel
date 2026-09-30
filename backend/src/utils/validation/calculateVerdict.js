// src/utils/verdict.js

export const calculateVerdict = ({ docker = {}, results = [], metrics = { runtimeMs: 0, memoryMb: 0 } }) => {
    const errorOutput = docker.errorOutput || "";

    // 1. If no test cases ran or were returned
    if (!results || !Array.isArray(results) || results.length === 0) {
        return {
            status: "Internal Server Error",
            details: errorOutput || "No test case results produced by the runner.",
            metrics
        };
    }

    let totalPassed = 0;

    // 2. Scan test cases for the first failure (Fail-Fast)
    for (let i = 0; i < results.length; i++) {
        const tc = results[i];

        if (tc.passed) {
            totalPassed++;
            continue;
        }

        const actualStr = String(tc.actual ?? "");

        if (actualStr.includes("TimeoutError")) {
            return {
                status: "Time Limit Exceeded",
                failedAtCase: i + 1,
                totalPassed,
                totalCases: results.length,
                metrics
            };
        }

        if (actualStr.includes("Error:") || actualStr.includes("Error") || actualStr.includes("ReferenceError")) {
            return {
                status: "Runtime Error",
                errorDetails: actualStr,
                failedAtCase: i + 1,
                totalPassed,
                totalCases: results.length,
                metrics
            };
        }

        return {
            status: "Wrong Answer",
            failedAtCase: i + 1,
            expected: tc.expected,
            actual: tc.actual,
            totalPassed,
            totalCases: results.length,
            metrics
        };
    }

    // 3. All test cases passed
    return {
        status: "Accepted",
        totalPassed,
        totalCases: results.length,
        metrics
    };
};