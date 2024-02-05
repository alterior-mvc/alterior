import { stringify } from "./facade/lang";
import { Injector } from "./injector";
import { THROW_IF_NOT_FOUND } from "./throw-if-not-found";

// tslint:disable-next-line:class-name no-use-before-declare
export class NullInjector implements Injector {
    static readonly instance = new NullInjector();

    get(token: any, notFoundValue: any = THROW_IF_NOT_FOUND): any {
      if (notFoundValue === THROW_IF_NOT_FOUND) {
        throw new Error(`No provider for ${stringify(token)}!`);
      }
      return notFoundValue;
    }
  
    parent = null;
  }
  