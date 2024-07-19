import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

declare let Prism;

@Injectable()
export class UIService {
    private router = inject(Router);

    pageFinishedLoading() {
        setTimeout(() => {
            Prism.highlightAll();

            // let fragment = this.router.routerState.root.snapshot.fragment;
            // if (fragment) {
            //     let target = document.querySelector(`#${fragment}`);
            //     if (target) {
            //         console.log(`SCROLL`);
            //         target.scrollIntoView({ behavior: 'instant', block: 'start' });
            //     }
            // }
        }, 100);
    }
}