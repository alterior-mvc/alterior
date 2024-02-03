import { Component, inject } from '@angular/core';
import { PackagesService } from '../package-service';
import { MENU } from '../menu';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  packagesService = inject(PackagesService);
  packages = this.packagesService.all();
  menu = MENU;
}
