import { _decorator } from 'cc';
import { gccSoundBase } from './gccSoundBase';

const { ccclass, property } = _decorator;
@ccclass('gccSoundController')
export class gccSoundController extends gccSoundBase {
    protected currSoundBigWin = null;
    protected listKeyBigWin = ["sfxBig_win", "sfxSuper_win", "sfxMega_win"]
    @property isDebug: boolean = false;

    protected static _instance: gccSoundController = null;
    public static get instance() : gccSoundController {
        return gccSoundController._instance;
    }
    public set instance(v : gccSoundController) {
        gccSoundController._instance = v;
    }

    protected onLoad(): void {
        super.onLoad();
        this.instance = this;
        if (this.isDebug) {
            console.warn("musicList", this.bgmList.map(soundObj => soundObj.key));
            console.warn("sfxList", this.sfxList.map(soundObj => soundObj.key))
        }
    }

    public stopSfxBigWin() {
        if (this.currSoundBigWin) {
            this.getSFXChannel().stop(this.currSoundBigWin);
            this.currSoundBigWin = null;
        }
    }

    public playBgmRoom(): void {
        this.playBGM("bgmMain");
    }

    public playBgmLobby(): void {
        this.playBGM("bgmLobby");
    }

    public playSfxCatch(): void {
        void this.playSFX("sfxCatch");
    }

    public playSfxDropCoin(): void {
        void this.playSFX("sfxGold");
    }

    public playSfxFireLaser(): void {
        void this.playSFX("sfxFire_laser");
    }

    public playSfxFire() {
        void this.playSFX("sfxGun_fire");
    }

    public playSfxClick() {
        void this.playSFX("sfxClick");
    }

    public playSFXClickBet() {
        this.playSfxClick();
    }

    public playSfxBigWin(): void {
        this.setVolumeBGM(0.4);
        this.setVolumeSFX(0.6);
        this.listKeyBigWin.forEach(key => {
            const inst = this.sfxChannel.getActiveInstanceByKey(key);
            if (inst) {
                this.sfxChannel.stop(inst.id);
            }
        });
        this.currSoundBigWin = this.playSFX("sfxBig_win", {
            onEnd: () => { this.setVolumeAll(1.0); }
        });
    }

    public playSfxSuperWin(): void {
        this.setVolumeBGM(0.4);
        this.setVolumeSFX(0.6);
        this.listKeyBigWin.forEach(key => {
            const inst = this.sfxChannel.getActiveInstanceByKey(key);
            if (inst) {
                this.sfxChannel.stop(inst.id);
            }
        });
        this.currSoundBigWin = this.playSFX("sfxSuper_win", {
            onEnd: () => { this.setVolumeAll(1.0); }
        });
    }

    public playSfxMegaWin(): void {
        this.setVolumeBGM(0.4);
        this.setVolumeSFX(0.6);
        this.listKeyBigWin.forEach(key => {
            const inst = this.sfxChannel.getActiveInstanceByKey(key);
            if (inst) {
                this.sfxChannel.stop(inst.id);
            }
        });
        this.currSoundBigWin = this.playSFX("sfxMega_win", {
            onEnd: () => { this.setVolumeAll(1.0); }
        });
    }

    public onDestroy(): void {
        gccSoundController._instance = null;
        super.onDestroy();
    }
}

