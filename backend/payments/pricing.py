from dataclasses import dataclass

from django.core.cache import cache

from .models import PricingConfig


FALLBACK_MATCH_PRICE_PAISE = 3900
FALLBACK_MONTHLY_PRICE_PAISE = 49900
ACTIVE_PRICING_CACHE_KEY = "payments.active_pricing"
ACTIVE_PRICING_CACHE_TTL_SECONDS = 300


@dataclass(frozen=True)
class ActivePricing:
	match_price: int
	monthly_price: int


def _fallback_pricing() -> ActivePricing:
	return ActivePricing(
		match_price=FALLBACK_MATCH_PRICE_PAISE,
		monthly_price=FALLBACK_MONTHLY_PRICE_PAISE,
	)


def clear_active_pricing_cache() -> None:
	cache.delete(ACTIVE_PRICING_CACHE_KEY)


def get_active_pricing() -> ActivePricing:
	cached_pricing = cache.get(ACTIVE_PRICING_CACHE_KEY)
	if isinstance(cached_pricing, dict):
		match_price = cached_pricing.get("match_price")
		monthly_price = cached_pricing.get("monthly_price")
		if isinstance(match_price, int) and isinstance(monthly_price, int):
			return ActivePricing(match_price=match_price, monthly_price=monthly_price)

	active_config = PricingConfig.objects.filter(is_active=True).order_by("-created_at", "-id").first()
	if not active_config:
		pricing = _fallback_pricing()
	else:
		pricing = ActivePricing(
			match_price=int(active_config.match_price),
			monthly_price=int(active_config.monthly_price),
		)

	cache.set(
		ACTIVE_PRICING_CACHE_KEY,
		{"match_price": pricing.match_price, "monthly_price": pricing.monthly_price},
		ACTIVE_PRICING_CACHE_TTL_SECONDS,
	)
	return pricing
