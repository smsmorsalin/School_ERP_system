"""Provider-agnostic online payment gateway catalogue.

The school accepts online fee payments through mobile banking, cards and bank
transfers. Real gateways require merchant onboarding and hosted checkout
credentials, so this module describes the methods instead of hard-coding one
provider. The sandbox adapter in :mod:`apps.finance.payment_service` simulates
the hosted page until live credentials are configured.

No card number, PIN, OTP or mobile-banking credential is ever accepted by this
application. The browser is sent to the provider's hosted page (or the local
sandbox page) and only a provider transaction reference comes back.
"""

from __future__ import annotations

from typing import Any

# ``ledger_method`` maps an online gateway to the existing ``Payment.method``
# choices so the finance ledger, receipts and collection reports stay
# consistent for cash, card, bank and mobile-money payments.
GATEWAYS: tuple[dict[str, Any], ...] = (
    {
        "code": "bkash",
        "label": "bKash",
        "category": "mobile_banking",
        "category_label": "Mobile banking",
        "ledger_method": "mobile_money",
        "account_label": "bKash account number",
        "description": "Pay from your bKash mobile wallet.",
        "brand_color": "#e2136e",
        "initials": "bK",
        "requires_redirect": True,
    },
    {
        "code": "nagad",
        "label": "Nagad",
        "category": "mobile_banking",
        "category_label": "Mobile banking",
        "ledger_method": "mobile_money",
        "account_label": "Nagad account number",
        "description": "Pay from your Nagad mobile wallet.",
        "brand_color": "#f15a22",
        "initials": "Na",
        "requires_redirect": True,
    },
    {
        "code": "rocket",
        "label": "Rocket",
        "category": "mobile_banking",
        "category_label": "Mobile banking",
        "ledger_method": "mobile_money",
        "account_label": "Rocket account number",
        "description": "Pay from your Rocket (DBBL) mobile wallet.",
        "brand_color": "#8c3494",
        "initials": "Ro",
        "requires_redirect": True,
    },
    {
        "code": "mobile_banking",
        "label": "Other mobile banking",
        "category": "mobile_banking",
        "category_label": "Mobile banking",
        "ledger_method": "mobile_money",
        "account_label": "Mobile wallet number",
        "description": "Use another mobile banking or wallet provider.",
        "brand_color": "#0ea5e9",
        "initials": "MB",
        "requires_redirect": True,
    },
    {
        "code": "card",
        "label": "Debit / credit card",
        "category": "card",
        "category_label": "Cards",
        "ledger_method": "card",
        "account_label": "Card ending",
        "description": "Visa, Mastercard, American Express and other cards.",
        "brand_color": "#1e3a8a",
        "initials": "CC",
        "requires_redirect": True,
    },
    {
        "code": "bank",
        "label": "Bank transfer",
        "category": "bank",
        "category_label": "Bank",
        "ledger_method": "bank_transfer",
        "account_label": "Bank account ending",
        "description": "Pay through internet banking or a bank transfer.",
        "brand_color": "#0f766e",
        "initials": "BK",
        "requires_redirect": True,
    },
)

GATEWAY_BY_CODE: dict[str, dict[str, Any]] = {gateway["code"]: gateway for gateway in GATEWAYS}

GATEWAY_CHOICES: tuple[tuple[str, str], ...] = tuple(
    (gateway["code"], gateway["label"]) for gateway in GATEWAYS
)

GATEWAY_CODES: frozenset[str] = frozenset(GATEWAY_BY_CODE)


def gateway_catalogue(*, sandbox: bool) -> list[dict[str, Any]]:
    """Return public gateway metadata (never secrets or merchant ids)."""
    mode = "sandbox" if sandbox else "live"
    return [
        {**gateway, "mode": mode}
        for gateway in GATEWAYS
    ]


def gateway_is_valid(code: str) -> bool:
    return code in GATEWAY_BY_CODE


def ledger_method_for(code: str) -> str:
    return GATEWAY_BY_CODE[code]["ledger_method"]


def gateway_label(code: str) -> str:
    gateway = GATEWAY_BY_CODE.get(code)
    return gateway["label"] if gateway else code
