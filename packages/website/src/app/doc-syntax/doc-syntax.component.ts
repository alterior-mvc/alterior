import { Component, Input } from '@angular/core';

export interface SyntaxElement {
  text: string;
  link?: string;
  externalLink?: boolean;
  keyword?: boolean;
  intrinsic?: boolean;
}

@Component({
  selector: 'alt-doc-syntax',
  templateUrl: './doc-syntax.component.html',
  styleUrl: './doc-syntax.component.scss'
})
export class DocSyntaxComponent {
  @Input() syntax: SyntaxElement[];
}
