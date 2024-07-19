import { Location } from '@angular/common';
import { Directive, HostBinding, HostListener, inject, Input } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Provides universal hyperlinking (both internal and external). Use in place of routerLink.
 */
@Directive({ selector: 'a[url]' })
export class UniversalLinkDirective {
    private router = inject(Router);
    private location = inject(Location);
    private _target: string;

    get isExternal() {
        if (!this.href)
            return false;
        return !this.href.startsWith('/');
    }

    @HostBinding('attr.href') href: string | null = null;
    @HostBinding('attr.target') @Input()
    get target() {
        if (this._target === undefined && this.isExternal)
            return '_blank';

        return this._target;
    }
    set target(value) { this._target = value; }

    @HostBinding('class.universal-link') isUniversalLink = true;
    @Input() set url(url: string | null) { this.href = url; }
    get url() { return this.href; }

    get shouldOpenInNewTab() { return this.target && this.target !== '_self' };

    @HostListener('click', ['$event'])
    onClick(event: MouseEvent): boolean {
        let url = this.href;
        if (!url || event.button === 0 || isNewTabClick(event) || this.shouldOpenInNewTab || isExternalLink(url))
            return true;

        this.router.navigateByUrl(url);
        return false;
    }
}

export function isExternalLink(url: string) {
    return url.startsWith('https://');
}

export function isNewTabClick(event: MouseEvent) {
    return event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;
}