import importlib.util
import json
import multiprocessing
import sys
import time
import tracemalloc

def worker_evaluator(script_path, module_name, method_name, test_inputs, result_queue):
    try:
        # Start tracking memory inside the child process
        tracemalloc.start()
        start_time = time.perf_counter()

        spec = importlib.util.spec_from_file_location(module_name, script_path)
        user_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(user_module)
        
        if not hasattr(user_module, "Solution"):
            result_queue.put((False, "AttributeError: Class 'Solution' not found.", 0, 0))
            return
            
        sol = user_module.Solution()
        target_method = getattr(sol, method_name, None)
        
        if not target_method:
            result_queue.put((False, f"AttributeError: Method '{method_name}' not found.", 0, 0))
            return
            
        actual_output = target_method(*test_inputs)
        
        # Calculate single test case metrics
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        _, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        mem_mb = peak_mem / (1024 * 1024)

        result_queue.put((True, actual_output, elapsed_ms, mem_mb))
        
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        result_queue.put((False, error_msg, 0, 0))

if __name__ == "__main__":
    multiprocessing.freeze_support()

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
    
    TIMEOUT_LIMIT = 2.0
    total_runtime_ms = 0.0
    max_memory_mb = 0.0

    print(f"Starting isolated evaluations with a {TIMEOUT_LIMIT}s timeout limit...\n")

    for index, item in enumerate(data_list):
        test_inputs = item.get("inputs", [])
        expected = item.get("expectedOutput")
        
        result_queue = multiprocessing.Queue()
        process = multiprocessing.Process(
            target=worker_evaluator,
            args=(script_path, module_name, method_name, test_inputs, result_queue)
        )
        
        process.start()
        process.join(timeout=TIMEOUT_LIMIT)
        
        if process.is_alive():
            process.terminate()
            process.join()
            success = False
            actual_output = "TimeoutError: Time Limit Exceeded"
            status_icon = "⏳"
        else:
            if not result_queue.empty():
                success_flag, payload, tc_time, tc_mem = result_queue.get()
                total_runtime_ms += tc_time
                max_memory_mb = max(max_memory_mb, tc_mem)

                if success_flag:
                    actual_output = payload
                    success = (actual_output == expected)
                    status_icon = "✅" if success else "❌"
                else:
                    success = False
                    actual_output = payload
                    status_icon = "❌"
            else:
                success = False
                actual_output = "RuntimeError: Unknown process death"
                status_icon = "❌"

        results.append({
            "passed": bool(success),
            "actual": actual_output,
            "expected": expected
        })
        
        print(f"{status_icon} Case {index + 1} -> Passed: {success} | Output: {actual_output}")
        if not success:
            print(f"🛑 Execution halted at Case {index + 1} due to failure.")
            break

    # Structure final JSON payload cleanly
    final_output = {
        "results": results,
        "metrics": {
            "runtimeMs": round(total_runtime_ms, 2),
            "memoryMb": round(max_memory_mb, 2)
        }
    }

    with open("result.json", "w", encoding="utf-8") as json_file:
        json.dump(final_output, json_file, indent=4)

    print(f"\nAll logs safely generated in 'result.json'!")