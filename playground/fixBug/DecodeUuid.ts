export default class DecodeUuid {
    public decode(compressed: string): string {
        return this.decodeCompressedUuid(compressed);
    }

    private decodeCompressedUuid(compressed: string): string {
        if (!compressed || typeof compressed !== 'string') {
            return '';
        }

        var separator = '@';
        var base64Keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        var hexChars = '0123456789abcdef';

        var t = ['', '', '', ''];
        var uuidTemplate = t.concat(t, '-', t, '-', t, '-', t, '-', t, t, t);
        var indices = [] as number[];
        for (var idx = 0; idx < uuidTemplate.length; idx++) {
            if (uuidTemplate[idx] !== '-') {
                indices.push(idx);
            }
        }

        var sections = compressed.split(separator);
        var uuidSection = sections[0];
        var uuidLength = uuidSection.length;
        if (uuidLength !== 22 && uuidLength !== 23) {
            return compressed;
        }

        var startIndex = uuidLength === 23 ? 5 : 2;
        for (var n = 0; n < startIndex; n++) {
            uuidTemplate[indices[n]] = uuidSection.charAt(n);
        }

        for (var i = startIndex, j = startIndex; i + 1 < uuidLength; i += 2) {
            var lhs = base64Keys.indexOf(uuidSection.charAt(i));
            var rhs = base64Keys.indexOf(uuidSection.charAt(i + 1));

            uuidTemplate[indices[j++]] = hexChars.charAt(lhs >> 2);
            uuidTemplate[indices[j++]] = hexChars.charAt(((lhs & 3) << 2) | (rhs >> 4));
            uuidTemplate[indices[j++]] = hexChars.charAt(rhs & 0xf);
        }

        var decoded = uuidTemplate.join('');
        return compressed.replace(uuidSection, decoded);
    }
}
