"""
conftest.py - Pytest Configuration and Path Setup
Ensures the project root directory is available in sys.path during test execution.
"""

import sys
import os

# Add project root directory to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
