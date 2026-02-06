import { Component, inject, computed } from '@angular/core';
import { HlsPlayerService, ConnectionQuality } from '../../services/hls-player.service';

@Component({
  selector: 'app-stream-quality',
  templateUrl: './stream-quality.html',
  styleUrl: './stream-quality.scss',
})
export class StreamQualityComponent {
  private readonly playerService = inject(HlsPlayerService);

  readonly bufferHealth = this.playerService.bufferHealth;
  readonly bitrate = this.playerService.bitrate;
  readonly connectionQuality = this.playerService.connectionQuality;
  readonly isPlaying = this.playerService.isPlaying;

  readonly qualityLabel = computed(() => {
    const quality = this.connectionQuality();
    switch (quality) {
      case 'good':
        return 'Good';
      case 'fair':
        return 'Fair';
      case 'poor':
        return 'Poor';
    }
  });

  readonly qualityIcon = computed(() => {
    const quality = this.connectionQuality();
    switch (quality) {
      case 'good':
        return 'signal_cellular_alt';
      case 'fair':
        return 'signal_cellular_alt_2_bar';
      case 'poor':
        return 'signal_cellular_alt_1_bar';
    }
  });

  readonly formattedBitrate = computed(() => {
    const kbps = this.bitrate();
    if (kbps >= 1000) {
      return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps} kbps`;
  });

  readonly formattedBuffer = computed(() => {
    const seconds = this.bufferHealth();
    return `${seconds.toFixed(1)}s`;
  });
}
