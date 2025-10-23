# Phân tích chi phí CPU khi bật/tắt `active` trên node nặng

## 1. Tóm tắt hiện tượng
Khi một node chứa **MeshRenderer**, **SkinnedMeshRenderer**, **ParticleSystem** hoặc **SkeletalAnimation** được chuyển trạng thái `active` từ `false → true` (hoặc ngược lại), biểu đồ CPU thường xuất hiện các đỉnh (peak) ngắn hạn. Đây không phải bug riêng lẻ mà là hệ quả tất yếu của chuỗi công việc mà engine phải thực hiện để đồng bộ scene graph với các hệ thống render và animation nền.

## 2. Luồng xử lý nội bộ của engine
1. **Đánh dấu dirty và kích hoạt lại cây con**: `node.active = true` khiến engine đánh dấu toàn bộ node con là dirty, tái xây dựng flag `activeInHierarchy`, cập nhật các mask layer, visibility, transform world matrix.
2. **Đăng ký/huỷ đăng ký với hệ thống render**:
   - `MeshRenderer`/`SkinnedMeshRenderer`: tạo lại record trong `RenderScene`, cập nhật `Model`, danh sách `SubModel`, shader macro, uniform buffer, lightmap, culling mask.
   - `ParticleSystem`: reset lại emitter, tạo/gỡ `ParticleSystemRenderer`, đồng bộ thông số với `Material`.
3. **Đồng bộ buffer & pipeline native**: dữ liệu `UBO`, `SSBO`, skeleton buffer, instancing buffer cần upload lại về phía native renderer (C++), gây ra nhiều lần copy bộ nhớ.
4. **Kích hoạt scheduler nội bộ**: `SkeletalAnimation` và `ParticleSystem` đều đăng ký vào scheduler update để thực thi mỗi frame. Việc bật node khiến các component này thêm callback `update()` vào danh sách toàn cục, kéo theo alloc tạm thời.
5. **Rebuild pipeline state**: engine phải rà soát lại `Pass`/`Technique`, gắn lại descriptor set, binding texture & sampler. Với WebGL1, không có persistent pipeline state, nên thay đổi nhỏ đều dẫn tới bind lại toàn bộ.
6. **Thông báo sự kiện và binding JS-native**: layer JS phải gửi message sang native (hoặc ngược lại) để đồng bộ `Model`, dẫn tới nhiều cuộc gọi C++/JS bridge và trigger GC sau đó.

## 3. Vì sao xuất hiện peak CPU
- **Batch công việc tập trung một frame**: Các bước trên phần lớn diễn ra trong frame bật/tắt. Khi bật nhiều node cùng lúc, toàn bộ công việc dồn vào một frame → spike.
- **Tái tạo dữ liệu skinned mesh**: `SkinnedMeshRenderer` cần tính lại bindpose, skeleton map, `jointMatrix`. Công việc ma trận và upload buffer tốn CPU.
- **Particle reset**: Khi bật lại, emitter phát sinh lại batch hạt đầu tiên, cần khởi tạo data array, random seed, update bounding box → nhiều vòng lặp.
- **Đồng bộ transform cascade**: Bất kỳ thay đổi `active` nào cũng khiến hệ thống transform đi xuyên cây con để cập nhật `worldMatrix`, `forward`, `up`, `right`, tương tự `lateUpdateTransform`.
- **GC pressure**: Việc dựng lại pipeline thường tạo object tạm (`PassOverrides`, `RenderInst`) phía JS, sau frame sẽ bị GC quét, làm peak CPU tăng.

## 4. Thực hành tối ưu
1. **Ẩn/hiện thay vì bật/tắt**: Nếu chỉ muốn che node trong vài frame, hãy đổi `ModelComponent.enabled` hoặc `node.layer`/`node.opacity`. Việc giữ `active=true` giúp engine không tháo gỡ pipeline.
2. **Pool node nặng**: Thay vì destroy + recreate, giữ node luôn active, chỉ bật/tắt renderer (`renderer.enabled`). Khi cần gỡ hẳn khỏi scene, hãy đợi tới thời điểm ít tải (ví dụ loading screen).
3. **Batch thao tác**: Gom các thao tác `active` vào cuối frame hoặc sử dụng hàng đợi để mỗi frame chỉ kích hoạt vài node, tránh burst lớn.
4. **Warm-up trước khi dùng**: Bật node ở giai đoạn loading để engine thực hiện init trước, sau đó chuyển về hidden. Khi tới gameplay chỉ cần bật renderer, không phải rebuild.
5. **Skinned mesh**: Sử dụng shared skeleton/animation clip, tránh tạo skeleton mới khi bật. Đảm bảo `JointTextureLayout` đã sẵn sàng.
6. **Particle**: Đặt `simulateOnInit=false`, prewarm trong lúc load để engine chuẩn bị buffer sẵn.
7. **Profiling**: Sử dụng profiler để theo dõi marker `RenderScene::addModel`, `Skeleton::uploadJointData`, `ParticleSystem::rebuild`. Kiểm tra GC timeline trong DevTools.

## 5. Checklist chẩn đoán
- [ ] Bật profiler và xác định frame peak tương ứng với hàm `updateActiveInHierarchy` hoặc `RenderScene::addModel`.
- [ ] Kiểm tra có bao nhiêu node con bị ảnh hưởng (đặc biệt skeleton có >50 joint).
- [ ] Đảm bảo `Material` dùng lại thay vì tạo mới khi bật.
- [ ] Theo dõi lượng dữ liệu upload qua WebGL (`gl.bufferSubData`).
- [ ] So sánh tác động giữa `node.active` và `component.enabled` để quyết định chiến lược.

## 6. Kết luận
Việc bật/tắt `active` trên node chứa component nặng khiến engine phải tái đồng bộ nhiều lớp (scene graph, render pipeline, scheduler). Tối ưu bằng cách hạn chế thao tác `active`, ưu tiên bật/tắt renderer hoặc pooling, và phân tán khối lượng công việc theo thời gian để tránh đỉnh CPU đột biến.
