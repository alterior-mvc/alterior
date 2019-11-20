import { suite } from "razmin";
import { expect } from "chai";
import { Presentation, Expose } from "./presentation";

suite(describe => {
    describe('Presentation<T>', it => {
        it('exposes properties via Subclass.properties', () => {

            interface Movie {
                title : string;
                description : string;
                rating : number;
            }
            
            function Nothing() {
                return (target, ...args) => target;
            }

            @Nothing()
            class ApiMovie extends Presentation<Movie> {
                @Expose() description : string;
                @Expose() title : string;
                @Expose() rating : number;
            }

            let props = ApiMovie.properties;
            let descProp = props.find(x => x.propertyKey === 'description');
            let titleProp = props.find(x => x.propertyKey === 'title');
            let ratingProp = props.find(x => x.propertyKey === 'rating');

            expect(props.length).to.equal(3);
            expect(descProp).to.exist
            expect(titleProp).to.exist
            expect(ratingProp).to.exist
            
            expect(descProp.designType).to.equal(String);
            expect(titleProp.designType).to.equal(String);
            expect(ratingProp.designType).to.equal(Number);
        });

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