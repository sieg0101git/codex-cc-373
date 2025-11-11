import { director } from 'cc';
import { ChannelConfig, gccSoundChannel } from './gccSoundChannel';

interface FramePlayCounter {
    frame: number;
    count: number;
}
export class gccSFXChannel extends gccSoundChannel {
    private framePlayLimiter: Map<string, FramePlayCounter> = new Map();

    protected getDefaultConfig(partialConfig: Partial<ChannelConfig>): ChannelConfig {
        return {
            maxInstances: partialConfig.maxInstances ?? 10,
            defaultLoop: false,
            fadeDuration: 0,
            maxPoolSize: partialConfig.maxPoolSize ?? 5,
            ...partialConfig,
        };
    }

    public async play(key: string, options?: any): Promise<string | null> {
        const frame = director.getTotalFrames();
        const counter = this.ensureFramePlayCounter(key, frame);
        if (counter.count >= 2) {
            return null;
        }
        counter.count += 1;
        const id = await super.play(key, options);
        if (!id) {
            counter.count -= 1;
        }
        return id;
    }

    public async playOneShot(key: string, options?: any): Promise<string | null> {
        const frame = director.getTotalFrames();
        const counter = this.ensureFramePlayCounter(key, frame);
        if (counter.count >= 2) {
            return null;
        }
        counter.count += 1;
        const id = await super.playOneShot(key, options);
        if (!id) {
            counter.count -= 1;
        }
        return id;
    }

    pauseAll(): void {
        this.stopAll();
    }

    private ensureFramePlayCounter(key: string, frame: number): FramePlayCounter {
        let counter = this.framePlayLimiter.get(key);
        if (!counter || counter.frame !== frame) {
            counter = { frame, count: 0 };
            this.framePlayLimiter.set(key, counter);
        }
        return counter;
    }
}
