import { isPlatformServer } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

declare var Prism;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  ngOnInit() {
    if (!isPlatformServer(this.platformId))
      this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
        setTimeout(() => Prism.highlightAll());
      });
  }
}
