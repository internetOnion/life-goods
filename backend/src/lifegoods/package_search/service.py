from lifegoods.open_food_facts.models import (
    ExternalPackageSearchPage,
    ExternalPackageSearchSource,
)


class SearchPackages:
    def __init__(self, source: ExternalPackageSearchSource) -> None:
        self._source = source

    def execute(
        self,
        query: str,
        *,
        offset: int,
        limit: int,
    ) -> ExternalPackageSearchPage:
        return self._source.search(query, offset=offset, limit=limit)
