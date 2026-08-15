"""
==========================================================
Production Settings
==========================================================

This file contains settings used only in the production
environment.

It imports all common settings from base.py and overrides
only the settings that are different in production.

Never duplicate settings from base.py here.
"""

# Import all common settings.
from .base import *

# ==========================================================
# SECURITY
# ==========================================================

# Debug must always be disabled in production.
DEBUG = False

# ==========================================================
# ALLOWED HOSTS
# ==========================================================
# Replace these with your real domain names later.
#
# Example:
# ALLOWED_HOSTS = [
#     "school.example.com",
#     "www.school.example.com",
# ]
#
# For now we keep localhost so deployment testing is easier.
ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
]