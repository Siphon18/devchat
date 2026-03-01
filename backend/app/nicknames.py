import random

# Word pools for generating cool dev-themed nicknames
_ADJECTIVES = [
    "Async", "Binary", "Cosmic", "Dark", "Electric", "Fuzzy", "Ghost",
    "Hidden", "Infinite", "Jaded", "Kinetic", "Laser", "Mystic", "Neon",
    "Orbital", "Phantom", "Quantum", "Rogue", "Silent", "Turbo",
    "Ultra", "Void", "Wired", "Xero", "Zero", "Blazing", "Cryptic",
    "Digital", "Epic", "Frozen", "Glitch", "Hyper", "Iron", "Jet",
    "Kernel", "Lunar", "Matrix", "Nano", "Omega", "Pixel", "Rapid",
    "Shadow", "Toxic", "Unreal", "Vector", "Wild", "Xenon",
]

_NOUNS = [
    "Archer", "Bandit", "Cipher", "Daemon", "Echo", "Flux", "Ghost",
    "Hacker", "Invoke", "Jinx", "Kernel", "Lambda", "Maverick", "Node",
    "Oracle", "Proxy", "Qubit", "Raven", "Socket", "Token",
    "Uint", "Vertex", "Watcher", "Exploit", "Yakuza", "Zenith",
    "Algorithm", "Boolean", "Compiler", "Debug", "Encoder", "Firewall",
    "Gateway", "Hash", "Iterator", "JSON", "Keystroke", "Loop",
    "Mutex", "Nibble", "Operator", "Parser", "Queue", "Runner",
    "Stack", "Thread", "Union", "Variable", "Webhook",
]


def generate_nickname() -> str:
    """Generate a random cool dev-themed nickname like 'QuantumRaven' or 'NeonKernel'."""
    adj  = random.choice(_ADJECTIVES)
    noun = random.choice(_NOUNS)
    return f"{adj}{noun}"
