from __future__ import annotations

from typing import Annotated, Any
from langchain_core.tools import tool
from data.search import hybrid_search


@tool
async def hybrid_search_knowledge_base(
    query: Annotated[str, "The search query or keywords to retrieve relevant semantic chunks"],
    source_types: Annotated[
        list[str] | None,
        "Optional source types filter: ['chat_message', 'execution_log', 'investigation', 'backup_result', 'backup_fix']",
    ] = None,
    limit: Annotated[int, "Maximum number of chunks to retrieve (1 to 20, default: 5)"] = 5,
    fts_weight: Annotated[float, "Full-Text Search weight in RRF fusion (0.0 to 1.0, default: 0.3)"] = 0.3,
    semantic_weight: Annotated[float, "Dense vector semantic weight in RRF fusion (0.0 to 1.0, default: 0.7)"] = 0.7,
) -> dict[str, Any]:
    """Perform hybrid search (combining Full-Text Search, dense pgvector embeddings, and RRF rank fusion) to fetch knowledge base chunks, historical execution logs, errors, and investigations."""
    return await hybrid_search(
        query=query,
        source_types=source_types,
        limit=min(20, max(1, limit)),
        fts_weight=fts_weight,
        semantic_weight=semantic_weight,
    )
