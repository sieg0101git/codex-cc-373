import { AudioSource, Node, sys, Tween, tween, Vec3 } from "cc";
import { ISoundAsset } from "../gccCustomAudioClip";
import { gccSoundInstance } from "../gccSoundInstance";

// sound-engine-adapter.ts
export class gccSoundAdapter {
    protected mapLoadedAssets: Map<string, ISoundAsset> = new Map();
    private nextId: number = 0;
    protected gameNode: Node;
    public audioContext: AudioContext;
    public isWebSound = false;
    constructor(gameNode?: Node) {
        this.isWebSound = (sys.isBrowser == true);
        if (this.isWebSound) {
            this.audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
        }
        this.gameNode = gameNode;
    }

    public getStateAudioContext(): string {
        return this.audioContext.state;
    }

    async ensureAudioUnlocked(): Promise<void> {
        if (!this.isWebSound || this.audioContext.state !== 'suspended') return;
        return new Promise((resolve, reject) => {
            const handler = async () => {
                try {
                    await this.audioContext.resume();
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    if (this.gameNode) this.gameNode.off(Node.EventType.TOUCH_START, handler, this);
                }
            };
            if (this.gameNode) this.gameNode.on(Node.EventType.TOUCH_START, handler, this);
        });
    }

    public loadAsset(asset: ISoundAsset, _options?: any): Promise<void> {
        if (this.mapLoadedAssets.has(asset.key)) return Promise.resolve();
    }

    public unloadAsset(asset: ISoundAsset, _options?: any): Promise<void> {
        if (!this.mapLoadedAssets.has(asset.key)) return Promise.resolve();
    }

    public initAsset(asset: ISoundAsset) : void {
        if (this.mapLoadedAssets.has(asset.key)) {
            console.warn(`Asset with key "${asset.key}" is already loaded.`);
            return;
        }
        this.mapLoadedAssets.set(asset.key, asset);
    }

    public play(instance: gccSoundInstance, _options?: any): void {
        (instance.player as AudioSource).play();
        instance.isPlaying = true;
    }

    public pause(instance: gccSoundInstance, _options?: any): void {
        if (!instance.isPlaying) return;
        (instance.player as AudioSource).pause();
        instance.elapsed = (instance.player as AudioSource).currentTime;
        instance.isPlaying = false;
    }

    public resume(instance: gccSoundInstance, _options?: any): void {
        if (instance.isPlaying) return;
        (instance.player as AudioSource).play();
        instance.isPlaying = true;
    }

    public stop(instance: gccSoundInstance, options?: any): void {
        if (instance.isPlaying) this.pause(instance, options);
        (instance.player as AudioSource).stop();
        this.resetInstance(instance);
    }

    public setInstanceVolume(instance: gccSoundInstance, volume: number, _options?: any): void {
        instance.volume = Math.max(0, Math.min(1, volume));
        instance.muted = volume === 0;
        (instance.player as AudioSource).volume = instance.volume;
    }

    public setInstanceLoop(instance: gccSoundInstance, loop: boolean): void {
        instance.loop = loop;
        (instance.player as AudioSource).loop = loop;
    }
    public getAssetLoadedByKey(key: string): ISoundAsset {
        return this.mapLoadedAssets.get(key);
    }

    public fadeOutVolume(instance: gccSoundInstance, volume: number = 0, duration: number): void {
        Tween.stopAllByTarget(instance.player);
        tween(instance.player)
            .to(duration, {volume : volume})
            .start();
    }

    public createInstance(key: string, _options?: any): gccSoundInstance {
        const { onEnd } = _options;
        const asset = this.getAssetLoadedByKey(key);
        if(!asset) {
            console.warn("asset " + asset.key + "is not loaded" )
            return;
        }
        const id = `inst_${this.nextId++}`; //
        const node = new Node("SoundAudio");
        let audioSource: AudioSource;
        audioSource = node.addComponent(AudioSource);
        audioSource.playOnAwake = false;
        audioSource.clip = asset.src;
        node.parent = this.gameNode;
        node.active = true;
        node.setPosition(new Vec3(0, 0, 0));
        node.on(AudioSource.EventType.ENDED, onEnd);
        const player =  audioSource;
        return {
            id,
            player,
            loop: false,
            asset,
            isPlaying: false,
            elapsed: 0,
            volume: 1,
            muted: false,
        };
    }

    public resetInstance(instance:gccSoundInstance): void {
        instance.loop = false;
        instance.isPlaying = false;
        instance.elapsed = 0;
        instance.volume = 1;
        instance.muted = false;
    }
}

