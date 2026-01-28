import { Component, inject } from '@angular/core';
import { HlsPlayerService } from '../../services/hls-player.service';

@Component({
  selector: 'app-audio-controls',
  imports: [],
  templateUrl: './audio-controls.html',
  styleUrl: './audio-controls.scss',
})
export class AudioControls {
  private hlsService = inject(HlsPlayerService);

  isPlaying = this.hlsService.isPlaying;

  onTogglePlayPause(): void {
    this.hlsService.togglePlayPause();
  }
}
