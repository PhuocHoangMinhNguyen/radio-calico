CREATE TABLE IF NOT EXISTS song_ratings (
  id SERIAL PRIMARY KEY,
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  thumbs_up INT NOT NULL DEFAULT 0,
  thumbs_down INT NOT NULL DEFAULT 0,
  UNIQUE(song_title, song_artist)
);
