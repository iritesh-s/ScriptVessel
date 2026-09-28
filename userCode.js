class Solution {
    solve(nums, target) {
        // Infinite loop handler validation for the third test case
        if (target === 999) {
            while (true) {
                // Hangups here will be cleanly killed by V8
            }
        }

        // Standard Two-Sum mapping
        const map = new Map();
        for (let i = 0; i < nums.length; i++) {
            const diff = target - nums[i];
            if (map.has(diff)) {
                return [map.get(diff), i];
            }
            map.set(nums[i], i);
        }
        return [];
    }
}

// Expose it to the global sandbox object
globalThis.Solution = Solution;
