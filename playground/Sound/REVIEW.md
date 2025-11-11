# Sound module review

## Summary
This document captures issues identified during the review of the `playground/Sound` sound management system.

## Findings
1. **`gccSoundController` stores a promise instead of an instance id**  
   `playSfxBigWin`, `playSfxSuperWin`, and `playSfxMegaWin` assign the `Promise` returned by `playSFX` to `currSoundBigWin`. Later, `stopSfxBigWin` passes that promise to `stop`, which expects an instance id string. This means the current big-win effect cannot be stopped and can leave leaked entries in the channel map.  
   _File_: `gccSoundController.ts`, lines 28-105.

2. **`gccSoundAdapter.createInstance` logs `asset.key` even when `asset` is undefined**  
   When an asset is missing, the guard logs `asset.key`, but `asset` is `undefined`, raising an exception that hides the real error.  
   _File_: `gccSoundAdapter.ts`, lines 102-108.

3. **BGM fade-out removes the wrong key from `activeInstances`**  
   `fadeOutCurrent` deletes `this.currentBgmKey` from the `activeInstances` map, but the map is keyed by instance id, not by asset key. This leaves the old BGM instance stuck in the active map and its pool, preventing full cleanup.  
   _File_: `Channel/gccBGMChannel.ts`, lines 50-59.

4. **Channel pause logic can read `.length` on `undefined` pools**  
   `pause` assumes a pool exists for `instance.asset.key`, but if the asset was never preloaded (or the pool was removed), `pool` is `undefined` and accessing `pool.length` throws.  
   _File_: `Channel/gccSoundChannel.ts`, lines 106-117.

5. **`loadAsset` / `unloadAsset` stubs break the expected contract**  
   Both functions claim to return a `Promise<void>` but fall through without resolving when an asset is not cached. Callers `await` these functions, so the current implementation silently returns `undefined` and never registers or unloads the asset.  
   _File_: `gccSoundAdapter.ts`, lines 41-47.

