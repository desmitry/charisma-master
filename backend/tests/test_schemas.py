import pytest
from pydantic import ValidationError

from app.models.schemas import (
    AnalyzeProvider,
    PersonaRoles,
    RatingRequest,
    TaskState,
    TranscribeProvider,
    TranscriptWord,
)


def test_rating_request_valid():
    r = RatingRequest(rating=4)
    assert r.rating == 4


def test_rating_request_min():
    r = RatingRequest(rating=1)
    assert r.rating == 1


def test_rating_request_max():
    r = RatingRequest(rating=5)
    assert r.rating == 5


def test_rating_request_too_low():
    with pytest.raises(ValidationError):
        RatingRequest(rating=0)


def test_rating_request_too_high():
    with pytest.raises(ValidationError):
        RatingRequest(rating=6)


def test_rating_request_negative():
    with pytest.raises(ValidationError):
        RatingRequest(rating=-1)


def test_transcript_word_defaults():
    w = TranscriptWord(start=0.0, end=1.0, text="test")
    assert w.is_filler is False


def test_transcript_word_explicit_filler():
    w = TranscriptWord(start=0.0, end=1.0, text="ну", is_filler=True)
    assert w.is_filler is True


def test_task_state_values():
    assert TaskState.queued.value == "PENDING"
    assert TaskState.processing.value == "PROCESSING"
    assert TaskState.finished.value == "SUCCESS"
    assert TaskState.failed.value == "FAILURE"


def test_task_state_hints():
    assert TaskState.queued.hint == "PENDING"
    assert TaskState.failed.hint == "FAILURE"


def test_persona_roles_all():
    assert len(PersonaRoles) == 4
    assert PersonaRoles.strict_critic.value == "strict_critic"
    assert PersonaRoles.kind_mentor.value == "kind_mentor"
    assert PersonaRoles.steve_jobs_style.value == "steve_jobs_style"
    assert PersonaRoles.speech_review_specialist.value == "speech_review_specialist"


def test_transcribe_providers_all():
    assert len(TranscribeProvider) == 3
    assert TranscribeProvider.sber_gigachat.value == "sber_gigachat"
    assert TranscribeProvider.whisper_local.value == "whisper_local"
    assert TranscribeProvider.whisper_openai.value == "whisper_openai"


def test_analyze_providers_all():
    assert len(AnalyzeProvider) == 2
    assert AnalyzeProvider.gigachat.value == "gigachat"
    assert AnalyzeProvider.openai.value == "openai"
