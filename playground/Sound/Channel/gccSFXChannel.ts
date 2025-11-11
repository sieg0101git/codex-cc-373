import { ChannelConfig, gccSoundChannel } from './gccSoundChannel';
export class gccSFXChannel extends gccSoundChannel {
    protected getDefaultConfig(partialConfig: Partial<ChannelConfig>): ChannelConfig {
        return {
            maxInstances: partialConfig.maxInstances ?? 10,
            defaultLoop: false,
            fadeDuration: 0,
            maxPoolSize: partialConfig.maxPoolSize ?? 5,
            ...partialConfig,
        };
    }

    pauseAll(): void {
        this.stopAll();
    }
}
