import { suite } from "razmin";
import { expect } from "chai";
import { Presentation, Expose } from "./presentation";

suite(describe => {
    describe('Presentation<T>', it => {
        it('correctly handles subclassing', () => {
            interface Movie {
                title : string;
                description : string;
            }
            
            class ApiAbridgedMovie extends Presentation<Movie> {
                @Expose() title : string;
            }
            
            class ApiMovie extends ApiAbridgedMovie {
                @Expose() description : string;
            }

            let abridgedPresenter = new ApiAbridgedMovie({ title: 'Title', description: 'Description' });
            let abridgedRepr : any = abridgedPresenter.toJSON();

            expect(abridgedRepr.title).to.equal('Title');
            expect(abridgedRepr.description).to.be.undefined;

            let presenter = new ApiMovie({ title: 'Title', description: 'Description' });
            let repr : any = presenter.toJSON();

            expect(repr.title).to.equal('Title');
            expect(repr.description).to.equal('Description');


        });
    });
});