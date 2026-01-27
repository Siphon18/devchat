import subprocess
import uuid

import sys

def execute_python(code: str):
    execution_id = str(uuid.uuid4())

    try:
        # Run code directly using the same python interpreter
        # SECURITY NOTE: This runs code in the main container. 
        # Fine for portfolio demo, but use Docker for production isolation.
        result = subprocess.run(
            [sys.executable, "-c", code],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=3
        )

        return {
            "execution_id": execution_id,
            "stdout": result.stdout.decode(),
            "stderr": result.stderr.decode(),
            "status": "success" if result.returncode == 0 else "error"
        }

    except subprocess.TimeoutExpired:
        return {
            "execution_id": execution_id,
            "stdout": "", # Can't capture stdout easily on timeout without more complex code
            "stderr": "Execution timed out (3s limit)",
            "status": "error",
            "runtime": "3s"
        }



