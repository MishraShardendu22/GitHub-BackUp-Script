-- Migration: 000006_prune_stale_embedding_generations
-- Purges non-active / abandoned / stale embedding generations,
-- cascading deletion to all their embedding_chunks, embedding_chunk_metadata,
-- embedding_jobs, and embedding_job_errors.

-- Delete all generations where status is not ACTIVE (if an ACTIVE generation exists)
DELETE FROM embedding_generations
WHERE status != 'ACTIVE'
  AND EXISTS (SELECT 1 FROM embedding_generations WHERE status = 'ACTIVE');

-- If no ACTIVE generation exists, keep only the latest generation with processed items
DELETE FROM embedding_generations
WHERE id NOT IN (
    SELECT id FROM embedding_generations
    ORDER BY (status = 'ACTIVE') DESC, processed_items DESC, id DESC
    LIMIT 1
);
