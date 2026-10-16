import logging
import sys
from logging.config import dictConfig


def setup_logging(log_level: str = "INFO") -> None:
    """
    Configures standard structured logging across the application.
    """
    normalized_level = log_level.upper()

    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
                "formatter": "default",
                "level": normalized_level,
            },
        },
        "root": {
            "handlers": ["console"],
            "level": normalized_level,
        },
        "loggers": {
            # Silence noisy third-party loggers
            "uvicorn": {"handlers": ["console"], "level": "INFO", "propagate": False},
            "uvicorn.access": {"handlers": ["console"], "level": "WARNING", "propagate": False},
            "sqlalchemy.engine": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        },
    }

    dictConfig(logging_config)
