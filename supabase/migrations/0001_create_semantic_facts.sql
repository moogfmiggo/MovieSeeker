-- Semantic facts: persistent, provider-independent storage for movie
-- semantic attributes (Task 7/8). Shared/global data, not per-user -
-- never store this in localStorage.
--
-- Apply via the Supabase SQL editor or `supabase db push`.

create table if not exists semantic_facts (
  id bigint generated always as identity primary key,

  movie_id bigint not null,

  -- Deliberately not an enum/foreign key: new attributes (core or
  -- query-specific) must be addable without a schema change.
  attribute text not null,

  -- Polymorphic: boolean for most core facts (dog_death), string for
  -- descriptive query-specific facts (protagonist_race), occasionally
  -- numeric. NULL only when status = 'unanalyzed'.
  value jsonb,

  -- 0-1. NULL only when status = 'unanalyzed'.
  confidence real,

  -- Free-form provenance, e.g. 'manual', 'llm:<provider>'. Never a
  -- hard-coded provider name in application code.
  source text not null,

  status text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- "unknown" must stay structurally distinct from "known false": a fact
  -- is either fully unanalyzed (no value/confidence at all) or fully known
  -- (value + confidence both present). Never a false value masquerading as
  -- "not yet analyzed", or vice versa.
  constraint semantic_facts_status_check
    check (status in ('unanalyzed', 'inferred', 'verified')),
  constraint semantic_facts_known_state_consistency check (
    (status = 'unanalyzed' and value is null and confidence is null)
    or
    (status in ('inferred', 'verified') and value is not null and confidence is not null)
  ),
  constraint semantic_facts_confidence_range
    check (confidence is null or (confidence >= 0 and confidence <= 1)),

  -- Prevents duplicate records for the same movie+attribute+source; the
  -- application layer upserts on this same key to update in place.
  constraint semantic_facts_unique_movie_attribute_source
    unique (movie_id, attribute, source)
);

create index if not exists semantic_facts_movie_id_idx on semantic_facts (movie_id);
create index if not exists semantic_facts_movie_attribute_idx on semantic_facts (movie_id, attribute);
