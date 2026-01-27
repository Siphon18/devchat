import subprocess
import uuid

def execute_python(code: str):
    execution_id = str(uuid.uuid4())

    try:
        result = subprocess.run(
            ["docker", "run", "-i", "--rm", "devchat-executor"],
            input=code.encode(),
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
            "stdout": result.stdout.decode(),
            "stderr": result.stderr.decode(),
            "status": "success" if result.returncode == 0 else "error",
            "runtime": "3s"
        }



