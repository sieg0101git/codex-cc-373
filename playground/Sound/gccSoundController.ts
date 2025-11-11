import { _decorator } from 'cc';
import { gccSoundBase } from './gccSoundBase';

type BigWinKey = "sfxBig_win" | "sfxSuper_win" | "sfxMega_win";

const { ccclass, property } = _decorator;
@ccclass('gccSoundController')
export class gccSoundController extends gccSoundBase {
    protected currSoundBigWin: string | null = null;
    protected readonly listKeyBigWin: BigWinKey[] = ["sfxBig_win", "sfxSuper_win", "sfxMega_win"];
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

    public stopSfxBigWin(): void {
        const { currSoundBigWin } = this;
        if (!currSoundBigWin) {
            return;
        }
        this.getSFXChannel().stop(currSoundBigWin);
        this.currSoundBigWin = null;
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
        void this.playBigWinSfx("sfxBig_win");
    }

    public playSfxSuperWin(): void {
        void this.playBigWinSfx("sfxSuper_win");
    }

    public playSfxMegaWin(): void {
        void this.playBigWinSfx("sfxMega_win");
    }

    public onDestroy(): void {
        gccSoundController._instance = null;
        super.onDestroy();
    }

    private async playBigWinSfx(key: BigWinKey): Promise<void> {
        this.applyBigWinVolume();
        this.stopOtherBigWinInstances();
        const instanceId = await this.playSFX(key, {
            onEnd: () => {
                this.currSoundBigWin = null;
                this.setVolumeAll(1.0);
            }
        });
        this.currSoundBigWin = instanceId ?? null;
    }

    private applyBigWinVolume(): void {
        this.setVolumeBGM(0.4);
        this.setVolumeSFX(0.6);
    }

    private stopOtherBigWinInstances(): void {
        const { listKeyBigWin } = this;
        const { length } = listKeyBigWin;
        for (let index = 0; index < length; index += 1) {
            const key = listKeyBigWin[index];
            const activeIds = this.sfxChannel.getActivesIdByKey(key);
            const total = activeIds.length;
            for (let idIndex = 0; idIndex < total; idIndex += 1) {
                this.sfxChannel.stop(activeIds[idIndex]);
            }
        }
    }
}

