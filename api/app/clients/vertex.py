class VertexClient:
    """Integration client for Vertex AI Gemini services.

    Uses constructor dependency injection.
    """

    def __init__(self, project_id: str, location: str, model_name: str) -> None:
        self.project_id = project_id
        self.location = location
        self.model_name = model_name
