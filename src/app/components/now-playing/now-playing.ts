import { Component, inject } from '@angular/core';
import { HlsPlayerService } from '../../services/hls-player.service';

@Component({
  selector: 'app-now-playing',
  imports: [],
  templateUrl: './now-playing.html',
  styleUrl: './now-playing.scss',
})
export class NowPlaying {
  private hlsService = inject(HlsPlayerService);

  currentTrack = this.hlsService.currentTrack;
  hasTrackInfo = this.hlsService.hasTrackInfo;
}
