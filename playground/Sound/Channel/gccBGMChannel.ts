import { ChannelConfig, gccSoundChannel } from './gccSoundChannel';
export class gccBGMChannel extends gccSoundChannel {
    protected currentBgmKey?: string;
    protected getDefaultConfig(partialConfig: Partial<ChannelConfig>): ChannelConfig {
        return {
            maxInstances: 1,
            defaultLoop: true,
            fadeDuration: partialConfig.fadeDuration ?? 1,
            maxPoolSize: partialConfig.maxPoolSize ?? 5,
            ...partialConfig,
        };
    }

    async play(key: string, options: any = {loop: true, volume: 1.}): Promise<string> {
        let instanceId = null;
        if (this.currentBgmKey) {
            if(this.currentBgmKey !== key) {
                this.fadeOutCurrent();
                instanceId = await super.play(key, options);
                this.currentBgmKey = key;
            } else {
                instanceId = this.getActiveInstanceByKey(key).id;
                this.resume(instanceId);
                return instanceId;
            }
        } else {
            instanceId = await super.play(key, options);
            this.currentBgmKey = key;
        }
        return instanceId;
    }

    resume(id: string): void {
        super.resume(id);
        const instance = this.activeInstances.get(id);
        if(instance) {
            this.currentBgmKey = instance.asset.key;
        }
    }
    pause(id: string): void {
        super.pause(id);
        this.currentBgmKey = undefined;
    }

    stop(id: string): void {
        super.stop(id);
        this.currentBgmKey = undefined;
    }

    // Fade out current BGM
    private fadeOutCurrent(): void {
        if (!this.currentBgmKey) return;
        const instance = this.getActiveInstanceByKey(this.currentBgmKey);
        this.activeInstances.delete(this.currentBgmKey);
        if (instance) {
            this.adapter.fadeOutVolume(instance, 0, this.config.fadeDuration);
            setTimeout(() => {
                this.adapter.stop(instance);
            }, this.config.fadeDuration * 1000);
        }
    }
}

