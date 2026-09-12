import logging

PRODUCT_LOOKUP_PATH_PREFIX = "/api/v1/products/"


class ProductLookupAccessLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        arguments = record.args
        if not isinstance(arguments, tuple) or len(arguments) < 3:
            return True
        path = arguments[2]
        if not isinstance(path, str):
            return True
        if path.startswith("/api/v1/products/search"):
            sanitized = list(arguments)
            sanitized[0] = "[redacted]"
            sanitized[2] = "/api/v1/products/search"
            record.args = tuple(sanitized)
            return True
        if not path.startswith(PRODUCT_LOOKUP_PATH_PREFIX):
            return True
        sanitized = list(arguments)
        sanitized[0] = "[redacted]"
        sanitized[2] = f"{PRODUCT_LOOKUP_PATH_PREFIX}[redacted]"
        record.args = tuple(sanitized)
        return True


product_lookup_access_log_filter = ProductLookupAccessLogFilter()


def install_product_lookup_access_log_filter() -> None:
    access_logger = logging.getLogger("uvicorn.access")
    if product_lookup_access_log_filter not in access_logger.filters:
        access_logger.addFilter(product_lookup_access_log_filter)
