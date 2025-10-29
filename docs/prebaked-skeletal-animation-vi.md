# Tóm tắt hệ thống Pre-baked Skeletal Animation

Hệ thống Pre-baked Skeletal Animation được thiết kế ưu tiên hiệu năng, nên chấp nhận hy sinh một phần tính linh hoạt.

## Quy trình hoạt động
1. **Tiền xử lý dữ liệu hoạt ảnh**: Mọi clip hoạt ảnh xương được lấy mẫu theo tốc độ khung hình định trước và "nướng" sẵn vào một bộ texture dùng chung. Việc này giúp giảm chi phí tính toán ở thời gian chạy.
2. **Định dạng texture theo khả năng thiết bị**: Ở thời gian chạy, engine sẽ tự chọn giữa hai định dạng texture (RGBA32F hoặc RGBA8) tùy việc thiết bị có hỗ trợ texture số thực hay không. Người dùng không cần can thiệp bước này.
3. **Theo dõi tiến độ phát hoạt ảnh**: Mỗi component `SkeletalAnimation` chỉ giữ thông tin tiến độ phát hiện tại dưới dạng một UBO (`Vec4`).
4. **Skinning trên GPU**: Mỗi `SkinnedMeshRenderer` nắm giữ một `BakedSkinningModel` đã được chuẩn bị sẵn. Component này:
   - Dùng thông tin hộp bao (bounding box) đã được nướng sẵn để tính toán culling.
   - Cập nhật UBO tương ứng.
   - Lấy dữ liệu skinning của khung hình hiện tại trực tiếp từ bộ texture trên GPU để hoàn tất biến dạng lưới.

### Pre-baked diễn ra khi nào và lưu ở đâu?
- **Thời điểm bake**: Việc lấy mẫu và nướng hoạt ảnh xảy ra trong giai đoạn chuẩn bị tài nguyên (khi bạn bật *Baked Animation* cho clip hoặc chạy công cụ Bake trong Editor). Toàn bộ bước này diễn ra trước khi build/chạy game.
- **Đầu ra**: Kết quả bake là một (hoặc nhiều) **texture hoạt ảnh** chứa chuỗi ma trận xương đã lấy mẫu. Texture này nằm trong "bộ texture hoạt ảnh" toàn cục do engine quản lý và được lưu kèm metadata trong project (có thể tái sử dụng cho nhiều mô hình có chung bộ xương).
- **Sử dụng ở runtime**: Khi game chạy, `BakedSkinningModel` chỉ việc truy vấn đúng vùng dữ liệu trong texture để đọc pose tương ứng với thời điểm playback hiện tại.

## Ý nghĩa
- **Giảm tải CPU**: Các bước tính toán ma trận xương được đẩy sang giai đoạn tiền xử lý và GPU.
- **Tối ưu bộ nhớ**: Dùng chung bộ texture giữa nhiều đối tượng, tránh lặp dữ liệu.
- **Khả năng mở rộng**: Cơ chế fallback sang RGBA8 bảo đảm hoạt động ổn định trên thiết bị thấp mà không ảnh hưởng logic tổng thể.

## So sánh với hệ thống tính xương thời gian thực
| Khía cạnh | Pre-baked Skeletal Animation | Real-time Computed Skeletal Animation |
| --- | --- | --- |
| **Bản chất dữ liệu** | Pose hoạt ảnh được lấy mẫu sẵn theo FPS cố định, lưu trong texture dùng chung. | Ma trận xương được nội suy và tính toán lại mỗi khung hình dựa trên clip gốc. |
| **Chi phí CPU** | Rất thấp: CPU chỉ cập nhật tiến độ playback và gửi chỉ số frame cho GPU. | Cao hơn: CPU (hoặc compute shader) phải đánh giá toàn bộ cây xương mỗi khung hình. |
| **Chi phí GPU** | Chủ yếu là truy vấn texture và áp dụng skinning trong shader; bandwidth tăng nhưng ALU thấp. | Shader nhận ma trận xương mới mỗi frame; chi phí upload UBO/SSBO cao hơn. |
| **Độ linh hoạt** | Giới hạn bởi dữ liệu đã nướng: khó hỗ trợ blend, IK, additive hoặc thay đổi tốc độ bất thường mà không tái nướng. | Rất linh hoạt: hỗ trợ blending phức tạp, IK, ragdoll, điều chỉnh tốc độ theo thời gian thực. |
| **Dung lượng lưu trữ** | Cần thêm dung lượng cho texture hoạt ảnh pre-baked; thuận lợi nếu nhiều đối tượng tái sử dụng cùng bộ texture. | Dữ liệu tương tự clip gốc; không phải lưu thêm texture nhưng mỗi phiên bản có chi phí tính toán riêng. |
| **Khả năng instancing** | Dễ gom nhiều phiên bản chung bộ xương vào cùng drawcall bằng Dynamic Instancing. | Khó instancing: mỗi phiên bản thường có ma trận khác nhau, khó chia sẻ trong một drawcall. |
| **Khả năng mở rộng cho thiết bị yếu** | Có fallback sang RGBA8 để dùng chung pipeline, không đòi hỏi phần cứng mạnh. | Phụ thuộc khả năng CPU/compute; thiết bị yếu dễ hụt FPS khi có nhiều nhân vật. |

## Về Dynamic Instancing
Dynamic Instancing được xây dựng dựa trên cùng nền tảng pre-baking, cho phép nhiều phiên bản của cùng một mô hình skinned được vẽ trong một drawcall mà vẫn thừa hưởng lợi thế hiệu năng có sẵn.

### Yêu cầu về dữ liệu
- Tất cả phiên bản trong cùng một drawcall **phải chia sẻ cùng một bộ xương và texture hoạt ảnh**; chỉ cần khác nhau bộ xương là lưới sẽ bị méo lệch hoàn toàn.
- Cách ánh xạ dữ liệu hoạt ảnh vào từng texture bộ xương được cấu hình bởi người dùng thông qua **Bố cục kết cấu chung** trong trình chỉnh sửa (Menu `Bảng điều khiển -> Hoạt hình`).

### Ghi chú quan trọng
- Instancing chỉ được hỗ trợ với hệ thống pre-baked. Engine không ngăn cản bạn bật instancing cho các mô hình dùng hệ thống tính toán thời gian thực, nhưng hiệu ứng hoạt ảnh sẽ sai lệch tùy cách gán vật liệu. Kịch bản “đẹp” nhất là mọi phiên bản chia sẻ hoạt ảnh giống hệt nhau; xấu nhất là hình bị méo hoàn toàn.
- Khi vật liệu của mô hình bật instancing, pass đổ bóng cũng tự động dùng instancing. Riêng với mô hình skinned có đổ bóng, mọi phiên bản cần dùng chung texture hoạt ảnh để bảo đảm trạng thái pipeline đồng nhất (khắt khe hơn so với pass hiển thị chính, vốn chỉ yêu cầu đồng nhất trong từng drawcall).
- Nếu sử dụng `BakedSkinningModel` nhưng **không bật instancing trong material**, mô hình vẫn chạy hoạt ảnh bằng **hệ thống pre-baked**. Engine không quay về cơ chế tính xương thời gian thực, chỉ là mỗi phiên bản cần một drawcall riêng nên bạn không nhận được lợi ích giảm drawcall của instancing.
- Ngược lại, khi vừa dùng `BakedSkinningModel` vừa **bật instancing trong material**, bạn đang ngầm xác nhận với engine rằng clip hoạt ảnh đã được nướng vào texture chia sẻ. Vì vậy, pipeline sẽ luôn lấy dữ liệu pose từ texture pre-baked để vừa bảo toàn hiệu ứng hoạt ảnh, vừa gom các phiên bản chung bộ xương vào cùng drawcall.
