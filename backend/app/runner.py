import sys
import time

start = time.time()

try:
    code = sys.stdin.read()
    exec(code)
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(1)

end = time.time()
print(f"\nExecution time: {round(end - start, 4)}s")
