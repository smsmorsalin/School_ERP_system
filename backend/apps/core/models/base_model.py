"""
==========================================================
Base Model
==========================================================

Purpose:
    Provide common fields that are shared by most database
    models in the School ERP.

Why?

Instead of repeating:

    created_at
    updated_at
    uuid
    is_active

inside every model, we inherit from BaseModel.

Benefits:
    ✔ Less duplicated code
    ✔ Easier maintenance
    ✔ Consistent database design
"""

import uuid

from django.db import models


class BaseModel(models.Model):
    """
    Abstract base model.

    Django will NOT create a database table for this model.
    Other models inherit from it.
    """

    # ------------------------------------------------------
    # Public Identifier
    # ------------------------------------------------------
    # UUIDs are safe to expose in APIs and URLs because
    # they are not sequential like integer IDs.
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        db_index=True,
        help_text="Public unique identifier."
    )

    # ------------------------------------------------------
    # Record Status
    # ------------------------------------------------------
    # Soft delete support.
    # Instead of deleting records, we deactivate them.
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Indicates whether this record is active."
    )

    # ------------------------------------------------------
    # Audit Fields
    # ------------------------------------------------------
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Date and time when the record was created."
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Date and time when the record was last updated."
    )

    class Meta:
        """
        Mark this model as abstract.

        No database table will be created.
        """

        abstract = True