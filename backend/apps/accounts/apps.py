"""
==========================================================
Accounts Application Configuration
==========================================================

This file tells Django how to register the accounts app.

Every Django application contains an AppConfig class.
"""

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """
    Configuration for the Accounts app.
    """

    default_auto_field = "django.db.models.BigAutoField"

    # Python path to the app
    name = "apps.accounts"