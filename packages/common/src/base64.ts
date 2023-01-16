const BASE64_KEY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

export class Base64 {
    static encode(str: string): string {
        return this.encodeBytes(new TextEncoder().encode(str));
    }

    static encodeBytes(bytes: Uint8Array): string {
        let output = '';
        let inputPad = 3 - bytes.length % 3;
        let buffer = new Uint8Array(bytes.length + inputPad);
        buffer.set(bytes, 0);

        for (let i = 0, max = buffer.length; i < max; i += 3) {
            let value =
                buffer[i + 0] << 16
                | buffer[i + 1] << 8
                | buffer[i + 2]
                ;
            let char1 = (value >> 18) & 0x3f;
            let char2 = (value >> 12) & 0x3f;
            let char3 = (value >> 6) & 0x3f;
            let char4 = (value >> 0) & 0x3f;

            output += BASE64_KEY[char1];
            output += BASE64_KEY[char2];
            output += BASE64_KEY[char3];
            output += BASE64_KEY[char4];
        }

        let outputPad = Math.floor(inputPad * 8 / 6);
        output = output.slice(0, -outputPad) + Array(outputPad + 1).join('=');
        return output;
    }

    static decode(str: string): string {
        return new TextDecoder().decode(this.decodeBytes(str));
    }

    static decodeBytes(str: string): Uint8Array {
        str = str.replace(/=+$/g, '');
        let paddingRequired = 4 - str.length % 4;
        str += Array(paddingRequired + 1).join('=');

        let decoded = new Uint8Array(str.length * 6 / 8);
        for (let i = 0, max = str.length; i < max; i += 4) {
            let value =
                BASE64_KEY.indexOf(str[i + 0]) << 18
                | BASE64_KEY.indexOf(str[i + 1]) << 12
                | BASE64_KEY.indexOf(str[i + 2]) << 6
                | BASE64_KEY.indexOf(str[i + 3]) << 0
                ;

            decoded[i / 4 * 3 + 0] = value >> 16 & 0xFF;
            decoded[i / 4 * 3 + 1] = value >> 8 & 0xFF;
            decoded[i / 4 * 3 + 2] = value >> 0 & 0xFF;
        }

        return decoded.subarray(0, decoded.length - paddingRequired);
    }
}