import httpx


class AirQualityClient:
    """Integration client for Google Air Quality API.

    Uses constructor dependency injection.
    """

    def __init__(self, api_key: str, http_client: httpx.AsyncClient) -> None:
        self.api_key = api_key
        self.http_client = http_client
