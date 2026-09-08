import logging

PRODUCT_LOOKUP_PATH_PREFIXES = (
    "/api/v1/products/",
    "/api/experimental/products/",
)
PRODUCT_LOOKUP_PATH_PREFIX = "/api/experimental/products/"
REDACTED_PRODUCT_LOOKUP_PATH = f"{PRODUCT_LOOKUP_PATH_PREFIX}[redacted]"


class ProductLookupAccessLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        arguments = record.args
        if not isinstance(arguments, tuple) or len(arguments) < 3:
            return True
        path = arguments[2]
        if not isinstance(path, str):
            return True
        matched_prefix = next(
            (
                prefix
                for prefix in PRODUCT_LOOKUP_PATH_PREFIXES
                if path.startswith(prefix)
            ),
            None,
        )
        if matched_prefix is None:
            return True
        sanitized = list(arguments)
        sanitized[0] = "[redacted]"
        sanitized[2] = f"{matched_prefix}[redacted]"
        record.args = tuple(sanitized)
        return True


product_lookup_access_log_filter = ProductLookupAccessLogFilter()


def install_product_lookup_access_log_filter() -> None:
    access_logger = logging.getLogger("uvicorn.access")
    if product_lookup_access_log_filter not in access_logger.filters:
        access_logger.addFilter(product_lookup_access_log_filter)
