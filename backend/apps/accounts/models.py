"""
Compatibility module.

Django expects a models.py file by default.

We keep this file and re-export models from the
models package.
"""

from .models import *