# Resource cleanup before ending the game

When you need to close the game with `game.end()`, make sure that any additional
resource cleanup logic is executed beforehand. The snippet below shows one way to
release common engine resources prior to terminating the application.

```ts
import { director, assetManager, game, Node } from 'cc';

function releaseSceneNodes(root: Node) {
    root.walk((node) => {
        // Explicitly destroy components or custom caches if necessary.
        node.components?.forEach((comp) => {
            if (typeof (comp as any).dispose === 'function') {
                (comp as any).dispose();
            }
        });

        // Destroy dynamically created nodes to free their memory.
        if (!node.isPersistRoot) {
            node.destroy();
        }
    });
}

export function exitGameSafely() {
    const scene = director.getScene();
    if (scene) {
        releaseSceneNodes(scene);
    }

    // Release any assets that are no longer referenced.
    assetManager.releaseUnusedAssets();

    // Optionally clear caches managed by the Asset Manager.
    assetManager.assets.forEach((asset) => {
        if (asset.refCount === 0) {
            assetManager.releaseAsset(asset);
        }
    });

    // At this point all required cleanup has been performed.
    game.end();
}
```

The `exitGameSafely()` helper centralizes the clean‑up flow and makes it easy to
ensure that nothing calls `game.end()` without first releasing the resources
that your project manages.
