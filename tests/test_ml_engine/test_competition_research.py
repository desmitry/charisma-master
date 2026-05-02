"""Tests for the competition research agent."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from charisma_schemas import AnalyzeProvider


class TestCompetitionResearchAgent:
    @pytest.mark.asyncio
    async def test_returns_empty_when_product_not_identified(
        self, competition_research_module
    ):
        llm_client = MagicMock()
        llm_client.identify_competition_subject = AsyncMock(
            return_value={
                "can_identify": False,
                "product_name": "",
                "product_description": "",
                "search_query": "",
            }
        )
        llm_client.synthesize_competition_report = AsyncMock(return_value="")

        agent = competition_research_module.CompetitionResearchAgent(
            llm_client=llm_client
        )
        agent._build_graph = MagicMock(return_value=None)

        result = await agent.run(
            transcript_text="text",
            presentation_text="slides",
            provider=AnalyzeProvider.openai,
        )

        assert result == ""
        llm_client.identify_competition_subject.assert_awaited_once()
        llm_client.synthesize_competition_report.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_happy_path_synthesizes_report(
        self, competition_research_module
    ):
        llm_client = MagicMock()
        llm_client.identify_competition_subject = AsyncMock(
            return_value={
                "can_identify": True,
                "product_name": "Acme CRM",
                "product_description": "CRM for small sales teams",
                "search_query": "Acme CRM competitors",
            }
        )
        llm_client.analyze_competition_source = AsyncMock(
            side_effect=[
                {
                    "is_relevant": True,
                    "competitor_name": "BetaCRM",
                    "summary": "Competes for the same SMB sales teams.",
                    "evidence": "Offers pipeline automation for SMB sales.",
                    "source_url": "https://example.com/beta",
                    "source_title": "BetaCRM",
                },
                {
                    "is_relevant": False,
                    "competitor_name": "",
                    "summary": "",
                    "evidence": "",
                    "source_url": "https://example.com/other",
                    "source_title": "Other",
                },
            ]
        )
        llm_client.synthesize_competition_report = AsyncMock(
            return_value="BetaCRM appears to be the closest direct competitor."
        )

        agent = competition_research_module.CompetitionResearchAgent(
            llm_client=llm_client
        )
        agent._build_graph = MagicMock(return_value=None)
        agent._search_sources = AsyncMock(
            return_value=[
                {"title": "BetaCRM", "url": "https://example.com/beta"},
                {"title": "Other", "url": "https://example.com/other"},
            ]
        )
        agent._fetch_source_text = MagicMock(
            side_effect=[
                "BetaCRM is a CRM platform for small sales teams.",
                "This page is unrelated.",
            ]
        )

        result = await agent.run(
            transcript_text="text",
            presentation_text="slides",
            provider=AnalyzeProvider.openai,
        )

        assert (
            result
            == "BetaCRM appears to be the closest direct competitor."
        )
        llm_client.synthesize_competition_report.assert_awaited_once()
        synth_kwargs = (
            llm_client.synthesize_competition_report.await_args.kwargs
        )
        assert synth_kwargs["product_name"] == "Acme CRM"
        assert len(synth_kwargs["source_reviews"]) == 1
        assert (
            synth_kwargs["source_reviews"][0]["competitor_name"] == "BetaCRM"
        )
