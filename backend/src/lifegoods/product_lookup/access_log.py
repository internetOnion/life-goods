import logging

PRODUCT_LOOKUP_PATH_PREFIX = "/api/v1/products/"


class ProductLookupAccessLogFilter(logging.Filter):
    """Keep Barcodes and Shopper addresses out of access logs.

    Every client address and query string is dropped (image proxy queries carry
    Barcode-bearing URLs); Product Lookup paths are redacted entirely.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        arguments = record.args
        if not isinstance(arguments, tuple) or len(arguments) < 3:
            return True
        path = arguments[2]
        if not isinstance(path, str):
            return True
        path = path.split("?", 1)[0]
        if path.startswith(PRODUCT_LOOKUP_PATH_PREFIX) and path != "/api/v1/products/search":
            path = f"{PRODUCT_LOOKUP_PATH_PREFIX}[redacted]"
        sanitized = list(arguments)
        sanitized[0] = "[redacted]"
        sanitized[2] = path
        record.args = tuple(sanitized)
        return True


product_lookup_access_log_filter = ProductLookupAccessLogFilter()


def install_product_lookup_access_log_filter() -> None:
    access_logger = logging.getLogger("uvicorn.access")
    if product_lookup_access_log_filter not in access_logger.filters:
        access_logger.addFilter(product_lookup_access_log_filter)
