import { Component } from '@angular/core';
import { Header } from './components/header/header';
import { Player } from './components/player/player';

@Component({
  selector: 'app-root',
  imports: [Header, Player],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
