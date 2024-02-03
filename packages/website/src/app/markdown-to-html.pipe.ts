import { Pipe, PipeTransform } from '@angular/core';
import * as marked from 'marked';

@Pipe({
    name: 'markdownToHtml'
})
export class MarkdownToHtmlPipe implements PipeTransform {
    allLinksTargetBlank: boolean;

    transform(value: string): string {
        if (!value)
            return '';

        return <string> marked.marked.parse(value);
    }
}
