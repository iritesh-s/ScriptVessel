import json

# Define the path to your file
file_path = "testCases.json"

try:
    with open(file_path, "r", encoding="utf-8") as file:
        data_list = json.load(file)
        
    for item in data_list:
        user_input = item["input"]
        expected = item["expectedOutput"]
        
        #print(f"Input: {repr(user_input)} -> Expected: {expected}")

except FileNotFoundError:
    print(f"Error: The file '{file_path}' was not found.")
except json.JSONDecodeError:
    print("Error: The file contains invalid JSON data.")

import subprocess
import sys


results = []

script_path = "userCode.py"

print("Starting batch processing via subprocess pipes...\n")

for item in data_list:
    # Open the process and connect to its standard input, output, and error pipes
    process = subprocess.Popen(
        [sys.executable, script_path],
        stdin=subprocess.PIPE,   # Allows us to send data
        stdout=subprocess.PIPE,  # Allows us to capture output
        stderr=subprocess.PIPE,  # Allows us to capture errors
        text=True                # Automatically handles text string encoding
    )
    
    try:
        stdout_data, stderr_data = process.communicate(input=item["input"], timeout=2)
    except subprocess.TimeoutExpired:
        process.kill()
        stdout_data, stderr_data = process.communicate()
        stderr_data = "Time Limit Exceeded"
    
    if process.returncode == 0:
        # Strip out any trailing newlines from the script's output
        cleaned_output = stdout_data.strip()
        cleaned_expected = item["expectedOutput"].strip()
        passed = cleaned_expected == cleaned_output
        results.append({"passed": bool(passed),"actual":cleaned_output,"expected":cleaned_expected})
        print(f"Processed '{item}' -> '{cleaned_output}'")
    else:
        print(f"❌ Error processing '{item}': {stderr_data.strip()}")
        results.append({"passed": False,"actual":stderr_data.strip(),"expected":cleaned_expected}) # Log a failure placeholder

# 3. View your final accumulated results
print("\nFinal Results Array:", results)

json_filename = "result.json"

with open(json_filename, "w", encoding="utf-8") as json_file:
    # indent=4 makes the JSON file human-readable with nice spacing
    json.dump(results, json_file, indent=4)

print(f"\n All results successfully written to '{json_filename}'!")