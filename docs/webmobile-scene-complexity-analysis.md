# Đánh giá cảnh 35.541 node trên target WebMobile (iPhone 7, WebGL1)

## 1. Bối cảnh phần cứng & runtime
- **Thiết bị mục tiêu**: iPhone 7 (2016) với CPU A10 Fusion 4 lõi (2 lõi hiệu năng + 2 lõi tiết kiệm), GPU PowerVR Series7XT GT7600, RAM 2 GB.
- **Môi trường chạy**: Safari/Chrome WebView, WebGL1 backend (OpenGL ES 2.0). Javascript chạy đơn luồng, thread game loop chia sẻ với UI & event.
- **Giới hạn WebGL1**:
  - Không có compute shader, instancing chỉ giả lập qua extension ANGLE_instanced_arrays (không ổn định trên iOS cũ).
  - Số lượng uniform, texture unit, varying ít ⇒ shader phải gọn.
  - Băng thông buffer thấp, phụ thuộc bridge JS ↔︎ Native.

## 2. Tác động của 35.541 object trong Hierarchy
### 2.1 Chi phí CPU game loop
- Mỗi khung hình, engine phải cập nhật transform, chạy scheduler, component update & event trên **toàn bộ node hoạt động**.
- Nếu node dùng component mặc định (Transform + Render) thì vẫn có traversal chi phí `O(n)`. 35.5k node ⇒ traversal ~35k bước/khung hình.
- iPhone 7 ở 60 FPS chỉ có ~16 ms cho toàn bộ khung hình; 35k node dễ khiến phần update chiếm 5–10 ms tùy số component/script.
- Nếu node có script tùy chỉnh (update, lateUpdate) hoặc animation, chi phí tăng tuyến tính. Bộ nhớ JS tăng ⇒ GC thường xuyên hơn, tạo hitch 30–100 ms.

### 2.2 Draw call & state change
- Mỗi renderer (MeshRenderer, Sprite, Spine, UI) có thể sinh draw call riêng. Nếu batching không diễn ra (khác material, depth test, blend, lightmap), draw call ≈ số object nhìn thấy.
- WebGL1 trên iPhone 7 chịu tải ổn khoảng **100–200 draw call**/khung hình ở 30 FPS. Với vài nghìn object hiển thị, draw call có thể lên hàng nghìn ⇒ GPU bottleneck.
- Thêm shadow, post-process, particle ⇒ nhân đôi/triple draw call.

### 2.3 Bộ nhớ & tải tài sản
- 35k object thường kéo theo nhiều mesh/material/texture. iPhone 7 có 2 GB RAM, trình duyệt giới hạn ~700–900 MB cho tab. Asset lớn + script + texture dễ chạm giới hạn, gây crash reload.
- Cấu trúc Scene graph lớn làm tăng kích thước JSON/binary scene ⇒ thời gian parse & khởi tạo lâu (vài giây). DOM Safari dễ bị "A problem occurred with this webpage" khi main thread block lâu.

### 2.4 Hệ thống phụ trợ
- **Physics**: collider rigidbody hàng nghìn ⇒ bước mô phỏng 16 ms không đủ, engine tự giảm FPS.
- **UI Event**: nếu nhiều node UI tương tác, hit test recursion sâu ⇒ phản hồi chậm.
- **Animation**: spine/skeletal/particle 2D với số lượng lớn gây CPU/GPU spike.

## 3. Mốc tham chiếu & khuyến nghị
| Loại cảnh | Số node nên nhắm (WebGL1 di động) | Ghi chú |
|-----------|-----------------------------------|---------|
| UI 2D tĩnh | 500–1.000 | Batch atlas, hạn chế mask.| 
| UI động/scroll | 1.000–2.000 | Dùng pooling, ảo hóa cell.| 
| 3D low-poly | 2.000–5.000 node render | Merge mesh, static batching.| 
| 3D trung bình | 5.000–8.000 node tổng | Duy trì draw call < 200.| 

35.541 node vượt xa ngưỡng khuyến nghị (gấp 4–7 lần). Trên iPhone 7 WebGL1 gần như chắc chắn tụt dưới 20 FPS hoặc crash khi load.

## 4. Biện pháp tối ưu
1. **Phân tích scene**: dùng Profiler/Hierarchy view tìm nhóm node có thể gộp.
2. **Static/Dynamic Batching**:
   - Group mesh chung material vào 1 Mesh bằng `Mesh.merge`/ModelBatcher.
   - Với UI, tạo atlas texture, dùng Auto Atlas.
3. **LOD & Culling**:
   - Bật `cc.ModelComponent.enableFrustumCulling` (nếu tắt).
   - Dùng LODGroup hoặc script tắt renderer/animator khi xa camera.
   - Chia scene thành chunk, bật/tắt theo vùng.
4. **Object Pooling**: tránh tạo 35k node đồng thời; khởi tạo theo nhu cầu, tái sử dụng.
5. **Bỏ node trống**: loại bỏ node chỉ dùng để group nếu không cần transform riêng (gộp vào parent). Dùng `cc.NodePool` hoặc data-driven (script lưu trạng thái thay vì node thật).
6. **Phân tách scene**: chia thành nhiều scene nhỏ/asset bundle, load theo tuyến.
7. **Giảm script update**: chuyển các hệ thống lặp lại (spawn bullet, AI tick, UI refresh) sang mô hình event-driven. Ví dụ điển hình: thay vì 1.000 viên đạn đều có `update()` riêng, tạo `BulletManager` sở hữu **một** hàm `update()` duy nhất, mỗi khung hình `for` qua danh sách bullet hoạt động và gọi `bullet.updateSelf(dt)` cho đối tượng cần xử lý. Khi không còn bullet, `BulletManager` có thể tạm dừng chính `update()` của mình để scheduler không gọi vô ích. Kết hợp listener sự kiện (va chạm, hết thời gian sống, nhận buff, spawn mới) để thêm/xóa bullet khỏi danh sách đúng thời điểm, hạn chế vòng lặp chạy trên object chết và giảm số callback mà scheduler phải dispatch.
8. **Texture & shader nhẹ**: format nén (PVRTC/ETC1), giảm số pass, hạn chế effect post-process.
9. **Kiểm soát physics/UI**: tắt component khi không cần, giảm số collider, giới hạn concurrent Spine/Particle.

## 5. Quy trình kiểm tra
- **Profiler Web**: dùng DevTools + Cocos Profiler xem thời gian update/draw.
- **Capture draw call**: bật Stat Panel (fps, drawcall, tri). Mục tiêu < 200 drawcall, < 100k triangle/frame trên iPhone7.
- **Stress test**: thiết lập build WebMobile, chạy trên thiết bị thật (Safari). Kiểm tra memory usage qua `Performance → Memory`.
- **GC log**: bật verbose log (Chrome devtools) để phát hiện GC spike.

## 6. Kết luận
Với 35.541 object, scene quá nặng cho target iPhone 7 WebGL1. Cần giảm số node hoạt động, đặc biệt node render & script, xuống dưới ~5–8 nghìn, đồng thời tối ưu draw call, batching và quản lý tài nguyên để đạt FPS ổn định và tránh crash.
