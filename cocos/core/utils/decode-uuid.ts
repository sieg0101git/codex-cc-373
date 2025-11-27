/*
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import { TEST } from 'internal:constants';
import { BASE64_VALUES } from './misc';
import { legacyCC } from '../global-exports';

const separator = '@';

const HexChars = '0123456789abcdef'.split('');

const _t = ['', '', '', ''];
const UuidTemplate = _t.concat(_t, '-', _t, '-', _t, '-', _t, '-', _t, _t, _t);
const Indices = UuidTemplate.map((x, i) => (x === '-' ? NaN : i)).filter(Number.isFinite);

/**
 * @en
 * Decode base64-compressed uuid.
 *
 * @zh
 * 解码用 base64 压缩过的 uuid。
 *
 * @param  base64 @en Base-64 compressed uuid. @zh 用 base-64 压缩过的 uuid。
 * @returns @en Original uuid. @zh 未压缩过的 uuid。
 *
 * @example
 * ```ts
 * const uuid = 'fcmR3XADNLgJ1ByKhqcC5Z';
 * const originalUuid = decodeUuid(uuid); // fc991dd7-0033-4b80-9d41-c8a86a702e59
 * ```
 */
export default function decodeUuid (base64: string) {
    const strs = base64.split(separator);
    const uuid = strs[0];
    if (uuid.length !== 22 && uuid.length !== 23) {
        return base64;
    }
    UuidTemplate[0] = base64[0];
    UuidTemplate[1] = base64[1];
    if (uuid.length === 22) {
        for (let i = 2, j = 2; i < 22; i += 2) {
            const lhs = BASE64_VALUES[base64.charCodeAt(i)];
            const rhs = BASE64_VALUES[base64.charCodeAt(i + 1)];
            UuidTemplate[Indices[j++]] = HexChars[lhs >> 2];
            UuidTemplate[Indices[j++]] = HexChars[((lhs & 3) << 2) | rhs >> 4];
            UuidTemplate[Indices[j++]] = HexChars[rhs & 0xF];
        }
        return base64.replace(uuid, UuidTemplate.join(''));
    }

    let encoded = uuid.slice(2);
    const mod = encoded.length % 4;
    if (mod === 1) {
        return base64;
    }
    if (mod > 0) {
        encoded += '===='.slice(mod);
    }
    const bytes: number[] = [];
    for (let i = 0; i < encoded.length; i += 4) {
        const lhs = BASE64_VALUES[encoded.charCodeAt(i)];
        const mid = BASE64_VALUES[encoded.charCodeAt(i + 1)];
        const rhs = BASE64_VALUES[encoded.charCodeAt(i + 2)];
        const end = BASE64_VALUES[encoded.charCodeAt(i + 3)];
        bytes.push((lhs << 2) | (mid >> 4));
        if (rhs !== 64) {
            bytes.push(((mid & 0x0F) << 4) | (rhs >> 2));
        }
        if (end !== 64) {
            bytes.push(((rhs & 0x03) << 6) | end);
        }
    }

    for (let i = 0, j = 2; i < bytes.length && j < Indices.length; i++) {
        const byte = bytes[i];
        UuidTemplate[Indices[j++]] = HexChars[byte >> 4];
        UuidTemplate[Indices[j++]] = HexChars[byte & 0x0F];
    }

    return UuidTemplate.join('');
}

if (TEST) {
    legacyCC._Test.decodeUuid = decodeUuid;
}
