import { Component } from '@angular/core';
import { MENU } from '../menu';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  menu = MENU;
}
