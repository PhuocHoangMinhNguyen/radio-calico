export interface TrackInfo {
  title: string;
  artist: string;
}

export interface SongRatings {
  thumbs_up: number;
  thumbs_down: number;
  user_vote?: 'up' | 'down' | null;
}

export interface StreamMetadata {
  title: string;
  artist: string;
  album: string;
  date: string;
  bit_depth: number;
  sample_rate: number;
  prev_title_1: string;
  prev_artist_1: string;
  prev_title_2: string;
  prev_artist_2: string;
  prev_title_3: string;
  prev_artist_3: string;
  prev_title_4: string;
  prev_artist_4: string;
  prev_title_5: string;
  prev_artist_5: string;
  is_new: boolean;
  is_summer: boolean;
  is_vidgames: boolean;
}
