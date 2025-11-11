import { gccSoundAdapter } from "../Adapter/gccSoundAdapter";
import { ISoundAsset } from "../gccCustomAudioClip";
import { gccSoundInstance } from "../gccSoundInstance";

export interface ChannelConfig {
    maxInstances: number;   // (1 for BGM, more for SFX)
    defaultLoop: boolean;   // default loop for BGM
    fadeDuration: number;   // time for change bgm
    maxPoolSize: number;    // max size pool per asset
}
export abstract class gccSoundChannel {
    protected adapter: gccSoundAdapter;
    protected config: ChannelConfig;
    public activeInstances: Map<string, gccSoundInstance> = new Map();
    public instancePool: Map<string, gccSoundInstance[]> = new Map();
    public maxTotalCurrentSoundInstance: number = 10;
    public channelVolume: number = 1;
    public channelEnabled: boolean = false;


    public constructor(adapter: gccSoundAdapter, config: Partial<ChannelConfig>) {
        this.adapter = adapter;
        this.config = this.getDefaultConfig(config);
    }

    protected abstract getDefaultConfig(partialConfig: Partial<ChannelConfig>): ChannelConfig;


    async load(asset: ISoundAsset): Promise<void> {
        await this.adapter.loadAsset(asset);
        this.instancePool.set(asset.key, []);
    }

    async unload(asset: ISoundAsset): Promise<void> {
        await this.adapter.unloadAsset(asset);
        // Remove from active if any
        this.activeInstances.forEach((inst, mapKey) => {
            if (inst.asset.key === asset.key) {
                this.stop(mapKey);
            }
        });
        // Clear pool for key
        const pool = this.instancePool.get(asset.key) || [];
        pool.forEach(inst => this.adapter.stop(inst));
        this.instancePool.delete(asset.key);
    }

    public initSoundAssets(assets: ISoundAsset[]): void {
        assets.forEach(asset => {
            this.adapter.initAsset(asset);
            this.instancePool.set(asset.key, []);
        });
    }

    async play(key: string, options?: any): Promise<string> {
        if (!this.instancePool.has(key)) {
            return;
        }
        if (this.activeInstances.size >= this.config.maxInstances) {
            const oldestKey = this.activeInstances.keys().next().value;
            this.stop(oldestKey);
        }
        if (this.adapter.isWebSound === true && this.adapter.getStateAudioContext() === 'suspended') {
            await this.adapter.ensureAudioUnlocked();
        }
        let instance = this.instancePool.get(key)?.pop();
        if (!instance) {
            instance = this.adapter.createInstance(key, {
                onEnd: () => {
                    this.stop(instance.id);
                }
            });
        }
        const loop = options && options.loop ? options.loop : false;
        const volume = this.channelEnabled ? (options?.volume ?? this.channelVolume): 0;
        this.adapter.play(instance, { offset: instance.elapsed || 0 });
        this.adapter.setInstanceLoop(instance, loop);
        this.adapter.setInstanceVolume(instance, volume);
        this.activeInstances.set(instance.id, instance);
        return instance.id;
    }
    async playOneShot(key: string, options?: any): Promise<string> {
        if (this.activeInstances.size >= this.config.maxInstances) {
            const oldestKey = this.activeInstances.keys().next().value;
            this.stop(oldestKey);
        }
        await this.adapter.ensureAudioUnlocked();
        let instance = this.instancePool.get(key)?.pop();
        if (!instance) {
            instance = this.adapter.createInstance(key, {
                onEnd: () => {
                    this.stop(instance.id);
                }
            });
        }
        const loop = options && options.loop ? options.loop : false;
        const volume = this.channelEnabled ? (options?.volume ?? this.channelVolume): 0;
        this.adapter.play(instance, { offset: instance.elapsed || 0 });
        this.adapter.setInstanceLoop(instance, loop);
        this.adapter.setInstanceVolume(instance, volume);
        this.activeInstances.set(instance.id, instance);
        return instance.id;
    }


    pause(id: string): void {
        const instance = this.activeInstances.get(id);
        if (instance) {
            this.adapter.pause(instance);
            const pool = this.instancePool.get(instance.asset.key);
            if (pool.length < this.config.maxPoolSize) {
                pool.push(instance);
            } else {
                this.adapter.pause(instance);
            }
        }
    }

    resume(id: string): void {
        const instance = this.activeInstances.get(id);
        if (instance) {
            this.adapter.resume(instance);
        }
    }

    stop(id: string): void {
        const instance = this.activeInstances.get(id);
        if (instance) {
            this.adapter.stop(instance);
            this.activeInstances.delete(id);
            this.instancePool.get(instance.asset.key)?.push(instance);
        }
    }

    pauseAll(): void {
        this.activeInstances.forEach((_inst, key) => {
            this.pause(key);
        });
    }

    stopAll(): void {
        this.activeInstances.forEach((_inst, key) => {
            this.stop(key);
        });
        this.activeInstances.clear();
    }

    // Mute/Unmute channel
    muteChannel(): void {
        this.channelEnabled = false;
        this.channelVolume = 0;
        this.activeInstances.forEach(inst => this.adapter.setInstanceVolume(inst, this.channelVolume));
    }

    unmuteChannel(): void {
        this.channelEnabled = true;
        this.channelVolume = 1;
        this.activeInstances.forEach(inst => this.adapter.setInstanceVolume(inst, this.channelVolume));
    }

    setChannelVolume(volume: number): void {
        this.channelVolume = Math.max(0, Math.min(1, volume));
        this.activeInstances.forEach(inst => this.adapter.setInstanceVolume(inst, this.channelEnabled ? this.channelVolume: 0));
    }

    getChannelVolume(): number {
        return this.channelVolume;
    }

    // Mute/Unmute instance
    muteInstance(id: string): void {
        const instance = this.activeInstances.get(id);
        if (instance) {
            this.adapter.setInstanceVolume(instance, 0);
        }
    }

    unmuteInstance(id: string): void {
        const instance = this.activeInstances.get(id);
        if (instance) {
            this.adapter.setInstanceVolume(instance, instance.volume);
        }
    }

    setInstanceVolume(id: string, volume: number): void {
        const instance = this.activeInstances.get(id);
        if (instance) {
            this.adapter.setInstanceVolume(instance, volume);
        }
    }
    getActiveInstanceByKey(key: string): gccSoundInstance | null {
        const instances = this.activeInstances.values();
        let result: IteratorResult<gccSoundInstance>;
        while (!(result = instances.next()).done) {
            const instance = result.value;
            if (instance.asset.key === key) return instance;
        }
        return null;
    }

    getActivesIdByKey(key: string): string[] {
        const instances = this.activeInstances.values();
        let arr: IteratorResult<gccSoundInstance>;
        let ret: string[] = [];
        while (!(arr = instances.next()).done) {
            const instance = arr.value;
            if (instance.asset.key === key) {
                ret.push(instance.id);
            }
        }
        return ret;
    }
}

