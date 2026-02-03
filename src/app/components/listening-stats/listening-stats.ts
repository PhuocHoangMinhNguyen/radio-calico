import { Component, inject } from '@angular/core';
import { StatsService } from '../../services/stats.service';

@Component({
  selector: 'app-listening-stats',
  standalone: true,
  templateUrl: './listening-stats.html',
  styleUrl: './listening-stats.scss',
})
export class ListeningStats {
  private readonly statsService = inject(StatsService);

  readonly displayMessage = this.statsService.displayMessage;
  readonly totalSeconds = this.statsService.totalSeconds;
}
