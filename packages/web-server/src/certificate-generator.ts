import * as forge from 'node-forge';

export interface GeneratorOptions {
    days? : number;
    extensions? : any[]; // todo
    algorithm? : 'sha256';
    pkcs7? : boolean;
    clientCertificate? : boolean;
    clientCertificateCN? : string;
    keySize? : number;
    keyPair? : { privateKey : string, publicKey : string };
}

export interface GeneratedCertificate {
    private : string;
    public : string;
    cert : string;
}

export type CertAttributes = { name? : string, shortName? : string, value : string }[];

export class CertificateGenerator {
    private toPositiveHex(hexString) {
        // a hexString is considered negative if it's most significant bit is 1
        // because serial numbers use ones' complement notation
        // this RFC in section 4.1.2.2 requires serial numbers to be positive
        // http://www.ietf.org/rfc/rfc5280.txt

        let mostSignificantHexAsInt = parseInt(hexString[0], 16);
        if (mostSignificantHexAsInt < 8) {
            return hexString;
        }

        mostSignificantHexAsInt -= 8;
        return mostSignificantHexAsInt.toString() + hexString.substring(1);
    }

    private getAlgorithm(key) {
        switch (key) {
            case 'sha256':
                return forge.md.sha256.create();
            default:
                return forge.md.sha1.create();
        }
    }

    async generate(attrs : CertAttributes, options : GeneratorOptions = {}): Promise<GeneratedCertificate> {
        options = options || {};

        let generatePem = (keyPair: { privateKey: string, publicKey: string }) => {
            let cert = forge.pki.createCertificate();

            cert.serialNumber = this.toPositiveHex(forge.util.bytesToHex(forge.random.getBytesSync(9))); // the serial number can be decimal or hex (if preceded by 0x)

            cert.validity.notBefore = new Date();
            cert.validity.notAfter = new Date();
            cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + (options.days || 365));

            attrs = attrs || [{
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
            }];

            cert.setSubject(attrs);
            cert.setIssuer(attrs);

            cert.publicKey = forge.pki.publicKeyFromPem(keyPair.publicKey);

            cert.setExtensions(options.extensions || [{
                name: 'basicConstraints',
                cA: true
            }, {
                name: 'keyUsage',
                keyCertSign: true,
                digitalSignature: true,
                nonRepudiation: true,
                keyEncipherment: true,
                dataEncipherment: true
            }, {
                name: 'subjectAltName',
                altNames: [{
                    type: 6, // URI
                    value: 'http://example.org/webid#me'
                }]
            }]);

            cert.sign(forge.pki.privateKeyFromPem(keyPair.privateKey), this.getAlgorithm(options && options.algorithm));

            const fingerprint = forge.md.sha1
                .create()
                .update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
                .digest()
                .toHex()
                .match(/.{2}/g)
                .join(':');

            let pem = {
                private: keyPair.privateKey,
                public: keyPair.publicKey,
                cert: forge.pki.certificateToPem(cert),
                pkcs7: null,
                fingerprint: fingerprint,
                clientprivate: null,
                clientpublic: null,
                clientcert: null,
                clientpkcs7: null
            };

            if (options && options.pkcs7) {
                let p7 = forge.pkcs7.createSignedData();
                p7.addCertificate(cert);
                pem.pkcs7 = forge.pkcs7.messageToPem(p7);
            }

            if (options && options.clientCertificate) {
                let clientkeys = forge.pki.rsa.generateKeyPair(1024);
                let clientcert = forge.pki.createCertificate();
                clientcert.serialNumber = this.toPositiveHex(forge.util.bytesToHex(forge.random.getBytesSync(9)));
                clientcert.validity.notBefore = new Date();
                clientcert.validity.notAfter = new Date();
                clientcert.validity.notAfter.setFullYear(clientcert.validity.notBefore.getFullYear() + 1);

                let clientAttrs = JSON.parse(JSON.stringify(attrs));

                for (let i = 0; i < clientAttrs.length; i++) {
                    if (clientAttrs[i].name === 'commonName') {
                        if (options.clientCertificateCN)
                            clientAttrs[i] = { name: 'commonName', value: options.clientCertificateCN };
                        else
                            clientAttrs[i] = { name: 'commonName', value: 'John Doe jdoe123' };
                    }
                }

                clientcert.setSubject(clientAttrs);

                // Set the issuer to the parent key
                clientcert.setIssuer(attrs);

                clientcert.publicKey = clientkeys.publicKey;

                // Sign client cert with root cert
                clientcert.sign(forge.pki.privateKeyFromPem(keyPair.privateKey));

                pem.clientprivate = forge.pki.privateKeyToPem(clientkeys.privateKey);
                pem.clientpublic = forge.pki.publicKeyToPem(clientkeys.publicKey);
                pem.clientcert = forge.pki.certificateToPem(clientcert);

                if (options.pkcs7) {
                    let clientp7 = forge.pkcs7.createSignedData();
                    clientp7.addCertificate(clientcert);
                    pem.clientpkcs7 = forge.pkcs7.messageToPem(clientp7);
                }
            }

            let caStore = forge.pki.createCaStore();
            caStore.addCertificate(cert);

            try {
                forge.pki.verifyCertificateChain(caStore, [cert],
                    function (vfd, depth, chain) {
                        if (vfd !== true) {
                            throw new Error('Certificate could not be verified.');
                        }
                        return true;
                    });
            }
            catch (ex) {
                throw new Error(ex);
            }

            return pem;
        };

        let keySize = options.keySize || 1024;
        let keyPair = options.keyPair;

        if (!keyPair) {
            keyPair = await new Promise((resolve, reject) => {
                forge.pki.rsa.generateKeyPair({ bits: keySize }, (err, keyPair) => {
                    if (err)
                        return reject(err);

                    try {
                        return resolve({ 
                            privateKey: forge.pki.privateKeyToPem(keyPair.privateKey), 
                            publicKey: forge.pki.publicKeyToPem(keyPair.publicKey) 
                        });
                    } catch (ex) {
                        return reject(ex);
                    }
                });
            });
        }

        return generatePem(keyPair);
    }
}
