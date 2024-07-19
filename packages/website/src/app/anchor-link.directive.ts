import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

@Directive({
    selector: 'a[anchorLink]'
})
export class AnchorLink {
    readonly element = inject(ElementRef).nativeElement as HTMLAnchorElement;

    @Input() get anchorLink() {
        return this.element.href.replace(/.*#/, '');
    }

    set anchorLink(value: string) {
        if (typeof window !== 'undefined')
            this.element.href = `${window.location.pathname}#${value}`;
        else
            this.element.href = `#${value}`;
    }

    @HostListener('click', ['$event'])
    onClick(event: MouseEvent) {
        event.stopPropagation();
        event.preventDefault();
        
        let element = document.querySelector(`#${this.anchorLink}`);
        if (!element)
            return;

        window.history.pushState({}, undefined, `${this.element.href}`)
        setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
    }
}