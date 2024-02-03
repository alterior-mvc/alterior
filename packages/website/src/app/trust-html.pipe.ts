import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
    name: 'trustHtml'
})
export class TrustHtmlPipe implements PipeTransform {
    private sanitizer = inject(DomSanitizer);
    transform(value: any): any {
        return this.sanitizer.bypassSecurityTrustHtml(value);
    }
}
