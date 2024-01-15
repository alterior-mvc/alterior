import { expect } from 'chai';
import { suite } from 'razmin';
import { CertificateGenerator } from './certificate-generator';

suite(describe => {
    describe('CertificateGenerator', it => {
        it('should be able to generate a self-signed certificate', async () => {
            let generator = new CertificateGenerator();
            let cert = await generator.generate([
				{
	                name: 'commonName',
	                value: 'example.org'
	            }, {
	                name: 'countryName',
	                value: 'US'
	            }, {
	                shortName: 'ST',
	                value: 'Virginia'
	            }, {
	                name: 'localityName',
	                value: 'Blacksburg'
	            }, {
	                name: 'organizationName',
	                value: 'Test'
	            }, {
	                shortName: 'OU',
	                value: 'Test'
	            }
			]);

            expect(cert.cert).to.include('BEGIN CERTIFICATE');
            expect(cert.private).to.include('BEGIN RSA PRIVATE KEY');
            expect(cert.public).to.include('BEGIN PUBLIC KEY');
        });
    })
});