"""Prompt management module with caching for LLM prompts.

This module provides functions to load and cache prompts from files.
Prompts are stored in backend/app/media/prompts/ directory.
"""

from pathlib import Path

from app.models.schemas import PersonaRoles

from app.config import settings

PROMPTS_DIR = settings.prompts_dir
PERSONAS_DIR = PROMPTS_DIR / "personas"

_prompt_cache: dict[str, str] = {}


def _load_prompt_file(filepath: Path) -> str:
    """Load prompt content from file.

    Args:
        filepath: Path to the prompt file.

    Returns:
        Content of the prompt file as string.

    Raises:
        FileNotFoundError: If prompt file does not exist.
    """
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read().strip()


def _get_cached_prompt(cache_key: str, filepath: Path) -> str:
    """Get prompt from cache or load from file.

    Args:
        cache_key: Unique key for caching.
        filepath: Path to the prompt file.

    Returns:
        Cached or freshly loaded prompt content.
    """
    if cache_key not in _prompt_cache:
        _prompt_cache[cache_key] = _load_prompt_file(filepath)
    return _prompt_cache[cache_key]


def get_persona_prompt(persona: PersonaRoles) -> str:
    """Load persona-specific prompt from file.

    Args:
        persona: Persona role to load prompt for.

    Returns:
        Persona prompt content.
    """
    filepath = PERSONAS_DIR / f"{persona.value}.txt"
    return _get_cached_prompt(f"persona:{persona.value}", filepath)


def get_analyze_speech_system_prompt(persona: PersonaRoles) -> str:
    """Get speech analysis system prompt with persona substitution.

    Args:
        persona: Persona role for the analysis.

    Returns:
        Formatted system prompt with persona inserted.
    """
    base_prompt = _get_cached_prompt(
        "speech_analysis",
        PROMPTS_DIR / "speech_analysis.txt",
    )
    persona_prompt = get_persona_prompt(persona)

    tools = ""

    return base_prompt.format(persona=persona_prompt, tools=tools)


def get_evaluation_criteria_identity_prompt() -> str:
    """Get criteria extraction prompt.

    Returns:
        Criteria extraction system prompt.
    """
    base_prompt = _get_cached_prompt(
        "criteria_extraction",
        PROMPTS_DIR / "criteria_extraction.txt",
    )

    tools = ""

    return base_prompt.format(tools=tools)


def get_evaluation_criteria_rate_prompt() -> str:
    """Get criteria evaluation prompt.

    Returns:
        Criteria evaluation system prompt.
    """
    base_prompt = _get_cached_prompt(
        "criteria_evaluation",
        PROMPTS_DIR / "criteria_evaluation.txt",
    )

    tools = ""

    return base_prompt.format(tools=tools)
