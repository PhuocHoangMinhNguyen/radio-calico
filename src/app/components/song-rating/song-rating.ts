import { Component, effect, inject } from '@angular/core';
import { RatingService } from '../../services/rating.service';
import { HlsPlayerService } from '../../services/hls-player.service';

@Component({
  selector: 'app-song-rating',
  imports: [],
  templateUrl: './song-rating.html',
  styleUrl: './song-rating.scss',
})
export class SongRating {
  private ratingService = inject(RatingService);
  private hlsService = inject(HlsPlayerService);

  ratings = this.ratingService.ratings;
  userRating = this.ratingService.userRating;
  isPending = this.ratingService.isPending;
  hasTrackInfo = this.hlsService.hasTrackInfo;

  constructor() {
    effect(() => {
      const track = this.hlsService.currentTrack();
      if (track) {
        this.ratingService.fetchRatings(track.title, track.artist);
      }
    });
  }

  onRate(rating: 'up' | 'down'): void {
    const track = this.hlsService.currentTrack();
    if (track) {
      this.ratingService.submitRating(track.title, track.artist, rating);
    }
  }
}
