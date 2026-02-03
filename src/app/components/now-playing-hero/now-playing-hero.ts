import { Component, inject } from '@angular/core';
import { HlsPlayerService } from '../../services/hls-player.service';
import { SongRating } from '../song-rating/song-rating';
import { ShareButton } from '../share-button/share-button';

@Component({
  selector: 'app-now-playing-hero',
  imports: [SongRating, ShareButton],
  templateUrl: './now-playing-hero.html',
  styleUrl: './now-playing-hero.scss',
})
export class NowPlayingHero {
  private hlsService = inject(HlsPlayerService);

  currentTrack = this.hlsService.currentTrack;
  hasTrackInfo = this.hlsService.hasTrackInfo;
  coverUrl = this.hlsService.coverUrl;
}
