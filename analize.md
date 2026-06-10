# 1. Âm thanh voice được tạo bởi những thứ gì?

Một file voice nhìn đơn giản là waveform, nhưng bên trong nó có nhiều lớp:

```txt
Voice quality =
  Frequency balance
+ Loudness
+ Dynamic range
+ Noise level
+ Clarity / intelligibility
+ Room reverb
+ Distortion
+ Sibilance
+ Plosive
+ Breath
+ Artifacts
```

Nói dễ hiểu:

```txt
Giọng hay =
  đủ ấm
+ đủ rõ
+ không chói
+ không ù
+ không rè
+ không vỡ
+ không quá vang
+ không bị robot
+ âm lượng đều
```

App của bồ phải biết **đo**, **phân tích**, rồi **chỉnh** từng phần này.

---

# 2. Tần số là gì và vì sao nó quyết định chất giọng?

Âm thanh là dao động. **Tần số**, tính bằng Hz, quyết định âm nghe trầm hay cao.

```txt
20Hz - 20,000Hz = vùng tai người nghe được
```

Nhưng với **giọng nói**, phần quan trọng không nằm toàn bộ từ 20Hz đến 20kHz. Voice chủ yếu nằm khoảng:

```txt
80Hz - 12,000Hz
```

Trong đó mỗi vùng tần số tạo cảm giác khác nhau.

---

# 3. Bản đồ tần số của giọng nói

Đây là thứ bồ cần nắm kỹ nhất.

```txt
20Hz - 80Hz       : Rumble / tiếng ù / rung nền
80Hz - 150Hz      : Độ trầm cơ bản của giọng nam
150Hz - 300Hz     : Độ ấm / thân giọng
300Hz - 600Hz     : Độ dày, nhưng dễ bị đục
600Hz - 1kHz      : Thân âm, nasal, boxy
1kHz - 3kHz       : Độ rõ chữ, intelligibility
3kHz - 5kHz       : Presence, giọng tiến lên trước
5kHz - 8kHz       : Sibilance, âm “s”, “x”, “sh”
8kHz - 12kHz      : Air, độ sáng, chi tiết
12kHz+            : Không khí, sparkle, thường ít quan trọng với speech
```

Giờ đi từng vùng.

---

## 20Hz–80Hz: tiếng ù, rung, rumble

Vùng này thường không giúp gì cho voice.

Nguồn gây ra:

```txt
Tiếng máy lạnh
Tiếng quạt
Bàn rung
Tay chạm mic
Xe chạy xa
Điện nền
Gió thổi vào mic
```

Nếu bản thu có nhiều vùng này, giọng sẽ nghe:

```txt
Ù
Nặng nền
Không sạch
Có tiếng “bùm bùm”
```

Cách xử lý:

```txt
High-pass filter ở 70Hz - 100Hz
```

Với giọng nam trầm, cắt nhẹ khoảng 60–80Hz.
Với giọng nữ hoặc voice content thông thường, có thể cắt 80–100Hz.

Rule đơn giản:

```txt
Nếu voice nghe ù nền → cắt low dưới 80Hz.
```

---

## 80Hz–150Hz: nền trầm của giọng

Đây là vùng tạo cảm giác “giọng có lực”, nhất là giọng nam.

Thiếu vùng này:

```txt
Giọng mỏng
Giọng yếu
Giọng như điện thoại
```

Dư vùng này:

```txt
Giọng bị ù
Nặng
Không rõ
```

Không nên boost bừa. Nếu mic dở đã ù sẵn, boost vùng này làm tệ hơn.

Rule:

```txt
Nếu giọng quá mỏng → boost nhẹ 100–150Hz.
Nếu giọng ù/nặng → giảm nhẹ 100–150Hz.
```

---

## 150Hz–300Hz: độ ấm

Đây là vùng “ấm”, “thân thiện”, “podcast”.

Boost vừa phải:

```txt
Giọng ấm hơn
Dày hơn
Dễ nghe hơn
```

Nhưng quá nhiều sẽ:

```txt
Đục
Bí
Nghe như nói trong chăn
```

Rule:

```txt
Podcast Warm preset có thể boost nhẹ 180–250Hz.
Clean Voice preset thường giữ tự nhiên hoặc giảm nhẹ nếu bị đục.
```

---

## 300Hz–600Hz: vùng đục / muddy

Đây là vùng nguy hiểm.

Dư vùng này làm giọng nghe:

```txt
Đục
Bí
Muffled
Không thoát
Như thu trong phòng kín
```

Mic rẻ, phòng nhỏ, thu gần tường thường hay bị dư vùng này.

Cách xử lý:

```txt
Cut nhẹ 300–500Hz
```

Rule:

```txt
Nếu giọng nghe “bị phủ khăn” → giảm 300–600Hz.
```

---

## 600Hz–1kHz: boxy / nasal

Vùng này ảnh hưởng đến cảm giác “hộp”, “mũi”.

Dư quá sẽ nghe:

```txt
Boxy
Nasal
Giọng nghẹt
Giống nói qua hộp giấy
```

Thiếu quá sẽ làm giọng mất thân.

Rule:

```txt
Nếu giọng nghe nghẹt/mũi → giảm nhẹ 700Hz - 1kHz.
```

---

## 1kHz–3kHz: độ rõ chữ

Đây là vùng cực kỳ quan trọng cho speech.

Nó quyết định người nghe có nghe rõ phụ âm, từ, câu hay không.

Thiếu vùng này:

```txt
Nghe không rõ chữ
Giọng chìm
Phải tăng volume mới hiểu
```

Dư vùng này:

```txt
Gắt
Mệt tai
Giọng chọc vào tai
```

Rule:

```txt
Muốn voice rõ hơn → boost nhẹ 1.5kHz - 3kHz.
```

Đây là vùng app của bồ nên ưu tiên cho preset:

```txt
Meeting Clear
Voice Note Clear
Lecture Enhance
```

---

## 3kHz–5kHz: presence

Vùng này làm giọng “tiến lên phía trước”.

Boost nhẹ:

```txt
Giọng nổi hơn
Có presence
Nghe gần hơn
Rõ hơn trên loa điện thoại
```

Boost quá tay:

```txt
Gắt
Chói
Mệt
Giọng thô
```

Rule:

```txt
Nếu giọng bị chìm sau khi lọc ồn → boost nhẹ 3–4kHz.
```

Nhưng nếu người nói giọng đã sắc, không nên boost nhiều.

---

## 5kHz–8kHz: sibilance

Đây là vùng âm “s”, “x”, “sh”, “ch”.

Dư vùng này:

```txt
Xì
Chói
Sắc
Nghe “ssss” rất khó chịu
```

Cách xử lý:

```txt
De-esser
Dynamic EQ ở 5kHz - 8kHz
```

Rule:

```txt
Nếu âm “s/x” đâm tai → giảm động vùng 5–8kHz.
```

Không nên EQ cắt cố định quá mạnh, vì sẽ làm giọng mất sáng. Nên dùng **de-esser**, tức là chỉ giảm khi âm “s” xuất hiện.

---

## 8kHz–12kHz: air / detail

Vùng này tạo cảm giác:

```txt
Sáng
Thoáng
Có không khí
Chi tiết
```

Nhưng với mic dở, vùng này thường chứa:

```txt
Hiss
Noise
Artifact
Tiếng xì nền
```

Rule:

```txt
Nếu bản thu sạch → boost nhẹ 8–10kHz cho sáng.
Nếu bản thu ồn/hiss → đừng boost vùng này.
```

---

# 4. Bảng nghe lỗi và biết chỉnh ở đâu

Cái này bồ nên lưu làm “diagnosis map” cho app.

| Người dùng nghe thấy     | Nguyên nhân thường gặp | Chỉnh ở đâu                               |
| ------------------------ | ---------------------- | ----------------------------------------- |
| Giọng ù, nặng nền        | Low rumble             | High-pass 70–100Hz                        |
| Giọng mỏng               | Thiếu low-mid          | Boost nhẹ 120–250Hz                       |
| Giọng đục                | Dư 300–600Hz           | Cut 300–600Hz                             |
| Giọng nghẹt/mũi          | Dư 700Hz–1kHz          | Cut nhẹ 700Hz–1kHz                        |
| Không rõ chữ             | Thiếu 1–3kHz           | Boost 1.5–3kHz                            |
| Giọng chìm               | Thiếu presence         | Boost 3–5kHz                              |
| Giọng chói               | Dư 2–5kHz              | Cut nhẹ 2–5kHz                            |
| Âm “s” xì                | Sibilance              | De-esser 5–8kHz                           |
| Nhiều hiss               | Noise high frequency   | Denoise/cut 8kHz+                         |
| Nghe robot               | AI xử lý quá mạnh      | Giảm enhance strength                     |
| Âm lượng lúc to lúc nhỏ  | Dynamic chưa đều       | Compressor                                |
| Bị vỡ tiếng              | Clipping               | Không cứu hoàn toàn, cần cảnh báo lúc thu |
| Nói bị “bùm” chữ p/b     | Plosive                | Pop filter hoặc cut low transient         |
| Nghe như trong phòng tắm | Reverb                 | Dereverb / giảm room reflection           |

---

# 5. Âm lượng không chỉ là volume

Nhiều người nghĩ âm lượng là kéo volume lên. Không đúng.

Trong voice có mấy khái niệm:

```txt
Peak
RMS
LUFS
Dynamic range
Headroom
```

---

## Peak

Peak là điểm âm lượng cao nhất của waveform.

Nếu peak vượt ngưỡng digital, âm sẽ bị clipping.

```txt
0 dBFS = trần digital
```

Không nên để voice chạm 0 dBFS. Nên chừa headroom.

Target sau xử lý:

```txt
Peak khoảng -1 dBFS đến -3 dBFS
```

Nếu input đã clipping, waveform bị cắt đầu như này:

```txt
Bình thường:    ~~~~~~~~
Clipping:       ___/‾‾‾\___
```

Clipping nghe:

```txt
Rè
Vỡ
Gắt
Mé
```

Cái này **AI khó cứu hoàn toàn**.

App nên detect clipping ngay lúc record.

---

## RMS

RMS là mức năng lượng trung bình. Nó gần với cảm giác “âm lượng thực tế” hơn peak.

Voice có RMS quá thấp:

```txt
Nghe nhỏ
Yếu
Xa
```

RMS quá cao:

```txt
Bị nén quá
Mệt tai
Không tự nhiên
```

---

## LUFS

LUFS là chuẩn đo loudness theo cảm nhận tai người. Với app voice/content, nên dùng LUFS để normalize output.

Target gợi ý:

```txt
Podcast: khoảng -16 LUFS stereo / -19 LUFS mono
Video social: khoảng -14 đến -16 LUFS
Voice note tự nhiên: khoảng -18 đến -20 LUFS
```

Không cần bắt user hiểu LUFS. App chỉ cần có preset:

```txt
Natural
Podcast
Social Video
Meeting
```

Backend tự set target loudness.

---

# 6. Dynamic range: vì sao cần compressor?

Một bản thu voice thường có chỗ nói nhỏ, chỗ nói to.

Nếu không xử lý:

```txt
Câu đầu nghe nhỏ
Câu sau nghe to quá
Người nghe phải chỉnh volume liên tục
```

Compressor dùng để làm âm lượng đều hơn.

Hiểu đơn giản:

```txt
Compressor = tự động giảm phần quá to
Sau đó nâng tổng thể lên
```

Thông số compressor:

```txt
Threshold: bắt đầu nén từ mức nào
Ratio: nén mạnh bao nhiêu
Attack: phản ứng nhanh hay chậm
Release: nhả nén nhanh hay chậm
Makeup gain: tăng âm sau khi nén
```

Ví dụ cho voice:

```txt
Threshold: -20dB đến -12dB
Ratio: 2:1 đến 4:1
Attack: 5–20ms
Release: 80–200ms
```

Nghe bằng tai:

```txt
Chưa compressor:
- lúc nhỏ lúc to
- thiếu chuyên nghiệp

Compressor vừa:
- đều hơn
- gần hơn
- dễ nghe hơn

Compressor quá tay:
- bí
- mệt
- mất tự nhiên
- nghe như radio ép quá mạnh
```

Với app của bồ, compressor nên nằm sau denoise/isolation.

---

# 7. EQ: công cụ chỉnh màu giọng

EQ là chỉnh tần số.

Có 3 kiểu EQ quan trọng:

```txt
High-pass / Low-cut
Low-pass / High-cut
Parametric EQ
```

## High-pass

Cho tần số cao đi qua, cắt tần số thấp.

Dùng để bỏ rumble.

```txt
Voice: high-pass 70–100Hz
```

## Low-pass

Cho tần số thấp đi qua, cắt tần số cao.

Dùng khi có hiss/noise cao.

```txt
Voice dở/ồn: low-pass nhẹ 12–16kHz
```

## Parametric EQ

Chọn một vùng cụ thể để boost/cut.

Ví dụ:

```txt
Cut 400Hz để giảm đục
Boost 2.5kHz để rõ chữ
De-ess 6.5kHz để giảm xì
```

---

# 8. Noise: tiếng ồn có nhiều loại

Không phải noise nào cũng giống nhau.

## Noise ổn định

Ví dụ:

```txt
Quạt
Máy lạnh
Điện nền
Hiss của mic
```

Loại này dễ xử lý hơn. AI denoise hoặc noise profile có thể giảm tốt.

## Noise ngẫu nhiên

Ví dụ:

```txt
Gõ bàn phím
Tiếng xe bóp còi
Người nói phía sau
Chó sủa
Cửa đóng
```

Loại này khó hơn. Vì nó không đều và đôi khi trùng tần số với giọng người.

## Noise giống giọng người

Ví dụ:

```txt
Người khác nói phía sau
TV đang phát tiếng người
Radio
```

Đây là khó nhất, vì model phải phân biệt “voice chính” và “voice nền”.

CapCut Vocal Isolate mạnh ở chỗ này vì nó dùng source separation/speech isolation, không chỉ noise suppression.

---

# 9. SNR: tỷ lệ giọng so với nền

SNR = Signal-to-Noise Ratio.

Hiểu đơn giản:

```txt
SNR cao = giọng lớn hơn nền nhiều = dễ cứu
SNR thấp = nền gần bằng hoặc lớn hơn giọng = khó cứu
```

Ví dụ:

```txt
Giọng: -18dB
Noise: -50dB
=> Rất tốt

Giọng: -18dB
Noise: -25dB
=> Ồn nhưng còn xử lý được

Giọng: -18dB
Noise: -18dB
=> Cực khó, giọng và ồn ngang nhau
```

App nên có chỉ báo:

```txt
Recording environment:
Good / Noisy / Very noisy
```

Và nên nói thật:

```txt
“Input quá ồn, output có thể bị artifact.”
```

---

# 10. Reverb / Echo: kẻ thù lớn của voice

Noise suppression không đồng nghĩa với khử vang.

Reverb là tiếng phản xạ phòng.

Ví dụ:

```txt
Nói trong phòng trống
Tường cứng
Sàn gạch
Không rèm
Không vật mềm
```

Nghe sẽ:

```txt
Xa
Rỗng
Như trong phòng tắm
Không rõ chữ
```

Reverb khó xử lý hơn noise ổn định, vì nó chính là giọng của user nhưng bị phản xạ.

Dấu hiệu:

```txt
Sau mỗi chữ có đuôi kéo dài
Giọng không gần
Âm bị nhập vào nhau
```

Cách xử lý:

```txt
Dereverb model
Gate nhẹ
EQ giảm vùng muddy
Compression cẩn thận
```

Nhưng tốt nhất vẫn là hướng dẫn user lúc thu:

```txt
Nói gần mic hơn
Tránh phòng trống
Dùng rèm/chăn/vật mềm
Không quay mặt vào tường cứng
```

App nên có “Room Echo Detection” tương đối, hoặc ít nhất hỏi user:

```txt
Bạn đang thu trong phòng vang?
[Normal] [Echo room] [Outdoor] [Noisy room]
```

---

# 11. Plosive: tiếng bụp chữ P/B

Khi nói chữ:

```txt
p
b
ph
```

Luồng hơi đập vào mic gây tiếng “bụp”.

Vùng ảnh hưởng thường ở low frequency.

Cách xử lý:

```txt
Pop filter vật lý là tốt nhất
High-pass filter
Detect transient low-frequency
Reduce gain cục bộ
```

App có thể detect kiểu:

```txt
Low-frequency burst bất thường trong thời gian ngắn
```

Rồi giảm vùng dưới 150Hz tại đoạn đó.

---

# 12. Sibilance: tiếng xì chữ S/X

Ví dụ câu:

```txt
“Sáng sớm sau sân sau...”
```

Nếu mic hoặc EQ làm vùng cao quá mạnh, sẽ nghe:

```txt
ssss
xì
chói
đâm tai
```

Xử lý bằng de-esser.

De-esser thực chất là compressor chỉ nhắm vào vùng:

```txt
5kHz - 8kHz
```

Logic:

```txt
Nếu vùng 6kHz tăng đột biến khi có âm s/x
→ giảm vùng đó tạm thời
```

Không nên chỉ EQ cắt cố định 6kHz, vì sẽ làm toàn bộ giọng mất sáng.

---

# 13. Artifact: lỗi do AI tạo ra

Khi AI denoise/isolate quá mạnh, nó sinh artifact.

Nghe như:

```txt
Robot
Underwater
Metallic
Lấp lánh giả
Đứt chữ
Mất hơi thở
Âm cuối bị nuốt
```

Nguyên nhân:

```txt
Model remove nhầm phần giọng là noise
Noise quá gần với voice
Enhance strength quá cao
Input quá kém
```

Nên app cần có control:

```txt
Natural ←→ Clean
```

Ví dụ:

```txt
Natural 30%
- giữ giọng thật hơn
- còn chút nền

Clean 80%
- sạch hơn
- dễ có artifact
```

Với content voice, “sạch tuyệt đối” chưa chắc hay. Đôi khi giữ một chút room tone nghe tự nhiên hơn.

---

# 14. Sample rate, bit depth, bitrate

Đây là phần kỹ thuật file audio.

## Sample rate

Sample rate là số lần lấy mẫu mỗi giây.

Phổ biến:

```txt
16kHz  : speech model, call, ASR
44.1kHz: music/CD
48kHz  : video, podcast, production
```

Với app voice recorder, nên thu ở:

```txt
48kHz / 24-bit nếu có thể
```

Sau đó muốn đưa vào model thì resample về format model cần.

Không nên thu trực tiếp 16kHz nếu mục tiêu output đẹp, vì mất bớt chi tiết cao.

---

## Bit depth

Bit depth ảnh hưởng dynamic range.

```txt
16-bit: đủ dùng
24-bit: tốt hơn cho recording/editing
32-bit float: rất tốt cho internal processing
```

Pipeline nên:

```txt
Record: 24-bit hoặc float nếu API cho phép
Internal processing: 32-bit float
Export: WAV 24-bit hoặc MP3/AAC tùy user
```

Internal dùng float để tránh lỗi khi xử lý nhiều bước.

---

## Bitrate

Bitrate quan trọng khi export dạng lossy như MP3/AAC.

Gợi ý:

```txt
WAV: chất lượng cao, nặng
MP3 192kbps: đủ tốt cho voice
MP3 256/320kbps: tốt hơn
AAC 128–192kbps: ổn cho video/social
```

MVP nên export:

```txt
WAV trước
Sau đó thêm MP3/AAC
```

---

# 15. Thứ tự xử lý audio rất quan trọng

Không nên xử lý lung tung. Một pipeline hợp lý:

```txt
Raw audio
  ↓
DC offset removal
  ↓
High-pass filter
  ↓
Resample / mono
  ↓
VAD / noise analysis
  ↓
Denoise / voice isolate
  ↓
De-click / de-plosive
  ↓
EQ correction
  ↓
Compressor
  ↓
De-esser
  ↓
Loudness normalization
  ↓
Limiter
  ↓
Export
```

Tại sao denoise trước compressor?

Vì compressor sẽ kéo tiếng nhỏ lên. Nếu compress trước khi denoise, tiếng noise cũng bị kéo lên.

```txt
Sai:
Raw noisy → Compressor → noise to hơn → Denoise khó hơn

Đúng:
Raw noisy → Denoise → Compressor → voice đều hơn
```

---

# 16. App cần phân tích “hay/dở” bằng gì?

Bồ có thể xây một **Audio Quality Analyzer**.

Nó không cần hoàn hảo ngay, nhưng nên có các chỉ số:

```txt
Peak level
Clipping count
Noise floor
Estimated SNR
Speech ratio
Silence ratio
RMS
LUFS
Spectral balance
Sibilance score
Muddy score
Reverb risk
Artifact risk
```

Ví dụ output internal:

```json
{
  "peak_db": -2.1,
  "rms_db": -23.5,
  "noise_floor_db": -48.0,
  "snr_db": 24.5,
  "clipping_count": 0,
  "speech_ratio": 0.72,
  "muddy_score": 0.62,
  "sibilance_score": 0.34,
  "reverb_risk": "medium"
}
```

UI cho user thì đơn giản:

```txt
Input Quality: Good
Noise: Medium
Voice Clarity: Needs boost
Clipping: None
Recommended preset: Clean Voice
```

---

# 17. Cách app tự quyết định chỉnh gì

Bồ có thể làm rule engine trước, AI sau.

Ví dụ:

```txt
Nếu noise_floor cao và SNR thấp
→ dùng denoise mạnh hơn

Nếu muddy_score cao
→ cut 300–600Hz

Nếu clarity thấp
→ boost 1.5–3kHz

Nếu sibilance cao
→ de-esser mạnh hơn

Nếu peak gần 0 hoặc clipping có
→ cảnh báo input bị vỡ

Nếu RMS thấp
→ normalize + compressor

Nếu reverb risk cao
→ dùng preset Echo Room Rescue
```

Pseudo logic:

```ts
if (snr < 10) {
  preset.noiseReduction = "strong";
  preset.enhanceStrength = 75;
}

if (muddyScore > 0.6) {
  eq.cut(400, -3);
}

if (clarityScore < 0.5) {
  eq.boost(2500, +2);
}

if (sibilanceScore > 0.7) {
  deEsser.amount = "strong";
}

if (clippingCount > 0) {
  showWarning("Âm đã bị vỡ khi thu, không thể phục hồi hoàn toàn.");
}
```

---

# 18. Những preset nên có trong app

## 1. Natural Clean

Mục tiêu:

```txt
Sạch hơn nhưng vẫn tự nhiên
```

Xử lý:

```txt
Noise reduction nhẹ
High-pass 80Hz
EQ nhẹ
Compression nhẹ
Limiter
```

Dùng cho:

```txt
Voice note
Ghi chú cá nhân
Meeting
```

---

## 2. Podcast Warm

Mục tiêu:

```txt
Ấm, gần, đều, chuyên nghiệp
```

Xử lý:

```txt
High-pass 70Hz
Boost nhẹ 180–250Hz
Cut nhẹ 350–500Hz nếu đục
Boost nhẹ 2–4kHz
Compressor medium
De-esser medium
LUFS -16
```

---

## 3. Clear Speech

Mục tiêu:

```txt
Rõ chữ, dễ nghe trên loa điện thoại
```

Xử lý:

```txt
High-pass 100Hz
Cut 300–600Hz
Boost 2–4kHz
Compression vừa
De-esser nhẹ
```

Dùng cho:

```txt
Bài giảng
Meeting
Voice over
Video ngắn
```

---

## 4. Noisy Room Rescue

Mục tiêu:

```txt
Cứu bản thu ồn
```

Xử lý:

```txt
Denoise mạnh
VAD
Gate nhẹ
EQ giảm low/mid noise
De-esser cẩn thận
Enhance Strength cao
```

Rủi ro:

```txt
Dễ bị robot
```

UI nên cảnh báo:

```txt
“Preset này ưu tiên sạch nền, có thể làm giọng kém tự nhiên hơn.”
```

---

## 5. Low Mic Rescue

Mục tiêu:

```txt
Bản thu quá nhỏ, giọng xa
```

Xử lý:

```txt
Normalize
Compressor
Presence boost
Noise reduction vừa
Limiter
```

Rủi ro:

```txt
Kéo cả noise lên
```

---

## 6. Bright Social Voice

Mục tiêu:

```txt
Giọng sáng, nổi, hợp video ngắn
```

Xử lý:

```txt
High-pass 90Hz
Cut muddy
Boost 3–5kHz
Air boost nhẹ nếu sạch
Compressor medium/strong
LUFS -14 đến -16
```

Rủi ro:

```txt
Dễ chói nếu boost quá tay
```

---

# 19. Tầng “AI tuning” nên làm gì?

AI không nhất thiết chỉ để denoise. Có thể dùng AI cho:

```txt
Voice activity detection
Noise classification
Speech enhancement
Dereverb
Source separation
Auto EQ recommendation
Preset recommendation
Artifact detection
```

Nhưng với MVP, nên làm như này:

```txt
AI model:
- VAD
- Denoise / speech enhancement

Rule-based DSP:
- EQ
- compressor
- de-esser
- limiter
- loudness normalize
```

Đừng dùng AI cho tất cả ngay. DSP truyền thống vẫn rất mạnh và dễ kiểm soát.

---

# 20. Cái app nên “nghe” như audio engineer

Một audio engineer khi nghe voice sẽ tự hỏi:

```txt
1. Có bị vỡ không?
2. Có đủ lớn không?
3. Có ồn không?
4. Có vang không?
5. Có ù không?
6. Có đục không?
7. Có rõ chữ không?
8. Có chói không?
9. Có xì sibilance không?
10. Có đều âm lượng không?
11. Sau khi xử lý có bị giả không?
```

App của bồ nên mô phỏng checklist này bằng analyzer + preset.

---

# 21. Chỗ nào “quyết định chất lượng” nhất?

Theo thứ tự quan trọng:

## 1. Input quality

Mic, khoảng cách, clipping, môi trường.

```txt
Input tệ quá thì output không thể hoàn hảo.
```

App nên hướng dẫn user ngay lúc thu.

## 2. SNR

Giọng phải nổi hơn nền. Nếu noise ngang giọng, rất khó.

## 3. Reverb

Phòng vang làm giọng mất rõ. Cực khó cứu hoàn toàn.

## 4. Frequency balance

EQ sai làm giọng ù, đục, chói, mỏng.

## 5. Dynamic control

Không compressor/normalize thì âm lượng không đều.

## 6. AI artifact control

Lọc quá mạnh thì sạch nhưng giả.

---

# 22. Bồ nên build feature analyzer trước

Trước khi build model xịn, hãy build màn debug:

```txt
Audio Analysis Panel
```

Hiển thị:

```txt
Waveform
Spectrogram
Peak/RMS/LUFS
Noise floor estimate
Clipping markers
VAD speech segments
Frequency balance
Recommended fixes
```

Spectrogram cực hữu ích vì nó cho thấy năng lượng theo thời gian và tần số.

Ví dụ:

```txt
Tiếng quạt:
- dải thấp liên tục

Hiss:
- dải cao liên tục

Sibilance:
- spike ở 5–8kHz khi nói chữ s/x

Plosive:
- burst mạnh dưới 150Hz

Reverb:
- đuôi âm kéo dài sau voice
```

---

# 23. Một pipeline “auto enhance” thực tế

```txt
Input WAV
  ↓
Analyze:
- clipping
- noise floor
- SNR
- VAD
- spectral balance
  ↓
Choose preset:
- Natural / Clear / Rescue
  ↓
Process:
- high-pass
- denoise
- EQ
- compressor
- de-esser
- loudness normalize
- limiter
  ↓
Analyze output again:
- peak
- loudness
- artifact risk
  ↓
A/B Preview
```

Điểm hay là app không chỉ xử lý một chiều. Nó nên:

```txt
Analyze before
Process
Analyze after
Compare
```

---

# 24. Tư duy quan trọng nhất

Bồ đừng nghĩ:

```txt
Âm thanh dở → AI model → âm thanh hay
```

Mà nên nghĩ:

```txt
Âm thanh dở
→ xác định dở ở đâu
→ chọn đúng công cụ xử lý
→ xử lý vừa đủ
→ kiểm tra lại có gây lỗi mới không
```

Ví dụ:

```txt
Giọng đục không cần AI isolate.
Giọng đục cần EQ vùng 300–600Hz.

Âm lượng không đều không cần vocal separation.
Nó cần compressor.

Tiếng sibilance không cần denoise.
Nó cần de-esser.

Tiếng quạt cần denoise.
Tiếng người phía sau cần isolation.

Phòng vang cần dereverb.
Mic vỡ cần cảnh báo, không cứu được hoàn toàn.
```

Đó mới là core của app.

---

## Kết luận gọn

Muốn biết chỗ nào hay/dở để điều chỉnh, app của bồ cần hiểu 7 lớp:

```txt
1. Frequency balance
2. Loudness
3. Dynamic range
4. Noise
5. Reverb
6. Distortion
7. AI artifacts
```

Và các công cụ chính:

```txt
High-pass filter  → bỏ ù thấp
EQ                → chỉnh màu giọng
Denoise AI         → giảm nền
Vocal isolation    → tách giọng khỏi nền phức tạp
Compressor         → làm âm lượng đều
De-esser           → giảm tiếng xì
Limiter            → tránh vỡ output
LUFS normalize     → đưa âm lượng về chuẩn
Dereverb           → giảm vang phòng
```

Nói ngắn nhất: **AI giúp cứu giọng, nhưng DSP mới là thứ làm giọng nghe “đã” và kiểm soát được.**
