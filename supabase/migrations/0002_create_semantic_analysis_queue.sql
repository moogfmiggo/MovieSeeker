-- Semantic analysis queue (Task 9): infrastructure only. Nothing reads
-- from or processes this table automatically - it exists purely so a
-- future analysis worker has a durable, deduplicated list of
-- (movie, attribute) pairs that need analysis.
--
-- Apply via the Supabase SQL editor or `supabase db push`, after
-- 0001_create_semantic_facts.sql.

create table if not exists semantic_analysis_queue (
  id bigint generated always as identity primary key,

  movie_id bigint not null,

  -- Deliberately not an enum/foreign key: same reasoning as
  -- semantic_facts.attribute - new attributes must be queueable without a
  -- schema change.
  attribute text not null,

  status text not null default 'pending',
  priority text not null default 'normal',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint semantic_analysis_queue_status_check
    check (status in ('pending', 'processing', 'completed', 'failed')),
  constraint semantic_analysis_queue_priority_check
    check (priority in ('low', 'normal', 'high'))
);

-- Prevents duplicate ACTIVE (pending/processing) requests for the same
-- movie+attribute. A partial index rather than a plain unique constraint,
-- so a new item can still be queued after a prior one reaches a terminal
-- state (completed/failed) - e.g. for a future manual retry.
create unique index if not exists semantic_analysis_queue_active_unique
  on semantic_analysis_queue (movie_id, attribute)
  where status in ('pending', 'processing');

create index if not exists semantic_analysis_queue_movie_id_idx
  on semantic_analysis_queue (movie_id);
create index if not exists semantic_analysis_queue_status_idx
  on semantic_analysis_queue (status);
