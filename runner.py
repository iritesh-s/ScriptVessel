import importlib.util
import json
import multiprocessing
import sys

# 1. This function runs inside the ISOLATED child process
def worker_evaluator(script_path, module_name, method_name, test_inputs, result_queue):
    try:
        # Dynamically load the user's code inside the child process space
        spec = importlib.util.spec_from_file_location(module_name, script_path)
        user_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(user_module)
        
        if not hasattr(user_module, "Solution"):
            result_queue.put((False, "AttributeError: Class 'Solution' not found."))
            return
            
        sol = user_module.Solution()
        target_method = getattr(sol, method_name, None)
        
        if not target_method:
            result_queue.put((False, f"AttributeError: Method '{method_name}' not found."))
            return
            
        # Execute the function and return the results
        actual_output = target_method(*test_inputs)
        result_queue.put((True, actual_output))
        
    except Exception as e:
        # Catch standard crashes (ZeroDivisionError, IndexError, etc.)
        error_msg = f"{type(e).__name__}: {str(e)}"
        result_queue.put((False, error_msg))

if __name__ == "__main__":
    # Required for multiprocessing safely on Windows/macOS
    multiprocessing.freeze_support()

    # Load Test Cases
    file_path = "testCases.json"
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            data_list = json.load(file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"❌ Failed to parse configuration: {e}")
        sys.exit(1)

    results = []
    script_path = "userCode.py"
    module_name = "userCode"
    method_name = "solve"
    
    TIMEOUT_LIMIT = 2.0  # Execution timeout window per test case in seconds

    print(f"Starting isolated evaluations with a {TIMEOUT_LIMIT}s timeout limit...\n")

    for index, item in enumerate(data_list):
        test_inputs = item.get("inputs", [])
        expected = item.get("expectedOutput")
        
        # Communication channel between processes
        result_queue = multiprocessing.Queue()
        
        # Initialize the target evaluation into a dedicated child process
        process = multiprocessing.Process(
            target=worker_evaluator,
            args=(script_path, module_name, method_name, test_inputs, result_queue)
        )
        
        process.start()
        
        # Wait up to the timeout limit for the process to conclude
        process.join(timeout=TIMEOUT_LIMIT)
        
        if process.is_alive():
            # 🚨 CRITICAL: The process is stuck in an infinite loop! Terminate it immediately.
            process.terminate()
            process.join()  # Clear up operating system resources cleanly
            
            success = False
            actual_output = "TimeoutError: Time Limit Exceeded"
            status_icon = "⏳"
        else:
            # Process finished. Extract the resulting values safely from the queue.
            if not result_queue.empty():
                success_flag, payload = result_queue.get()
                if success_flag:
                    actual_output = payload
                    success = (actual_output == expected)
                    status_icon = "✅" if success else "❌"
                else:
                    success = False
                    actual_output = payload  # This is the trapped error message string
                    status_icon = "❌"
            else:
                success = False
                actual_output = "RuntimeError: Unknown process death"
                status_icon = "❌"

        # Append structured metrics
        results.append({
            "passed": bool(success),
            "actual": actual_output,
            "expected": expected
        })
        
        print(f"{status_icon} Case {index + 1} -> Passed: {success} | Output: {actual_output}")

    # Write evaluation logs out to result.json
    json_filename = "result.json"
    with open(json_filename, "w", encoding="utf-8") as json_file:
        json.dump(results, json_file, indent=4)

    print(f"\nAll logs safely generated in '{json_filename}'!")
