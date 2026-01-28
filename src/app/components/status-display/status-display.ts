import { Component, inject } from '@angular/core';
import { HlsPlayerService } from '../../services/hls-player.service';

@Component({
  selector: 'app-status-display',
  imports: [],
  templateUrl: './status-display.html',
  styleUrl: './status-display.scss',
})
export class StatusDisplay {
  private hlsService = inject(HlsPlayerService);

  statusMessage = this.hlsService.statusMessage;
  statusClass = this.hlsService.statusClass;
}
