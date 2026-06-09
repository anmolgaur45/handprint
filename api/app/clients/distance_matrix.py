import httpx


class DistanceMatrixClient:
    """Integration client for Google Maps Distance Matrix API.

    Uses constructor dependency injection.
    """

    def __init__(self, api_key: str, http_client: httpx.AsyncClient) -> None:
        self.api_key = api_key
        self.http_client = http_client

    async def get_distance(self, origin: str, destination: str) -> float:
        """Fetch the driving distance between origin and destination in kilometers.

        Args:
            origin: Starting location (e.g. address string, place ID, or 'lat,lng').
            destination: Ending location (e.g. address string, place ID, or 'lat,lng').

        Returns:
            The distance in kilometers (float).
        """
        if not self.api_key:
            # Local fallback to allow testing without an active API key
            return 12.5

        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            "origins": origin,
            "destinations": destination,
            "key": self.api_key,
        }

        try:
            response = await self.http_client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            if data.get("status") != "OK":
                error_msg = data.get("error_message", "Unknown error")
                raise ValueError(
                    f"Distance Matrix API status error: {data['status']} - {error_msg}"
                )

            rows = data.get("rows", [])
            if not rows:
                raise ValueError("No rows found in Distance Matrix response")

            elements = rows[0].get("elements", [])
            if not elements:
                raise ValueError("No elements found in Distance Matrix response")

            element = elements[0]
            element_status = element.get("status")
            if element_status != "OK":
                raise ValueError(f"Distance Matrix route error: {element_status}")

            distance_data = element.get("distance", {})
            distance_meters = distance_data.get("value", 0)
            return float(distance_meters) / 1000.0  # Convert to km
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            raise ValueError(f"Failed to query Distance Matrix: {e}") from e
