import { ISoundAsset } from "./gccCustomAudioClip";

export interface gccSoundInstance {
    id: string; 
    asset: ISoundAsset;
    player: any;
    loop: boolean;
    isPlaying: boolean;
    elapsed?: number;
    volume: number; 
    muted: boolean;
}