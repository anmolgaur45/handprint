import httpx


class DistanceMatrixClient:
    """Integration client for Google Maps Distance Matrix API.

    Uses constructor dependency injection.
    """

    def __init__(self, api_key: str, http_client: httpx.AsyncClient) -> None:
        self.api_key = api_key
        self.http_client = http_client
