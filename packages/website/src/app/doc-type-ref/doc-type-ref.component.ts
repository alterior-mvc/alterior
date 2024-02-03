import { Component, Input } from '@angular/core';
import { TSDocType, TSDocTypeRef, is } from '../tsdoc';

@Component({
  selector: 'alt-doc-type-ref',
  templateUrl: './doc-type-ref.component.html',
  styleUrl: './doc-type-ref.component.scss'
})
export class DocTypeRefComponent {
  @Input() type: TSDocType;

  isExternal() {
    return this.url.startsWith('https:');
  }

  get url() {
    if (is<TSDocTypeRef>(this.type, () => this.type.type === 'reference')) {

      if (this.type.package === 'typescript' && typeof this.type.target === 'object') {
        let filename = this.type.target.sourceFileName.replace(/.*\//, '');

        if (filename.startsWith('lib.es') || filename.startsWith('lib.dom')) {
          return `https://developer.mozilla.org/en-US/docs/Web/API/${this.type.name}`;
        }
      }

      return `/packages/${this.type.package.replace(/.*\//, '')}/${this.type.name}`;
    }

    return undefined;
  }
}
