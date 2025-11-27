export default class DecodeUuid {
    public decode(compressed: string): string {
        return this.decodeCompressedUuid(compressed);
    }

    private decodeCompressedUuid(compressed: string): string {
        if (!compressed || typeof compressed !== 'string') {
            return '';
        }

        var base64 = compressed;
        var remainder = base64.length % 4;
        if (remainder === 2) {
            base64 += '==';
        } else if (remainder === 3) {
            base64 += '=';
        } else if (remainder === 1) {
            base64 += '===';
        }

        var raw = '';
        if (typeof atob === 'function') {
            try {
                raw = atob(base64);
            } catch (error) {
                raw = '';
            }
        }

        if (!raw) {
            var decodeMap = {} as { [key: string]: number };
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            for (var i = 0; i < chars.length; i++) {
                decodeMap[chars.charAt(i)] = i;
            }

            var buffer = 0;
            var bits = 0;
            for (var index = 0; index < base64.length; index++) {
                var value = decodeMap[base64.charAt(index)];
                if (value === undefined) {
                    continue;
                }
                buffer = (buffer << 6) | value;
                bits += 6;
                if (bits >= 8) {
                    bits -= 8;
                    raw += String.fromCharCode((buffer >> bits) & 0xff);
                }
            }
        }

        var hex = '';
        for (var j = 0; j < raw.length; j++) {
            var code = raw.charCodeAt(j).toString(16);
            if (code.length < 2) {
                code = '0' + code;
            }
            hex += code;
        }

        if (hex.length !== 32) {
            return hex;
        }

        var parts = [
            hex.substring(0, 8),
            hex.substring(8, 12),
            hex.substring(12, 16),
            hex.substring(16, 20),
            hex.substring(20)
        ];
        return parts.join('-');
    }
}
