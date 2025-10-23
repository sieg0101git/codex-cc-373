# Phân tích lỗi ScrollView khi lồng vào Toggle

## Mô tả sự cố
Khi sử dụng `Toggle` để bao bọc một `ScrollView`, việc bỏ chọn toggle (ví dụ: gán `ScrollView` làm `checkMark` và để `Toggle` tự động tắt node) sẽ vô hiệu hóa node chứa `ScrollView`. Trong chu kỳ `onDisable()` của `ScrollView`, engine sẽ cố gắng ẩn thanh cuộn bằng cách gọi `_hideScrollBar()`.【F:cocos/ui/scroll-view.ts†L1003-L1016】【F:cocos/ui/scroll-view.ts†L1443-L1451】

`_hideScrollBar()` lần lượt gọi `hide()` trên từng `ScrollBar`, và `ScrollBar.hide()` sử dụng `_setOpacity()` để thay đổi alpha của `Sprite` gắn với thân và tay cầm của thanh cuộn.【F:cocos/ui/scroll-bar.ts†L202-L219】【F:cocos/ui/scroll-bar.ts†L365-L379】

Nếu node `ScrollView` bị vô hiệu hóa thông qua toggle, các `Sprite` của thanh cuộn đã bị vô hiệu hóa trước khi `_setOpacity()` chạy, khiến `this.node.getComponent(Sprite)` hoặc `this._handle.getComponent(Sprite)` trả về `null`. Khi `_setOpacity()` tiếp tục truy cập `renderComp.color`, ta sẽ nhận lỗi `TypeError: Cannot read properties of null (reading 'color')` giống như trong ảnh chụp màn hình.【F:cocos/ui/scroll-bar.ts†L365-L378】

## Tại sao Toggle gây ra lỗi này?
`Toggle` kế thừa `Button`, và khi trạng thái thay đổi nó gọi `playEffect()` để bật/tắt node của `checkMark` trực tiếp.【F:cocos/ui/toggle.ts†L136-L166】Nếu bạn sử dụng chính node chứa `ScrollView` (hoặc một node cha của các thanh cuộn) làm `checkMark`, toggle sẽ đặt `node.active = false`. Việc vô hiệu hóa node làm mất hiệu lực tạm thời các thành phần con, khiến những cuộc gọi ngay sau đó tới `Sprite` bị trả về `null`.

## Cách khắc phục / tránh lỗi
1. **Không gán trực tiếp ScrollView làm `checkMark`:** Giữ một node checkmark riêng (ví dụ một `Sprite` đơn) cho Toggle, và chỉ ẩn/hiện `ScrollView` thông qua sự kiện của Toggle (từ `checkEvents`). Khi xử lý sự kiện, hãy đặt `scrollView.node.active = true/false` sau một khung hình (ví dụ dùng `scheduleOnce`) để tránh chạy xen kẽ với logic `onDisable()`.
2. **Đảm bảo thanh cuộn luôn có Sprite hợp lệ:** Nếu bạn tùy biến `ScrollBar` và bỏ các `Sprite`, hãy thay thế `_setOpacity()` bằng việc thao tác `UIOpacity` hoặc tự kiểm tra `renderComp` trước khi chạm tới `color`. Việc sửa engine có thể thêm kiểm tra null trước khi truy cập `renderComp.color`.
3. **Tuỳ chọn khác:** Thay vì tắt toàn bộ node, cân nhắc đặt `ScrollView` ở chế độ tương tác `enabled = false` hoặc che phủ bằng `UIOpacity`, nhằm tránh kích hoạt chuỗi gọi `_hideScrollBar()` trong lúc các `Sprite` bị vô hiệu hoá.

## Kết luận
Lỗi xuất hiện vì thứ tự vô hiệu hóa node của Toggle làm cho các `Sprite` trong `ScrollBar` trở nên `null` đúng lúc `ScrollView` cố ẩn thanh cuộn. Việc tách riêng checkmark hoặc trì hoãn thao tác ẩn `ScrollView` sẽ tránh được lỗi mà không cần chỉnh sửa mã nguồn của ScrollView.
