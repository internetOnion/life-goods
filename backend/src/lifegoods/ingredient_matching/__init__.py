"""Experimental ingredient taxonomy matching for Scalar verification."""

from lifegoods.ingredient_matching.models import IngredientMatcher
from lifegoods.ingredient_matching.router import get_ingredient_matcher, router

__all__ = ["IngredientMatcher", "get_ingredient_matcher", "router"]
