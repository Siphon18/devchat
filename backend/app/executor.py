import subprocess
import uuid
import sys
import time
import resource as _resource
import os

# Limits
MAX_TIMEOUT = 15          # seconds
MAX_OUTPUT  = 50_000      # characters (stdout / stderr each)

# Dangerous modules that user code should never import
_BLOCKED_MODULES = {
    "os", "subprocess", "shutil", "socket", "http", "urllib",
    "ftplib", "smtplib", "ctypes", "multiprocessing", "signal",
    "webbrowser", "code", "codeop", "compileall", "importlib",
    "runpy", "pathlib",
}

# Security preamble injected before user code to block dangerous operations
_SECURITY_PREAMBLE = '''
import builtins as _builtins

# Block dangerous builtins
_blocked = {"open", "exec", "eval", "compile", "__import__", "breakpoint"}
_original_import = _builtins.__import__

_blocked_modules = {blocked_mods}

def _safe_import(name, *args, **kwargs):
    top = name.split(".")[0]
    if top in _blocked_modules:
        raise ImportError(f"Module '{{name}}' is not allowed in this sandbox")
    return _original_import(name, *args, **kwargs)

_builtins.__import__ = _safe_import

# Remove access to open() for files (but allow print, input, etc.)
_original_open = _builtins.open
def _restricted_open(*a, **kw):
    raise PermissionError("File I/O is disabled in this sandbox")
_builtins.open = _restricted_open

# Remove exec/eval/compile
_builtins.exec = lambda *a, **kw: (_ for _ in ()).throw(PermissionError("exec() is disabled"))
_builtins.eval = lambda *a, **kw: (_ for _ in ()).throw(PermissionError("eval() is disabled"))
_builtins.compile = lambda *a, **kw: (_ for _ in ()).throw(PermissionError("compile() is disabled"))
_builtins.breakpoint = lambda *a, **kw: None

del _builtins, _blocked, _original_open
'''


def _truncate(text: str, limit: int = MAX_OUTPUT) -> str:
    if len(text) > limit:
        return text[:limit] + f"\n... (truncated at {limit} chars)"
    return text


def _preexec():
    """Called in the child process before exec – set resource limits."""
    try:
        # 256 MB virtual memory
        _resource.setrlimit(_resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    except Exception:
        pass  # some platforms may not support RLIMIT_AS
    try:
        # 10 MB max file write
        _resource.setrlimit(_resource.RLIMIT_FSIZE, (10 * 1024 * 1024, 10 * 1024 * 1024))
    except Exception:
        pass
    try:
        # no subprocesses / forkbombs
        _resource.setrlimit(_resource.RLIMIT_NPROC, (50, 50))
    except Exception:
        pass


def _get_safe_env() -> dict:
    """Return a minimal environment for the subprocess, stripping secrets."""
    safe = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "HOME": "/tmp",
        "LANG": "C.UTF-8",
    }
    return {k: v for k, v in safe.items() if v}


def execute_python(code: str, stdin_text: str = ""):
    execution_id = str(uuid.uuid4())
    start = time.perf_counter()

    # Matplotlib: force non-interactive backend so plt.show() doesn't hang
    preamble = "import matplotlib; matplotlib.use('Agg')\n" if "matplotlib" in code or "plt" in code else ""

    # Inject security preamble + user code
    security = _SECURITY_PREAMBLE.format(blocked_mods=repr(_BLOCKED_MODULES))
    full_code = security + preamble + code

    try:
        result = subprocess.run(
            [sys.executable, "-c", full_code],
            input=stdin_text.encode() if stdin_text else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=MAX_TIMEOUT,
            preexec_fn=_preexec if os.name != "nt" else None,
            env=_get_safe_env(),
        )

        elapsed = round(time.perf_counter() - start, 3)

        return {
            "execution_id": execution_id,
            "stdout": _truncate(result.stdout.decode(errors="replace")),
            "stderr": _truncate(result.stderr.decode(errors="replace")),
            "status": "success" if result.returncode == 0 else "error",
            "runtime": f"{elapsed}s",
        }

    except subprocess.TimeoutExpired:
        return {
            "execution_id": execution_id,
            "stdout": "",
            "stderr": f"Execution timed out ({MAX_TIMEOUT}s limit)",
            "status": "error",
            "runtime": f"{MAX_TIMEOUT}s",
        }
