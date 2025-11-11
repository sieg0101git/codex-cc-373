import { _decorator, AudioClip, CCInteger } from 'cc';

const { ccclass, property } = _decorator;


export interface ISoundAsset {
    key: string;
    path?: string;
    maxCount: number;
    destroyedOnSwitchMode: boolean;
    ignoreCheckMaxInstance: boolean;
    src: any;
}
@ccclass('gccCustomAudioClip')
export class gccCustomAudioClip implements ISoundAsset {
    path?: string = null;
    @property key: string = '';
    @property({ type: AudioClip })
    src: AudioClip = null;
    @property({ type: CCInteger })
    maxCount = 1;
    @property ignoreCheckMaxInstance: boolean = false;
    @property destroyedOnSwitchMode: boolean = false;
}

