import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-package-home',
  templateUrl: './package-home.component.html',
  styleUrl: './package-home.component.scss'
})
export class PackageHomeComponent {
  @Input('name') name: string;
}
