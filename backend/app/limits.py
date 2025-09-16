from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared limiter instance used by app and routers
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])  # 60 req/min per IP