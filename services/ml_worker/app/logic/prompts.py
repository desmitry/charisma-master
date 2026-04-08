"""Prompt management module with caching for LLM prompts.

Prompts are loaded from Postgres database at worker startup and
cached in memory.
"""

import logging

import psycopg2
from charisma_schemas import PersonaRoles

from app.config import settings

logger = logging.getLogger(__name__)

_prompt_cache: dict[str, str] = {}


def load_prompts_from_db():
    """Load all prompts from Postgres into the cache."""
    conn = psycopg2.connect(settings.database_url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT key, content FROM prompts")
            for key, content in cur.fetchall():
                _prompt_cache[key] = content
        logger.info(f"Loaded {len(_prompt_cache)} prompts from database")
    finally:
        conn.close()


def get_persona_prompt(persona: PersonaRoles) -> str:
    """Load persona-specific prompt from file.

    Args:
        persona: Persona role to load prompt for.

    Returns:
        Persona prompt content.
    """
    cache_key = f"persona:{persona.value}"
    if cache_key not in _prompt_cache:
        raise KeyError(f"Prompt not found in cache: {cache_key}")
    return _prompt_cache[cache_key]


def get_analyze_speech_system_prompt(persona: PersonaRoles) -> str:
    """Get speech analysis system prompt with persona substitution.

    Args:
        persona: Persona role for the analysis.

    Returns:
        Formatted system prompt with persona inserted.
    """
    base_prompt = _prompt_cache.get("speech_analysis", "")
    persona_prompt = get_persona_prompt(persona)

    tools = ""

    return base_prompt.format(persona=persona_prompt, tools=tools)


def get_evaluation_criteria_identity_prompt() -> str:
    """Get criteria extraction prompt.

    Returns:
        Criteria extraction system prompt.
    """
    base_prompt = _prompt_cache.get("criteria_extraction", "")

    tools = ""

    return base_prompt.format(tools=tools)


def get_evaluation_criteria_rate_prompt() -> str:
    """Get criteria evaluation prompt.

    Returns:
        Criteria evaluation system prompt.
    """
    base_prompt = _prompt_cache.get("criteria_evaluation", "")

    tools = ""

    return base_prompt.format(tools=tools)
