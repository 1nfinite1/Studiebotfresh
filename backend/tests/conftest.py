import os, sys
from pathlib import Path

# Ensure '/app/backend' (repo backend root) is on sys.path so 'import app' works
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))