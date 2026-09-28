# userCode.py

class Solution:
    def solve(self, nums: list, target: int) -> list:
        # Edge case mock to demonstrate safety net / crash handling
        if target == -1:
            raise IndexError("Simulated out-of-bounds error for testing!")
            
        if target == 0:
            return 1 / 0 # Simulated ZeroDivisionError for testing!

        while True:
            pass
        # Normal working Two Sum logic
        mapping = {}
        for i, num in enumerate(nums):
            diff = target - num
            if diff in mapping:
                return [mapping[diff], i]
            mapping[num] = i
            
        return []
