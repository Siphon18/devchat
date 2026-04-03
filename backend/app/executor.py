import os
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import resource as _resource

# Limits
MAX_TIMEOUT = 15          # seconds
MAX_OUTPUT = 50_000       # characters (stdout / stderr each)

# Dangerous modules that user code should never import
_BLOCKED_MODULES = {
    "os", "subprocess", "shutil", "socket", "http", "urllib",
    "ftplib", "smtplib", "ctypes", "multiprocessing", "signal",
    "webbrowser", "code", "codeop", "compileall", "importlib",
    "runpy", "pathlib",
}

SUPPORTED_LANGUAGES = {
    "python",
    "javascript",
    "typescript",
    "java",
    "c",
    "cpp",
    "go",
    "rust",
}

# Security preamble injected before user code to block dangerous operations
_SECURITY_PREAMBLE = '''
import builtins as _builtins

# Block dangerous builtins
_blocked = {{"open", "exec", "eval", "compile", "__import__", "breakpoint"}}
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


def _preexec(memory_limit_mb: int = 256, file_limit_mb: int = 10):
    """Called in the child process before exec – set resource limits."""
    if memory_limit_mb > 0:
        try:
            # Cap virtual memory, but keep it configurable per runtime.
            _resource.setrlimit(
                _resource.RLIMIT_AS,
                (memory_limit_mb * 1024 * 1024, memory_limit_mb * 1024 * 1024),
            )
        except Exception:
            pass
    try:
        _resource.setrlimit(
            _resource.RLIMIT_FSIZE,
            (file_limit_mb * 1024 * 1024, file_limit_mb * 1024 * 1024),
        )
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


def _run_subprocess(
    command: list[str],
    stdin_text: str = "",
    cwd: str | None = None,
    memory_limit_mb: int = 256,
    file_limit_mb: int = 10,
) -> dict:
    execution_id = str(uuid.uuid4())
    start = time.perf_counter()

    try:
        result = subprocess.run(
            command,
            input=stdin_text.encode() if stdin_text else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=MAX_TIMEOUT,
            preexec_fn=(lambda: _preexec(memory_limit_mb, file_limit_mb)) if os.name != "nt" else None,
            env=_get_safe_env(),
            cwd=cwd,
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
    except FileNotFoundError as exc:
        missing = exc.filename or command[0]
        return {
            "execution_id": execution_id,
            "stdout": "",
            "stderr": f"Runtime dependency '{missing}' is not installed on the server.",
            "status": "error",
            "runtime": "0s",
        }


def _prepare_python(code: str, temp_dir: str) -> tuple[list[str], str, str]:
    preamble = "import matplotlib; matplotlib.use('Agg')\n" if "matplotlib" in code or "plt" in code else ""
    security = _SECURITY_PREAMBLE.format(blocked_mods=repr(_BLOCKED_MODULES))
    return [sys.executable, "-c", security + preamble + code], "", ""


def _prepare_javascript(code: str, temp_dir: str) -> tuple[list[str], str, str]:
    source_path = os.path.join(temp_dir, "main.js")
    with open(source_path, "w", encoding="utf-8") as handle:
        handle.write(code)
    return ["node", source_path], temp_dir, ""


def _prepare_typescript(code: str, temp_dir: str) -> tuple[list[str], str, str]:
    source_path = os.path.join(temp_dir, "main.ts")
    with open(source_path, "w", encoding="utf-8") as handle:
        handle.write(code)
    return ["ts-node", "--transpile-only", source_path], temp_dir, ""


def _prepare_java(code: str, temp_dir: str) -> tuple[list[str], str, str]:
    if "class Main" not in code:
        raise ValueError("Java code must declare 'public class Main' as the entry class.")
    source_path = os.path.join(temp_dir, "Main.java")
    with open(source_path, "w", encoding="utf-8") as handle:
        handle.write(code)
    return ["sh", "-c", "javac Main.java && java Main"], temp_dir, ""


def _prepare_c(code: str, temp_dir: str) -> tuple[list[str], str, str]:
    source_path = os.path.join(temp_dir, "main.c")
    output_path = os.path.join(temp_dir, "program")
    with open(source_path, "w", encoding="utf-8") as handle:
        handle.write(code)
    return ["sh", "-c", f"gcc main.c -O2 -o {output_path} && {output_path}"], temp_dir, ""


def _prepare_cpp(code: str, temp_dir: str) -> tuple[list[str], str, str]:
    source_path = os.path.join(temp_dir, "main.cpp")
    output_path = os.path.join(temp_dir, "program")
    with open(source_path, "w", encoding="utf-8") as handle:
        handle.write(code)
    return ["sh", "-c", f"g++ main.cpp -std=c++17 -O2 -o {output_path} && {output_path}"], temp_dir, ""


def _prepare_go(code: str, temp_dir: str) -> tuple[list[str], str, str]:
    source_path = os.path.join(temp_dir, "main.go")
    with open(source_path, "w", encoding="utf-8") as handle:
        handle.write(code)
    return ["go", "run", source_path], temp_dir, ""


def _prepare_rust(code: str, temp_dir: str) -> tuple[list[str], str, str]:
    source_path = os.path.join(temp_dir, "main.rs")
    output_path = os.path.join(temp_dir, "program")
    with open(source_path, "w", encoding="utf-8") as handle:
        handle.write(code)
    return ["sh", "-c", f"rustc main.rs -O -o {output_path} && {output_path}"], temp_dir, ""


_PREPARERS = {
    "python": _prepare_python,
    "javascript": _prepare_javascript,
    "typescript": _prepare_typescript,
    "java": _prepare_java,
    "c": _prepare_c,
    "cpp": _prepare_cpp,
    "go": _prepare_go,
    "rust": _prepare_rust,
}


LANGUAGE_MEMORY_LIMIT_MB = {
    "python": 256,
    "javascript": 0,
    "typescript": 0,
    "java": 0,
    "c": 256,
    "cpp": 256,
    "go": 0,
    "rust": 0,
}

LANGUAGE_FILE_LIMIT_MB = {
    "python": 10,
    "javascript": 32,
    "typescript": 64,
    "java": 64,
    "c": 32,
    "cpp": 32,
    "go": 128,
    "rust": 128,
}


def execute_code(code: str, language: str, stdin_text: str = "") -> dict:
    normalized = (language or "python").strip().lower()
    if normalized not in SUPPORTED_LANGUAGES:
        return {
            "execution_id": str(uuid.uuid4()),
            "stdout": "",
            "stderr": f"Unsupported language '{normalized}'. Supported languages: {', '.join(sorted(SUPPORTED_LANGUAGES))}.",
            "status": "error",
            "runtime": "0s",
        }

    temp_dir = tempfile.mkdtemp(prefix=f"devchat-{normalized}-")
    try:
        command, cwd, _ = _PREPARERS[normalized](code, temp_dir)
        return _run_subprocess(
            command,
            stdin_text=stdin_text,
            cwd=cwd or None,
            memory_limit_mb=LANGUAGE_MEMORY_LIMIT_MB.get(normalized, 256),
            file_limit_mb=LANGUAGE_FILE_LIMIT_MB.get(normalized, 10),
        )
    except ValueError as exc:
        return {
            "execution_id": str(uuid.uuid4()),
            "stdout": "",
            "stderr": str(exc),
            "status": "error",
            "runtime": "0s",
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def execute_python(code: str, stdin_text: str = "") -> dict:
    return execute_code(code=code, language="python", stdin_text=stdin_text)
