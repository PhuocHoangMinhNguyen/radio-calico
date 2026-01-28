import { Component, inject } from '@angular/core';
import { HlsPlayerService } from '../../services/hls-player.service';

@Component({
  selector: 'app-volume-control',
  imports: [],
  templateUrl: './volume-control.html',
  styleUrl: './volume-control.scss',
})
export class VolumeControl {
  private hlsService = inject(HlsPlayerService);

  volume = this.hlsService.volume;

  onVolumeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.hlsService.setVolume(Number(input.value));
  }
}
