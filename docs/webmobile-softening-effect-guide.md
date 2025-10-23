# Hướng dẫn dựng effect "soft" giảm răng cưa trên WebMobile (WebGL1, iPhone 7)

## 1. Bối cảnh và hạn chế phần cứng
- **Render backend**: Safari iOS 15 trở xuống trên iPhone 7 chỉ hỗ trợ WebGL1 + ANGLE ES 2.0, giới hạn pipeline shader dạng forward, không có MRT, MSAA chỉ hoạt động trong framebuffer mặc định (không dùng được khi cần post-process).
- **GPU/CPU**: Apple A10 Fusion có 6 cluster GPU với băng thông chia sẻ, dễ bị nghẽn khi phải đổ nhiều draw call hoặc chạy shader phức tạp. Vì vậy một giải pháp giảm răng cưa phải nhẹ, tránh texture fetch dư thừa và tránh branch khó dự đoán.
- **Chất lượng texture**: Model game casual thường dùng texture UV sắc nét (flat shading), khiến aliasing rõ ràng nếu chỉ rely vào MSAA.

## 2. Vì sao MSAA/FXAA mặc định không hiệu quả trong ngữ cảnh này
1. **MSAA WebGL**: Khi render vào render texture nội bộ (ví dụ xử lý outline, bloom), WebGL1 không cho phép bật MSAA. Nhiều pipeline của Cocos trên web dùng render texture, nên MSAA mặc định gần như bị vô hiệu.
2. **FXAA sẵn có**: Engine không cung cấp pass FXAA mặc định trên WebGL1; tự bật FXAA trong post-process pipeline của editor chỉ có trên nền tảng native/Metal.
3. **Làm mờ texture**: Làm mờ texture trong DCC làm mất chi tiết khi zoom và không xử lý aliasing do geometry.

## 3. Chiến lược effect "soft" phù hợp
Có hai hướng phù hợp với WebGL1:
- **Post-process FXAA đơn giản**: Render cả màn hình vào một render texture không MSAA, sau đó áp dụng shader FXAA được tinh giản.
- **Material pass mềm hóa biên (Edge Softening)**: Chèn logic làm mềm biên ngay trong fragment shader của vật thể, dựa vào normal/vertex color để ước lượng edge.

### 3.1. FXAA tinh giản cho WebGL1
FXAA (Fast Approximate Anti-Aliasing) sử dụng gradient luminosity để làm mờ có chọn lọc.

**Đặc điểm điều chỉnh cho iPhone 7:**
- Giảm số mẫu lấy xuống 4 (center + 2 cặp đối xứng).
- Tránh dùng `textureLod`, chỉ dùng `texture2D` với offset.
- Gom ma trận transform UV vào biến uniform sẵn để giảm ALU.

**Cấu trúc effect Cocos (pseudo):**
```yaml
CCEffect %{
  techniques:
  - passes:
    - vert: fullscreen-vs
      frag: fxaa-lite-fs
      rasterizerState:
        cullMode: none
      properties:
        texture: { value: null }
        resolution: { value: [1.0, 1.0] }
}%
``` 
```glsl
precision mediump float;
uniform sampler2D texture;
uniform vec2 resolution;
varying vec2 uv0;

void main() {
  vec2 texel = 1.0 / resolution;
  vec3 lumaCoeff = vec3(0.299, 0.587, 0.114);
  vec3 rgbM = texture2D(texture, uv0).rgb;
  float lumaM = dot(rgbM, lumaCoeff);
  vec3 rgbN = texture2D(texture, uv0 + vec2(0.0, texel.y)).rgb;
  vec3 rgbS = texture2D(texture, uv0 - vec2(0.0, texel.y)).rgb;
  vec3 rgbE = texture2D(texture, uv0 + vec2(texel.x, 0.0)).rgb;
  vec3 rgbW = texture2D(texture, uv0 - vec2(texel.x, 0.0)).rgb;
  float lumaN = dot(rgbN, lumaCoeff);
  float lumaS = dot(rgbS, lumaCoeff);
  float lumaE = dot(rgbE, lumaCoeff);
  float lumaW = dot(rgbW, lumaCoeff);
  float range = max(max(lumaN, lumaS), max(lumaE, lumaW)) - min(min(lumaN, lumaS), min(lumaE, lumaW));
  float contrast = max(range, 0.03125); // threshold tinh chỉnh theo art
  float blend = clamp((range - contrast) * 16.0, 0.0, 1.0);
  vec3 rgbBlur = (rgbN + rgbS + rgbE + rgbW + rgbM) * 0.2;
  gl_FragColor = vec4(mix(rgbM, rgbBlur, blend), 1.0);
}
```
> Lưu ý: Trong code thực tế cần khai báo biến trung gian `rgbN`, `rgbS`, `rgbE`, `rgbW`. Trong effect YAML thêm `defines` nếu muốn bật/tắt.

**Quy trình tích hợp:**
1. Dùng `Camera` riêng render toàn bộ cảnh vào render texture (size = render target). Trên WebGL1, tạo RT với format `RGBA8`.
2. Tạo `ScreenSpaceFXAALite` effect như trên, gắn vào `Sprite` full-screen hoặc `PostProcess` custom.
3. Bật/tắt pass này chỉ với các cảnh cần chất lượng cao, để tiết kiệm GPU.
4. Kiểm tra `draw call` (sẽ tăng thêm 1) và thời gian fragment shader (dưới 1 ms trên iPhone 7 nếu render 720p).

### 3.2. Edge Softening trong material
Khi không thể áp dụng post-process (ví dụ UI overlay), có thể chỉnh material mỗi mesh:
- Lấy dot giữa normal và viewDir để ước lượng góc biên (`fresnelTerm`).
- Áp dụng `smoothstep` để tăng nhẹ alpha hoặc blend với màu đường viền mềm.

**Ví dụ fragment snippet:**
```glsl
float fresnel = pow(1.0 - max(dot(normalize(normal), normalize(viewDir)), 0.0), 3.0);
float softness = smoothstep(0.1, 0.4, fresnel);
vec3 finalColor = mix(baseColor, baseColor * 0.85 + vec3(0.02), softness);
```
- Đặt `softness` thành uniform để artist tinh chỉnh.
- Thủ thuật này không loại bỏ răng cưa hoàn toàn nhưng làm viền ít tương phản nên bớt thấy.
- Chi phí: thêm vài phép nhân/cộng, phù hợp WebGL1.

## 4. Thực hành tối ưu khi triển khai
1. **Giữ render target nhỏ**: Render ở 0.85x độ phân giải màn hình rồi upscale, giúp FXAA nhanh hơn.
2. **Batch capture**: Với iPhone 7, giữ `draw call` < 120, tránh post-process khi có nhiều particle.
3. **Texture filtering**: Dùng mipmap + trilinear cho texture diffuse để tránh aliasing từ MIP.
4. **Kiểm thử thực tế**: Dùng Safari remote inspector → tab `Timelines` để đọc `GPU` và `CPU` frame time. Đặt mục tiêu < 16.6 ms.
5. **Fallback**: Cung cấp tùy chọn tắt FXAA khi máy nóng (theo FPS). Có thể theo dõi `director.getDeltaTime()` để bật/tắt hiệu ứng.

## 5. Checklist triển khai
- [ ] Đảm bảo pipeline render đã chuyển sang render texture trước khi gắn FXAA.
- [ ] Xác nhận shader tuân thủ chuẩn GLSL ES 1.0 (không `for` động, không `textureLod`).
- [ ] Kiểm tra effect hoạt động đúng khi bật `Premultiply Alpha` trong sprite.
- [ ] Benchmark FPS trước/sau, lưu lại kết quả cho artist.

## 6. Kỳ vọng chất lượng hình ảnh
- Viền geometry sắc nét sẽ dịu hơn nhưng vẫn không bằng MSAA 4x native.
- Ánh sáng specular cần clamp để tránh highlight quá gắt gây aliasing mới.
- Hiệu ứng đặc biệt (particle, outline) nên render sau FXAA hoặc có pass riêng.

## 7. Lộ trình nâng cấp
- Khi target lên WebGL2 (iPhone 8 trở lên), chuyển sang MSAA trong framebuffer và post-process bằng `textureLod` chính xác.
- Cân nhắc dùng Temporal AA khi engine hỗ trợ camera jitter.

