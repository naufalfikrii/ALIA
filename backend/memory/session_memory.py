from typing import Dict, Optional
from memory.schema import PipelineState

# In-memory store per run_id — swap for Redis in production
_store: Dict[str, PipelineState] = {}

def save_state(state: PipelineState) -> None:
    _store[state.run_id] = state

def get_state(run_id: str) -> Optional[PipelineState]:
    return _store.get(run_id)

def update_state(run_id: str, **kwargs) -> Optional[PipelineState]:
    state = _store.get(run_id)
    if not state:
        return None
    updated = state.model_copy(update=kwargs)
    _store[run_id] = updated
    return updated

def delete_state(run_id: str) -> None:
    _store.pop(run_id, None)