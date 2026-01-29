import { Component } from '@angular/core';
import { Sidebar } from './components/sidebar/sidebar';
import { NowPlayingHero } from './components/now-playing-hero/now-playing-hero';
import { RecentlyPlayed } from './components/recently-played/recently-played';
import { PlayerBar } from './components/player-bar/player-bar';

@Component({
  selector: 'app-root',
  imports: [Sidebar, NowPlayingHero, RecentlyPlayed, PlayerBar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
