-- Migration 003: Prune stale non-active embedding generations and unneeded vectors
DELETE FROM embedding_generations
WHERE status != 'ACTIVE'
  AND EXISTS (SELECT 1 FROM embedding_generations WHERE status = 'ACTIVE');

DELETE FROM embedding_generations
WHERE id NOT IN (
    SELECT id FROM embedding_generations
    ORDER BY (status = 'ACTIVE') DESC, processed_items DESC, id DESC
    LIMIT 1
);
