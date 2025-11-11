import { _decorator } from 'cc';
import { gccSoundBase } from './gccSoundBase';

type BigWinKey = "sfxBig_win" | "sfxSuper_win" | "sfxMega_win";

const { ccclass, property } = _decorator;
@ccclass('gccSoundController')
export class gccSoundController extends gccSoundBase {
    protected currSoundBigWin: string | null = null;
    protected readonly listKeyBigWin: BigWinKey[] = ["sfxBig_win", "sfxSuper_win", "sfxMega_win"];
    private previousVolumeBeforeBigWin: { bgm: number; sfx: number } | null = null;
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
            this.restoreVolumeAfterBigWin();
            return;
        }
        this.getSFXChannel().stop(currSoundBigWin);
        this.currSoundBigWin = null;
        this.restoreVolumeAfterBigWin();
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
        this.prepareBigWinVolumes();
        this.stopOtherBigWinInstances();
        let trackedInstanceId: string | null = null;
        const instanceId = await this.playSFX(key, {
            onEnd: () => {
                if (trackedInstanceId && this.currSoundBigWin === trackedInstanceId) {
                    this.currSoundBigWin = null;
                    this.restoreVolumeAfterBigWin();
                }
            }
        });
        trackedInstanceId = instanceId ?? null;
        if (!instanceId) {
            this.restoreVolumeAfterBigWin();
            return;
        }
        this.currSoundBigWin = instanceId;
    }

    private prepareBigWinVolumes(): void {
        if (!this.previousVolumeBeforeBigWin) {
            this.previousVolumeBeforeBigWin = {
                bgm: this.getBGMChannel().getChannelVolume(),
                sfx: this.getSFXChannel().getChannelVolume(),
            };
        }
        this.setVolumeBGM(0.4);
        this.setVolumeSFX(0.6);
    }

    private stopOtherBigWinInstances(): void {
        const idsToStop: string[] = [];
        this.sfxChannel.activeInstances.forEach((instance, id) => {
            if (this.isBigWinKey(instance.asset.key)) {
                idsToStop.push(id);
            }
        });
        const total = idsToStop.length;
        for (let index = 0; index < total; index += 1) {
            const instanceId = idsToStop[index];
            this.sfxChannel.stop(instanceId);
            if (this.currSoundBigWin === instanceId) {
                this.currSoundBigWin = null;
            }
        }
    }

    private restoreVolumeAfterBigWin(): void {
        if (!this.previousVolumeBeforeBigWin) {
            return;
        }
        this.setVolumeBGM(this.previousVolumeBeforeBigWin.bgm);
        this.setVolumeSFX(this.previousVolumeBeforeBigWin.sfx);
        this.previousVolumeBeforeBigWin = null;
    }

    private isBigWinKey(key: string): key is BigWinKey {
        const { listKeyBigWin } = this;
        const total = listKeyBigWin.length;
        for (let index = 0; index < total; index += 1) {
            if (listKeyBigWin[index] === key) {
                return true;
            }
        }
        return false;
    }
}

