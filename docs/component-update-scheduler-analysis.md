# Phân tích chi tiết scheduler `cc.Component.update()`

> Bối cảnh: tạo 1.000 viên đạn → 1.000 `cc.Node` → 1.000 component có `update()`; một số bullet tắt `enabled = false` hoặc bị vô hiệu hoá.

## 1. Hệ thống scheduler của engine hoạt động ra sao?

1. **Thu thập component có vòng đời cập nhật**
   - Khi một component lần đầu `onLoad()` hoặc `onEnable()`, engine đẩy nó vào một cấu trúc dạng danh sách (array + bucket theo priority) thuộc `ComponentScheduler`.
   - Mỗi khung hình, `Director` → `ComponentScheduler::startPhase()` sẽ duyệt qua các danh sách: `startComponents`, `updateComponents`, `lateUpdateComponents`… rồi lần lượt gọi callback tương ứng.
   - Dù component `enabled = false`, tham chiếu vẫn nằm trong mảng (để tránh phải cấp phát/lấy lại bộ nhớ mỗi lần bật/tắt).

2. **Bước lọc trạng thái trước khi gọi**
   - Trong vòng lặp, engine kiểm tra từng entry: `if (comp._enabled && comp.node.activeInHierarchy)` trước khi thực sự gọi `comp.update(dt)`.
   - Component bị tắt sẽ **bị bỏ qua**, nhưng vòng lặp vẫn phải thực thi câu điều kiện và tiếp tục index.
   - Đây là lý do “toggle enabled không xoá khỏi danh sách” – engine ưu tiên tính ổn định và tránh chi phí thêm/xóa liên tục.

3. **Giữ tham chiếu trong native binding**
   - Với WebGL1/WebMobile, layer JS tương tác với native (C++/wasm) qua binding. Danh sách update tồn tại ở phía JS, nhưng mỗi component/node vẫn giữ handle tới native object.
   - Khi scheduler duyệt, nó cần giữ reference để tránh GC thu hồi giữa chừng; điều này làm tăng **bộ nhớ tạm**.

## 2. Hậu quả khi có 1.000 bullet

| Khía cạnh | Ảnh hưởng |
|-----------|-----------|
| **Traversal cost** | Mỗi frame, vòng lặp vẫn phải đi hết 1.000 phần tử, thực hiện điều kiện `if enabled`. Chi phí O(N) tồn tại dù phần lớn bullet đã tắt. |
| **GC pressure** | Bullet thường có vòng đời ngắn (spawn → bay → huỷ). Mỗi lần bị xoá, JS phải giải phóng component + node, nhưng trước đó scheduler vẫn giữ reference, gây **delay** thu gom và tạo nhiều rác ngắn hạn. |
| **Lookup trong binding** | Khi scheduler kiểm tra trạng thái, nó chạm vào `comp.node`. Điều này kích hoạt lookup qua proxy JS ↔ native (nếu dùng JSB). Với 1.000 phần tử, tổng số lookup mỗi frame tăng mạnh. |
| **Bộ nhớ list** | Danh sách update giữ object pointer + metadata (priority, dirty flag). 1.000 entry không quá lớn nhưng cộng dồn với các hệ thống khác (AI, UI, effect) sẽ tốn RAM JS. |

## 3. Vì sao chỉ tắt `enabled` vẫn tốn chi phí?

1. **Danh sách không shrink ngay**: engine tránh thao tác `splice`/`filter` mỗi khi toggled vì có thể gây chậm hơn nếu bật/tắt liên tục.
2. **Dirty flag phải xử lý**: khi bạn toggle, engine đánh dấu `scheduler.dirty`. Frame kế tiếp phải “rehash” danh sách để đảm bảo thứ tự priority đúng – thao tác này vẫn duyệt qua toàn bộ array.
3. **GC phụ thuộc reference**: scheduler giữ tham chiếu mạnh. Chỉ khi bạn `destroy()` node/component và để scheduler “cắt” khỏi danh sách trong phase `destroyComp` thì GC mới thu được.

## 4. Biện pháp giảm tải

1. **Quản lý tập trung (pattern `BulletManager`)**
   - Giữ `update()` duy nhất để scheduler chỉ thấy **1 component**. Toàn bộ bullet hoạt động được lưu trong `BulletManager.activeBullets` (array hoặc pool).
   - Bullet khi “chết” thì **trả về pool** và bị xoá khỏi mảng đang duyệt, tránh để scheduler global phải cầm reference.

2. **Object Pooling + flag sống nội bộ**
   - Thay vì destroy node, giữ node trong pool, vô hiệu hoá render (`opacity=0` hoặc ẩn component graphic). Như vậy GC không phải tạo/huỷ nhiều object.

3. **Tạm dừng cập nhật khi rỗng**
   - Khi `activeBullets.length === 0`, `BulletManager` có thể tự `enabled = false` hoặc `unscheduleUpdate()`. Như vậy scheduler global không cần gọi ngay cả `BulletManager` nữa.

4. **Batch xử lý sự kiện**
   - Dùng event/queue để push bullet mới hoặc bullet hết hạn. Mỗi frame `BulletManager` chỉ đọc queue, tránh truy cập binding linh tinh.

## 5. Checklist thực hành

- [ ] Đảm bảo chỉ có **một** component có `update()` chịu trách nhiệm cho cả hệ thống bullet.
- [ ] Pool node + component, tránh `destroy()` hàng loạt mỗi frame.
- [ ] Sau khi `enabled = false`, kiểm tra xem có thể gọi `unscheduleUpdate()` để scheduler xoá khỏi danh sách.
- [ ] Dùng profiler của engine (JS Profiler, Chrome DevTools) để theo dõi `componentScheduler.update` CPU time.
- [ ] Đo lượng GC (Timeline → Memory) sau khi áp dụng pooling để đảm bảo rác giảm.

## 6. TL;DR

- Engine luôn giữ danh sách global cho component có vòng lặp (`update`, `lateUpdate`, `postUpdate`). Tắt `enabled` chỉ khiến callback không bị gọi, **không** loại bỏ chi phí duyệt.
- Với 1.000 bullet, bạn vẫn trả giá O(N) mỗi frame + overhead GC vì scheduler giữ reference.
- Giải pháp bền vững: gom logic vào `BulletManager`, pooling, event-driven để giảm số component phải đăng ký update về mức tối thiểu.
