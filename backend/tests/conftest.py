import os

os.environ["TESTING"] = "true"
os.environ["TRIAGE_PROVIDER"] = "simulated"

from app.settings import get_settings

get_settings.cache_clear()
