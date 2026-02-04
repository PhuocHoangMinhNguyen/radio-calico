import { Component, inject } from '@angular/core';
import { HlsPlayerService } from '../../services/hls-player.service';
import { SongRating } from '../song-rating/song-rating';
import { ShareButton } from '../share-button/share-button';
import { BookmarkButton } from '../bookmark-button/bookmark-button';
import { ListeningStats } from '../listening-stats/listening-stats';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-now-playing-hero',
  imports: [SongRating, ShareButton, BookmarkButton, ListeningStats],
  templateUrl: './now-playing-hero.html',
  styleUrl: './now-playing-hero.scss',
})
export class NowPlayingHero {
  private hlsService = inject(HlsPlayerService);
  private themeService = inject(ThemeService);

  currentTrack = this.hlsService.currentTrack;
  hasTrackInfo = this.hlsService.hasTrackInfo;
  coverUrl = this.hlsService.coverUrl;

  theme = this.themeService.theme;

  toggleTheme(): void {
    this.themeService.toggle();
  }
}
