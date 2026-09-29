export const calculateVerdict = (workerResponse) => {
    // 1. Check for total system failure (Docker crashed, no JSON generated)
    if (workerResponse.output === "System Error" || !workerResponse.result) {
        return {
            status: "Internal Server Error",
            details: workerResponse.errorOutput || "Unknown system crash"
        };
    }

    const testCases = workerResponse.result;
    let totalPassed = 0;

    // 2. Scan the test cases for the first failure
    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];

        if (tc.passed) {
            totalPassed++;
            continue;
        }

        // FAIL-FAST: The moment we hit a failure, determine the specific error type
        const actualStr = String(tc.actual);

        if (actualStr.includes("TimeoutError")) {
            return {
                status: "Time Limit Exceeded",
                failedAtCase: i + 1,
                totalPassed,
                totalCases: testCases.length,
                metrics: workerResponse.metrics
            };
        }

        if (actualStr.includes("Error:") || actualStr.includes("Error")) {
            // Catches TypeError, ReferenceError, SyntaxError, etc.
            return {
                status: "Runtime Error",
                errorDetails: actualStr,
                failedAtCase: i + 1,
                totalPassed,
                totalCases: testCases.length,
                metrics: workerResponse.metrics
            };
        }

        // If it's not a timeout or a crash, it's just the wrong output
        return {
            status: "Wrong Answer",
            failedAtCase: i + 1,
            expected: tc.expected,
            actual: tc.actual,
            totalPassed,
            totalCases: testCases.length,
            metrics: workerResponse.metrics
        };
    }

    // 3. If the loop finishes without returning, everything passed!
    return {
        status: "Accepted",
        totalPassed: testCases.length,
        totalCases: testCases.length,
        metrics: workerResponse.metrics
    };
};