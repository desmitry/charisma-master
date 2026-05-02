import asyncio
import logging
import re
from html import unescape
from html.parser import HTMLParser
from typing import Any, TypedDict

import requests
from charisma_schemas import AnalyzeProvider

from app.config import settings
from app.logic.llm_client import LLMClient

logger = logging.getLogger(__name__)


class CompetitionResearchState(TypedDict, total=False):
    transcript_text: str
    presentation_text: str
    provider: AnalyzeProvider
    can_identify: bool
    product_name: str
    product_description: str
    search_query: str
    search_results: list[dict[str, str]]
    source_reviews: list[dict[str, Any]]
    competition_analysis: str


class _HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._ignored_tags = {"script", "style", "noscript"}
        self._ignored_depth = 0
        self._chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        del attrs
        if tag in self._ignored_tags:
            self._ignored_depth += 1

    def handle_endtag(self, tag: str):
        if tag in self._ignored_tags and self._ignored_depth > 0:
            self._ignored_depth -= 1

    def handle_data(self, data: str):
        if self._ignored_depth > 0:
            return
        cleaned = re.sub(r"\s+", " ", data).strip()
        if cleaned:
            self._chunks.append(cleaned)

    def get_text(self) -> str:
        return unescape(" ".join(self._chunks)).strip()


class CompetitionResearchAgent:
    """Competition research pipeline built around LangGraph-style stages."""

    def __init__(
        self,
        llm_client: LLMClient | None = None,
        session: requests.Session | None = None,
    ):
        self.llm_client = llm_client or LLMClient()
        self.session = session or requests.Session()
        self.session.headers.setdefault(
            "User-Agent", "CharismaCompetitionResearch/1.0"
        )

    async def run(
        self,
        transcript_text: str,
        presentation_text: str,
        provider: AnalyzeProvider,
    ) -> str:
        initial_state: CompetitionResearchState = {
            "transcript_text": transcript_text,
            "presentation_text": presentation_text,
            "provider": provider,
        }

        graph = self._build_graph()
        if graph is not None:
            try:
                result = await graph.ainvoke(initial_state)
                return str(result.get("competition_analysis", "")).strip()
            except Exception:
                logger.warning(
                    "Competition research graph failed, "
                    "using sequential fallback",
                    exc_info=True,
                )

        state = await self._run_sequential(initial_state)
        return str(state.get("competition_analysis", "")).strip()

    def _build_graph(self):
        try:
            from langgraph.graph import END, StateGraph
        except ImportError:
            logger.info(
                "LangGraph is unavailable, "
                "competition research will run sequentially"
            )
            return None

        workflow = StateGraph(CompetitionResearchState)  # ty:ignore[invalid-argument-type]
        workflow.add_node("identify_product", self._identify_product_node)
        workflow.add_node("search_sources", self._search_sources_node)
        workflow.add_node("analyze_sources", self._analyze_sources_node)
        workflow.add_node("synthesize_report", self._synthesize_report_node)

        workflow.set_entry_point("identify_product")
        workflow.add_conditional_edges(
            "identify_product",
            self._route_after_identify,
            {"search_sources": "search_sources", "end": END},
        )
        workflow.add_conditional_edges(
            "search_sources",
            self._route_after_search,
            {"analyze_sources": "analyze_sources", "end": END},
        )
        workflow.add_conditional_edges(
            "analyze_sources",
            self._route_after_source_review,
            {"synthesize_report": "synthesize_report", "end": END},
        )
        workflow.add_edge("synthesize_report", END)
        return workflow.compile()

    async def _run_sequential(
        self, state: CompetitionResearchState
    ) -> CompetitionResearchState:
        state.update(await self._identify_product_node(state))  # ty:ignore[invalid-argument-type]
        if self._route_after_identify(state) == "end":
            return state

        state.update(await self._search_sources_node(state))  # ty:ignore[invalid-argument-type]
        if self._route_after_search(state) == "end":
            return state

        state.update(await self._analyze_sources_node(state))  # ty:ignore[invalid-argument-type]
        if self._route_after_source_review(state) == "end":
            return state

        state.update(await self._synthesize_report_node(state))  # ty:ignore[invalid-argument-type]
        return state

    async def _identify_product_node(
        self, state: CompetitionResearchState
    ) -> dict[str, Any]:
        subject = await self.llm_client.identify_competition_subject(
            transcript_text=state["transcript_text"],
            presentation_text=state["presentation_text"],
            provider=state["provider"],
        )
        return {
            "can_identify": subject["can_identify"],
            "product_name": subject["product_name"],
            "product_description": subject["product_description"],
            "search_query": subject["search_query"],
        }

    async def _search_sources_node(
        self, state: CompetitionResearchState
    ) -> dict[str, list[dict[str, str]]]:
        search_query = state.get("search_query", "").strip()
        if not search_query:
            return {"search_results": []}
        search_results = await self._search_sources(search_query)
        return {"search_results": search_results}

    async def _analyze_sources_node(
        self, state: CompetitionResearchState
    ) -> dict[str, list[dict[str, Any]]]:
        source_reviews = await self._analyze_sources(
            product_name=state.get("product_name", ""),
            product_description=state.get("product_description", ""),
            search_results=state.get("search_results", []),
            provider=state["provider"],
        )
        return {"source_reviews": source_reviews}

    async def _synthesize_report_node(
        self, state: CompetitionResearchState
    ) -> dict[str, str]:
        competition_analysis = (
            await self.llm_client.synthesize_competition_report(
                product_name=state.get("product_name", ""),
                product_description=state.get("product_description", ""),
                source_reviews=state.get("source_reviews", []),
                provider=state["provider"],
            )
        )
        return {"competition_analysis": competition_analysis}

    @staticmethod
    def _route_after_identify(state: CompetitionResearchState) -> str:
        if state.get("can_identify"):
            return "search_sources"
        return "end"

    @staticmethod
    def _route_after_search(state: CompetitionResearchState) -> str:
        if state.get("search_results"):
            return "analyze_sources"
        return "end"

    @staticmethod
    def _route_after_source_review(state: CompetitionResearchState) -> str:
        if state.get("source_reviews"):
            return "synthesize_report"
        return "end"

    async def _search_sources(self, query: str) -> list[dict[str, str]]:
        return await asyncio.to_thread(self._search_sources_sync, query)

    def _search_sources_sync(self, query: str) -> list[dict[str, str]]:
        results = self._search_sources_with_langchain(query)
        if not results:
            results = self._search_sources_with_ddgs(query)
        return self._normalize_search_results(results)

    def _search_sources_with_langchain(
        self, query: str
    ) -> list[dict[str, Any]]:
        try:
            from langchain_community.utilities import (
                DuckDuckGoSearchAPIWrapper,
            )
        except ImportError:
            logger.warning(
                "langchain_community is unavailable, "
                "competition search via LangChain will be skipped"
            )
            return []

        wrapper = DuckDuckGoSearchAPIWrapper()
        max_results = settings.competition_search_results

        try:
            return wrapper.results(query, max_results=max_results)
        except TypeError:
            try:
                return wrapper.results(
                    query, max_results=max_results, source="text"
                )
            except Exception:
                logger.warning(
                    "DuckDuckGo search via LangChain failed", exc_info=True
                )
                return []
        except Exception:
            logger.warning(
                "DuckDuckGo search via LangChain failed", exc_info=True
            )
            return []

    def _search_sources_with_ddgs(self, query: str) -> list[dict[str, Any]]:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            logger.warning(
                "duckduckgo-search is unavailable, competition search skipped"
            )
            return []

        try:
            with DDGS() as ddgs:
                return list(
                    ddgs.text(
                        query, max_results=settings.competition_search_results
                    )
                )
        except Exception:
            logger.warning("DuckDuckGo direct search failed", exc_info=True)
            return []

    def _normalize_search_results(
        self, raw_results: list[dict[str, Any]]
    ) -> list[dict[str, str]]:
        normalized: list[dict[str, str]] = []
        seen_urls: set[str] = set()

        for item in raw_results:
            source_url = str(item.get("link") or item.get("url") or "").strip()
            if not source_url or source_url in seen_urls:
                continue
            if not source_url.startswith(("http://", "https://")):
                continue

            seen_urls.add(source_url)
            normalized.append(
                {
                    "title": str(
                        item.get("title") or item.get("heading") or source_url
                    ).strip(),
                    "url": source_url,
                    "snippet": str(
                        item.get("snippet") or item.get("body") or ""
                    ).strip(),
                }
            )
            if len(normalized) >= settings.competition_search_results:
                break

        return normalized

    async def _analyze_sources(
        self,
        product_name: str,
        product_description: str,
        search_results: list[dict[str, str]],
        provider: AnalyzeProvider,
    ) -> list[dict[str, Any]]:
        shortlisted_results = search_results[
            : settings.competition_sources_to_analyze
        ]
        if not shortlisted_results:
            return []

        reviews = await asyncio.gather(
            *[
                self._review_single_source(
                    product_name=product_name,
                    product_description=product_description,
                    search_result=search_result,
                    provider=provider,
                )
                for search_result in shortlisted_results
            ]
        )
        return [review for review in reviews if review]

    async def _review_single_source(
        self,
        product_name: str,
        product_description: str,
        search_result: dict[str, str],
        provider: AnalyzeProvider,
    ) -> dict[str, Any] | None:
        source_url = search_result["url"]
        source_text = await asyncio.to_thread(
            self._fetch_source_text, source_url
        )
        if not source_text:
            return None

        review = await self.llm_client.analyze_competition_source(
            product_name=product_name,
            product_description=product_description or product_name,
            source_title=search_result.get("title", source_url),
            source_url=source_url,
            source_text=source_text,
            provider=provider,
        )
        if not review.get("is_relevant"):
            return None
        if not review.get("summary"):
            return None
        return review

    def _fetch_source_text(self, source_url: str) -> str:
        try:
            response = self.session.get(
                source_url,
                timeout=settings.competition_fetch_timeout_seconds,
            )
            response.raise_for_status()
        except Exception:
            logger.warning(
                "Failed to fetch source: %s", source_url, exc_info=True
            )
            return ""

        content_type = response.headers.get("Content-Type", "").lower()
        text = response.text

        if "text/plain" in content_type:
            extracted_text = text
        elif "html" in content_type or not content_type:
            parser = _HTMLTextExtractor()
            parser.feed(text)
            extracted_text = parser.get_text()
        else:
            logger.info(
                "Skipping unsupported content type '%s' for %s",
                content_type,
                source_url,
            )
            return ""

        extracted_text = re.sub(r"\s+", " ", extracted_text).strip()
        return extracted_text[: settings.competition_source_text_limit * 2]
