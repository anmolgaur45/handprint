import httpx


class PlacesClient:
    """Integration client for Google Maps Places and Geocoding APIs.

    Uses constructor dependency injection.
    """

    def __init__(self, api_key: str, http_client: httpx.AsyncClient) -> None:
        self.api_key = api_key
        self.http_client = http_client
