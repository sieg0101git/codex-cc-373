import { gccSFXChannel } from "./Channel/gccSFXChannel";
import { gccBGMChannel } from "./Channel/gccBGMChannel";
import { gccSoundAdapter } from "./Adapter/gccSoundAdapter";
import { gccCustomAudioClip, ISoundAsset } from "./gccCustomAudioClip";
import { _decorator, Component, Node, sys } from 'cc';
import loadConfigAsync from "../../../../cc-share/shareServices/loadConfigAsync";
import { gccRegisterEvent, gccRemoveEvents } from "../gccEventEmitter";
import { gccGameEvent } from "../gccGameEvent";

const {
    ccclass,
    property
} = _decorator;

@ccclass('gccSoundBase')
export class gccSoundBase extends Component {
    protected adapter: gccSoundAdapter;
    protected sfxChannel: gccSFXChannel = null;
    protected bgmChannel: gccBGMChannel = null;

    @property({ type: [gccCustomAudioClip] })
    bgmList: gccCustomAudioClip[] = [];

    @property({ type: [gccCustomAudioClip] })
    sfxList: gccCustomAudioClip[] = [];

    @property
    bgmVolume: number = 0.8;

    @property
    sfxVolume: number = 0.5;
    @property
    storageKeyBGM = "enableBackgroundMusic";

    @property
    storageKeySFX = "enableSound";

    protected onLoad(): void {
        this.initSoundAdapter(this.node);
        this.initChannel();
        this.loadCacheConfig();
        gccRegisterEvent(gccGameEvent.COMMON.GAME_SHOW, this.onEventShow, this);
        gccRegisterEvent(gccGameEvent.COMMON.GAME_HIDE, this.onEventHide, this);
        gccRegisterEvent(gccGameEvent.SOUND.ENABLE_BGM_SETTING, this.enableBgm, this);
        gccRegisterEvent(gccGameEvent.SOUND.ENABLE_SFX_SETTING, this.enableSfx, this);
        gccRegisterEvent(gccGameEvent.SOUND.UPDATE_BGM_VOL_SETTING, this.updateBGMSettingVolume, this);
        gccRegisterEvent(gccGameEvent.SOUND.UPDATE_SFX_VOL_SETTING, this.updateSFXSettingVolume, this);

        this.node.setSiblingIndex(this.node.parent.children.length + 1);
        this.initAssets();
    }

    protected initAssets(): void {
        this.initBGMAssets(this.bgmList);
        this.initSFXAssets(this.sfxList);
        this.setVolumeBGM(this.bgmVolume);
        this.setVolumeSFX(this.sfxVolume);

    }

    public getBGMChannel(): gccBGMChannel {
        return this.bgmChannel;
    }

    public getSFXChannel(): gccSFXChannel {
        return this.sfxChannel;
    }

    protected loadCacheConfig() {
        const {
            ENABLE_BGM,
            ENABLE_SFX
        } = loadConfigAsync.getConfig();
        this.storageKeyBGM = ENABLE_BGM ? ENABLE_BGM : this.storageKeyBGM;
        this.storageKeySFX = ENABLE_SFX ? ENABLE_SFX : this.storageKeySFX;
        let isEnabledBgm = sys.localStorage.getItem(this.storageKeyBGM);
        let isEnabledSfx = sys.localStorage.getItem(this.storageKeySFX);
        this.bgmChannel.channelEnabled = (isEnabledBgm != null) ? JSON.parse(isEnabledBgm) : true;
        this.sfxChannel.channelEnabled = (isEnabledSfx != null) ? JSON.parse(isEnabledSfx) : true;
        let bgmVolume = this.bgmChannel.channelEnabled ? 1 : 0;
        let sfxVolume = this.sfxChannel.channelEnabled ? 1 : 0;
        this.bgmChannel.setChannelVolume(bgmVolume);
        this.sfxChannel.setChannelVolume(sfxVolume);
    }

    protected initChannel(): void {
        this.bgmChannel = new gccBGMChannel(this.adapter, { fadeDuration: 0.2 });
        this.sfxChannel = new gccSFXChannel(this.adapter, { maxInstances: 20 });
    }

    protected initSoundAdapter(gameNode: Node): void {
        this.adapter = new gccSoundAdapter(gameNode);
    }

    async loadForBGM(asset: ISoundAsset): Promise<void> {
        await this.bgmChannel.load(asset);
    }

    async loadForSFX(asset: ISoundAsset): Promise<void> {
        await this.sfxChannel.load(asset);
    }

    async unloadForBGM(asset: ISoundAsset): Promise<void> {
        await this.bgmChannel.unload(asset);
    }

    async unloadForSFX(asset: ISoundAsset): Promise<void> {
        await this.sfxChannel.unload(asset);
    }

    public initBGMAssets(soundList: ISoundAsset[]) {
        if (soundList.length) {
            this.bgmChannel.initSoundAssets(soundList);
        }
    }

    public initSFXAssets(soundList: ISoundAsset[]): void {
        if (soundList.length) {
            this.sfxChannel.initSoundAssets(soundList);
        }
    }

    protected onEventHide(): void {
        this.bgmChannel.pauseAll();
        this.sfxChannel.stopAll();
    }

    protected onEventShow(): void {
        const currentBgm = this.bgmChannel.activeInstances.keys().next().value;
        this.bgmChannel.resume(currentBgm);
    }

    public setVolumeBGM(value: number) {
        this.bgmChannel.setChannelVolume(value);
    }



    public enableBgm(enable: boolean): void {
        if(enable) {
            this.bgmChannel.unmuteChannel();
        } else {
            this.bgmChannel.muteChannel();
        }
        sys.localStorage.setItem(this.storageKeyBGM, enable.toString());
    }
    public enableSfx(enable: boolean): void {
        if(enable) {
            this.sfxChannel.unmuteChannel();
        } else {
            this.sfxChannel.muteChannel();
        }
        sys.localStorage.setItem(this.storageKeySFX, enable.toString());
    }

    protected updateBGMSettingVolume(volume: number) {
        this.enableBgm(volume > 0);
        this.bgmChannel.setChannelVolume(volume);
    }

    protected updateSFXSettingVolume(volume: number): void {
        this.enableSfx(volume > 0);
        this.sfxChannel.setChannelVolume(volume);
    }

    public setVolumeSFX(value: number) {
        this.sfxChannel.setChannelVolume(value);
    }

    public setVolumeAll(value: number) {
        this.bgmChannel.setChannelVolume(value);
        this.sfxChannel.setChannelVolume(value);
    }

    public resumeAll(): void {
        const currentBgm = this.bgmChannel.activeInstances.keys().next().value;
        this.bgmChannel.resume(currentBgm);
        this.sfxChannel.activeInstances.forEach((_inst, key) => this.sfxChannel.resume(key));
    }

    public pauseAll() {
        this.bgmChannel.pauseAll();
        this.sfxChannel.pauseAll();
    }

    public stopAll() {
        this.bgmChannel.stopAll();
        this.sfxChannel.stopAll();
    }

    async playBGM(key: string, options: { loop: boolean; volume: number } = { loop: true, volume: 1. }): Promise<string | null> {
        return await this.bgmChannel.play(key, options);
    }

    async playSFX(key: string, options: { loop?: boolean; volume?: number; onEnd?: Function } = { loop: false, volume: 1., onEnd: () => { } }): Promise<string | null> {
        return await this.sfxChannel.play(key, options);
    }

    async playOneShotSFX(key: string, options: { loop?: boolean; volume?: number }): Promise<string | null> {
        return await this.sfxChannel.playOneShot(key, options);
    }

    protected onDestroy(): void {
        this.stopAll();
        gccRemoveEvents(this);
    }

}

