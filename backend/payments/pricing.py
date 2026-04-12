from dataclasses import dataclass

from django.core.cache import cache

from .models import PricingConfig


FALLBACK_MATCH_PRICE_PAISE = 3900
FALLBACK_WEEKLY_PRICE_PAISE = 12900
FALLBACK_WEEKLY_ORIGINAL_PRICE_PAISE = 19900
FALLBACK_MONTHLY_PRICE_PAISE = 49900
FALLBACK_MONTHLY_ORIGINAL_PRICE_PAISE = 49900
FALLBACK_ENABLE_WEEKLY = True
FALLBACK_ENABLE_MONTHLY = True
FALLBACK_ENABLE_MATCH = False
FALLBACK_WEEKLY_OFFER_ACTIVE = True
FALLBACK_MONTHLY_OFFER_ACTIVE = False
ACTIVE_PRICING_CACHE_KEY = "payments.active_pricing"
ACTIVE_PRICING_CACHE_TTL_SECONDS = 300


@dataclass(frozen=True)
class ActivePricing:
	match_price: int
	weekly_price: int
	weekly_original_price: int
	monthly_price: int
	monthly_original_price: int
	enable_weekly: bool
	enable_monthly: bool
	enable_match: bool
	weekly_offer_active: bool
	monthly_offer_active: bool


def _fallback_pricing() -> ActivePricing:
	return ActivePricing(
		match_price=FALLBACK_MATCH_PRICE_PAISE,
		weekly_price=FALLBACK_WEEKLY_PRICE_PAISE,
		weekly_original_price=FALLBACK_WEEKLY_ORIGINAL_PRICE_PAISE,
		monthly_price=FALLBACK_MONTHLY_PRICE_PAISE,
		monthly_original_price=FALLBACK_MONTHLY_ORIGINAL_PRICE_PAISE,
		enable_weekly=FALLBACK_ENABLE_WEEKLY,
		enable_monthly=FALLBACK_ENABLE_MONTHLY,
		enable_match=FALLBACK_ENABLE_MATCH,
		weekly_offer_active=FALLBACK_WEEKLY_OFFER_ACTIVE,
		monthly_offer_active=FALLBACK_MONTHLY_OFFER_ACTIVE,
	)


def clear_active_pricing_cache() -> None:
	cache.delete(ACTIVE_PRICING_CACHE_KEY)


def get_active_pricing() -> ActivePricing:
	cached_pricing = cache.get(ACTIVE_PRICING_CACHE_KEY)
	if isinstance(cached_pricing, dict):
		match_price = cached_pricing.get("match_price")
		weekly_price = cached_pricing.get("weekly_price")
		weekly_original_price = cached_pricing.get("weekly_original_price")
		monthly_price = cached_pricing.get("monthly_price")
		monthly_original_price = cached_pricing.get("monthly_original_price")
		enable_weekly = cached_pricing.get("enable_weekly")
		enable_monthly = cached_pricing.get("enable_monthly")
		enable_match = cached_pricing.get("enable_match")
		weekly_offer_active = cached_pricing.get("weekly_offer_active")
		monthly_offer_active = cached_pricing.get("monthly_offer_active")
		if (
			isinstance(match_price, int)
			and isinstance(weekly_price, int)
			and isinstance(weekly_original_price, int)
			and isinstance(monthly_price, int)
			and isinstance(monthly_original_price, int)
			and isinstance(enable_weekly, bool)
			and isinstance(enable_monthly, bool)
			and isinstance(enable_match, bool)
			and isinstance(weekly_offer_active, bool)
			and isinstance(monthly_offer_active, bool)
		):
			return ActivePricing(
				match_price=match_price,
				weekly_price=weekly_price,
				weekly_original_price=weekly_original_price,
				monthly_price=monthly_price,
				monthly_original_price=monthly_original_price,
				enable_weekly=enable_weekly,
				enable_monthly=enable_monthly,
				enable_match=enable_match,
				weekly_offer_active=weekly_offer_active,
				monthly_offer_active=monthly_offer_active,
			)

	active_config = PricingConfig.objects.filter(is_active=True).order_by("-created_at", "-id").first()
	if not active_config:
		pricing = _fallback_pricing()
	else:
		pricing = ActivePricing(
			match_price=int(active_config.match_price),
			weekly_price=int(active_config.weekly_price),
			weekly_original_price=int(active_config.weekly_original_price),
			monthly_price=int(active_config.monthly_price),
			monthly_original_price=int(active_config.monthly_original_price),
			enable_weekly=bool(active_config.enable_weekly),
			enable_monthly=bool(active_config.enable_monthly),
			enable_match=bool(active_config.enable_match),
			weekly_offer_active=bool(active_config.weekly_offer_active),
			monthly_offer_active=bool(active_config.monthly_offer_active),
		)

	cache.set(
		ACTIVE_PRICING_CACHE_KEY,
		{
			"match_price": pricing.match_price,
			"weekly_price": pricing.weekly_price,
			"weekly_original_price": pricing.weekly_original_price,
			"monthly_price": pricing.monthly_price,
			"monthly_original_price": pricing.monthly_original_price,
			"enable_weekly": pricing.enable_weekly,
			"enable_monthly": pricing.enable_monthly,
			"enable_match": pricing.enable_match,
			"weekly_offer_active": pricing.weekly_offer_active,
			"monthly_offer_active": pricing.monthly_offer_active,
		},
		ACTIVE_PRICING_CACHE_TTL_SECONDS,
	)
	return pricing
