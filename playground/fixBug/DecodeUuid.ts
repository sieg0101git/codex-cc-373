import { _decorator, Component, EventKeyboard, Input, input, KeyCode } from 'cc';

const { ccclass } = _decorator;

@ccclass('DecodeUuid')
export class DecodeUuid extends Component {
    protected onLoad() {
        input.on(Input.EventType.KEY_DOWN, (evt: EventKeyboard) => {
            if (evt.keyCode === KeyCode.DIGIT_1) {
                const compressed = '3c592c4GwhMVZgtpvUZq1Tw';
                const uuid = this.decodeCompressedUuid(compressed);
                console.log('Decoded UUID:', uuid);
                console.log('Output want UUID: 3c592738-1b08-4c55-982d-a6f519ab54f0');
            }
        });
    }

    private decodeCompressedUuid(compressed: string) {

    }
}
