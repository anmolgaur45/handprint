"""Vertex AI Gemini Client for Natural Language processing and carbon narration."""

from __future__ import annotations

import json
from typing import Any

import anyio
import anyio.to_thread
import structlog
import vertexai
from vertexai.generative_models import GenerationConfig, GenerativeModel

logger = structlog.get_logger(__name__)


class VertexClient:
    """Integration client for Vertex AI Gemini services.

    Provides natural language parsing and context-aware carbon narration.
    """

    def __init__(self, project_id: str, location: str, model_name: str) -> None:
        self.project_id = project_id
        self.location = location
        self.model_name = model_name
        self._initialized = False

    def _ensure_initialized(self) -> None:
        """Initialize the Vertex AI SDK on demand."""
        if not self._initialized:
            try:
                vertexai.init(project=self.project_id, location=self.location)
                self._initialized = True
            except Exception as e:
                logger.error("Failed to initialize Vertex AI SDK", error=str(e))
                raise RuntimeError(f"Vertex AI initialization failed: {e}") from e

    async def parse_trip(self, user_text: str) -> dict[str, Any]:
        """Extract structured trip inputs (origin, destination, mode) from free-form text.

        Returns a dictionary with keys: origin, destination, mode.
        """
        self._ensure_initialized()

        prompt = (
            "You are a precise transit extractor. Analyze the user's description of a journey "
            "and extract the origin, destination, and transport mode.\n\n"
            "Allowed modes of transport:\n"
            "- 'petrol_car', 'diesel_car', 'ev_car', 'hybrid_car', 'motorbike'\n"
            "- 'bus', 'train', 'metro', 'bicycle', 'walking'\n\n"
            "Return a JSON object with this exact structure:\n"
            "{\n"
            '  "origin": "starting city/address or null",\n'
            '  "destination": "ending city/address or null",\n'
            '  "mode": "one of the allowed transport modes as a string, or null"\n'
            "}\n\n"
            f'User text: "{user_text}"\n'
        )

        try:
            model = GenerativeModel(self.model_name)
            config = GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,
            )
            # Run in thread pool as GenerateContent is synchronous
            response = await anyio.to_thread.run_sync(
                lambda: model.generate_content(prompt, generation_config=config)
            )

            if not response.text:
                raise ValueError("Empty response received from Gemini")

            data: dict[str, Any] = json.loads(response.text)

            # Map/validate keys
            return {
                "origin": data.get("origin"),
                "destination": data.get("destination"),
                "mode": data.get("mode"),
            }
        except Exception as e:
            logger.error("Failed to parse trip using Gemini", error=str(e))
            raise ValueError(f"Gemini trip parsing failed: {e}") from e

    async def narrate_insights(
        self,
        total_co2e: float,
        category_breakdown: dict[str, float],
        commitments: list[dict[str, Any]],
    ) -> str:
        """Generate a narrative summary of the user's carbon footprint.

        CRITICAL DESIGN RULE: The narration must only discuss the pre-calculated numbers
        supplied in the prompt. It MUST NOT compute or extrapolate any new emissions numbers.
        """
        self._ensure_initialized()

        commitments_summary = (
            ", ".join([f"{c.get('title')} ({c.get('status')})" for c in commitments]) or "None"
        )

        prompt = (
            "You are Handprint's carbon insights narrator. "
            "Summarize the user's carbon footprint profile "
            "in 2-3 encouraging, context-aware sentences.\n\n"
            "Supply-side metrics (DO NOT calculate, extrapolate, or invent other numbers):\n"
            f"- Total Footprint: {total_co2e:.1f} kg CO2e\n"
            f"- Transport: {category_breakdown.get('transport', 0.0):.1f} kg CO2e\n"
            f"- Food: {category_breakdown.get('food', 0.0):.1f} kg CO2e\n"
            f"- Home Energy: {category_breakdown.get('energy', 0.0):.1f} kg CO2e\n"
            f"- Active Pledges: {commitments_summary}\n\n"
            "Strict Guidelines:\n"
            "1. Discuss ONLY the numbers provided above. "
            "Never invent, extrapolate, or compute other metrics.\n"
            "2. Offer a brief, practical reduction suggestion "
            "matched to their highest emission category.\n"
            "3. Keep the tone scientific, terse, and encouraging."
        )

        try:
            model = GenerativeModel(self.model_name)
            response = await anyio.to_thread.run_sync(lambda: model.generate_content(prompt))

            if not response.text:
                raise ValueError("Empty narration received from Gemini")

            return response.text.strip()
        except Exception as e:
            logger.error("Failed to narrate insights using Gemini", error=str(e))
            raise ValueError(f"Gemini narration failed: {e}") from e
