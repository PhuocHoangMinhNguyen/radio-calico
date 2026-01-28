import { Component, inject } from '@angular/core';
import { HlsPlayerService } from '../../services/hls-player.service';

@Component({
  selector: 'app-recently-played',
  imports: [],
  templateUrl: './recently-played.html',
  styleUrl: './recently-played.scss',
})
export class RecentlyPlayed {
  private hlsService = inject(HlsPlayerService);

  recentlyPlayed = this.hlsService.recentlyPlayed;
}
