# Đánh giá chi phí kích hoạt lại Component qua callback `onEnable`

Bảng dưới đây tổng hợp những component trong Cocos Creator Engine có khối lượng công việc lớn nhất khi một `Node` đổi trạng thái `active` và kích hoạt lại vòng đời `onEnable`. Thứ tự được sắp xếp từ tốn tài nguyên nhiều nhất đến ít nhất, dựa trên khối lượng xử lý được thực hiện trong lần kích hoạt lại.

1. **`Terrain` (`cocos/terrain/terrain.ts`)**  
   * Ngay khi bật lại, component kiểm tra danh sách khối địa hình; nếu trống sẽ gọi `_buildImp()` để dựng lại toàn bộ dữ liệu địa hình, bao gồm tải lại thông tin layer, khởi tạo mảng chiều cao, pháp tuyến, buffer trọng số và sinh mới từng `TerrainBlock`.  
   * `_buildImp()` vừa phân bổ lại bộ nhớ lớn (mảng `Uint16Array`, `Float32Array`, `Uint8Array`) vừa tạo hàng loạt đối tượng mới và gọi `build()` trên từng block, nên đây là bước nặng nhất.

2. **`ParticleSystem` 3D (`cocos/particle/particle-system.ts`)**  
   * `onEnable()` đăng ký callback khung hình, tự động `play()` nếu cấu hình `playOnAwake`, đồng thời kích hoạt `processor`.  
   * `ParticleSystemRendererBase.onEnable()` sẽ gắn model vào `RenderScene`, cập nhật tham chiếu node và có thể tái cấp phát bộ đệm GPU khi cần, khiến việc bật lại tương đối tốn kém.

3. **`MeshRenderer` và các dẫn xuất (`cocos/3d/framework/mesh-renderer.ts`)**  
   * Khi được bật, component đăng ký nhiều sự kiện (thay đổi mobility, light probe, reflection probe) và nếu chưa có model sẽ gọi `_updateModels()`.  
   * `_updateModels()` có thể hủy khởi tạo lại model, tạo bounding, thiết lập light map, probe, shadow, rồi gắn model vào `RenderScene`, dẫn tới nhiều thao tác GPU/CPU.

4. **Các component Vật lý 3D (`RigidBody`, `Collider` – PhysX backend)**  
   * `RigidBody.onEnable()` gọi wrapper PhysX để tái áp dụng toàn bộ thuộc tính (khối lượng, loại thân, giảm chấn, hệ số khóa) và bật `sharedBody`.  
   * Khi `sharedBody.enabled` chuyển sang `true`, actor PhysX sẽ được thêm trở lại vào thế giới vật lý; mỗi `Shape.onEnable()` cũng tự động gắn collider vào actor và cập nhật khối lượng/quán tính.  
   * Chuỗi thao tác này đòi hỏi đồng bộ hóa với máy vật lý nền tảng nên chi phí cao hơn các component logic thuần túy.

5. **`ReflectionProbe` (`cocos/3d/reflection-probe/reflection-probe-component.ts`)**  
   * `onEnable()` bảo đảm ID không xung đột, đăng ký probe với `ReflectionProbeManager`, yêu cầu cập nhật lại toàn bộ dữ liệu probe và bật probe.  
   * Việc cập nhật thường kéo theo lọc lại đối tượng phản xạ hoặc dựng lại dữ liệu phản chiếu.

6. **`RichText` (`cocos/2d/components/rich-text.ts`)**  
   * Khi bật lại, component tái đăng ký sự kiện touch (nếu cần) rồi gọi `_updateRichText()`.  
   * `_updateRichText()` phân tích cú pháp HTML, tái tạo layout, tạo/thu hồi node con cho từng đoạn text hoặc ảnh, cập nhật kích thước node – tương đối tốn CPU so với label thông thường.

7. **`UIRenderer` cơ sở (`cocos/2d/framework/ui-renderer.ts`)**  
   * `onEnable()` đăng ký lại nhiều sự kiện (anchor, size, parent), cập nhật material, đánh dấu dữ liệu render bẩn và thêm component vào `uiRendererManager`.  
   * Chi phí chủ yếu nằm ở việc đánh dấu cập nhật lại mesh/UI buffer nhưng vẫn nhẹ hơn đáng kể so với các component phía trên.

> **Lưu ý**: Những nhóm component khác (ví dụ `AudioSource`, `Label`, `Sprite` …) chỉ thực hiện vài thao tác nhẹ khi `onEnable()` (phát lại âm thanh, cập nhật UV, đổi vật liệu), nên không nằm trong danh sách tiêu tốn đáng kể.
