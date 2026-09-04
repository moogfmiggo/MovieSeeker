export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  original_title: string;
  adult: boolean;
  video: boolean;
  /** Present for normalized TV results so shared cards link to the right detail route. */
  media_type?: "movie" | "tv";
}

export interface TMDBPopularMoviesResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBGenreListResponse {
  genres: TMDBGenre[];
}

/** TV results are normalized to the MovieCard-compatible shape at the API boundary. */
export type TMDBTVSeriesResponse = TMDBPopularMoviesResponse;

export interface TMDBTVSeriesDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genres: TMDBGenre[];
  episode_run_time: number[];
  tagline: string | null;
  original_language: string;
  original_name: string;
  number_of_seasons: number;
  number_of_episodes: number;
  credits: {
    cast: TMDBCastMember[];
    crew: TMDBCrewMember[];
  };
}

export interface TMDBProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

/** Full movie details, including credits (via TMDB's append_to_response=credits). */
export interface TMDBMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genres: TMDBGenre[];
  runtime: number | null;
  tagline: string | null;
  original_language: string;
  original_title: string;
  adult: boolean;
  video: boolean;
  production_companies: TMDBProductionCompany[];
  credits: {
    cast: TMDBCastMember[];
    crew: TMDBCrewMember[];
  };
  /** Present when fetched with append_to_response including "keywords". */
  keywords?: {
    keywords: TMDBKeyword[];
  };
}

export interface TMDBKeyword {
  id: number;
  name: string;
}

export interface TMDBKeywordSearchResponse {
  page: number;
  results: TMDBKeyword[];
  total_pages: number;
  total_results: number;
}

export interface TMDBPersonDetails {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string | null;
  biography: string;
}

/** A person's credit on a movie they acted in - a full movie object plus their role. */
export interface TMDBPersonMovieCastCredit extends TMDBMovie {
  character: string;
  credit_id: string;
}

/** A person's credit on a movie they crewed on - a full movie object plus their job. */
export interface TMDBPersonMovieCrewCredit extends TMDBMovie {
  job: string;
  department: string;
  credit_id: string;
}

export interface TMDBPersonMovieCreditsResponse {
  id: number;
  cast: TMDBPersonMovieCastCredit[];
  crew: TMDBPersonMovieCrewCredit[];
}

export interface TMDBCompanyDetails {
  id: number;
  name: string;
  logo_path: string | null;
}

export interface TMDBWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

export interface TMDBWatchProviderCatalogItem extends TMDBWatchProvider {
  display_priorities?: Record<string, number>;
}

export interface TMDBWatchProviderListResponse {
  results: TMDBWatchProviderCatalogItem[];
}

/** One region's watch-provider offer, as returned by TMDB (powered by JustWatch). */
export interface TMDBWatchProviderRegion {
  /** TMDB-hosted watch page for this title/region; required attribution link if data is shown. */
  link?: string;
  flatrate?: TMDBWatchProvider[];
  free?: TMDBWatchProvider[];
  ads?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
}

/** Response of GET /movie/{id}/watch/providers - keyed by ISO 3166-1 region code. */
export interface TMDBWatchProvidersResponse {
  id: number;
  results: Record<string, TMDBWatchProviderRegion>;
}
