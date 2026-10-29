# Oculid Motion Lab

**A binocular motion simulator with animated eyelids, built on Binocular Motion Lab.**

[Live demo](https://zhh0907.github.io/oculid-motion-lab/) · [Complete workspace](https://zhh0907.github.io/oculid-motion-lab/workspace.html) · [中文调研与设计](docs/RESEARCH.zh-CN.md) · [Architecture](docs/ARCHITECTURE.md)

![一体化三维头部与动态眼球](docs/volume-head.png)

## 0.8: English interface and two face shapes

- English controls, patient messages, status text, chart labels, demo and methods pages.
- **Face shape → Male / Female** changes the 3D jaw, chin, nose, cheeks and brow contour. Both are authored variants of the same licensed base mesh, not two independent scans.
- Face changes preserve the current patient, simulation state and trace history. Run JSON records the shape version and timestamped `faceChanges`.
- Both presets work in the homepage, full workspace and three-case demo. Skin tone remains independent.
- [Shape implementation and reproduction](docs/FACE-SHAPES.md).

## 0.7 更新：一体化三维头部与分层眼球

- 移除运行时人脸照片贴图；扫描头部网格与动态眼睑共用边界顶点，并增加有厚度的睑缘、立体眼角和细管毛发。
- 眼球包含开口巩膜、后置虹膜、真实瞳孔孔洞、暗色内腔及独立透明角膜。
- 拖动旋转、滚轮缩放，支持灰模和网格查看；“正面检查”恢复跟随任务视角。患者参数与仿真时钟不受观察角度影响。
- 五种肤色、三种虹膜预设；保留固定患者、食指跟随、简洁滑轴及实时轨迹。
- 38 项 Node 测试及五套浏览器检查通过。[结构、公式、素材与验证](docs/VOLUME-v7.zh-CN.md)。

## 0.6 历史更新：立体扫描面部与简化肤色

- 以 Lee Perry-Smith 的开放许可头部扫描替换浅平面背景，保留完整鼻部、面颊、耳部和自然眉毛、皮肤细节；眼睑与眼球仍实时运动。
- 扫描面部与动态眼周共用皮肤纹理；调整正面透视、柔和照明和眼眶层次，修复交界处三角形孔隙。
- 肤色简化为五种常见预设，虹膜保留三种颜色，取消自由调色盘。
- 36 项 Node 测试及五套浏览器检查通过。患者参数、手指跟随、实时滑轴和运动轨迹保持兼容。
- [实现、素材署名与边界](docs/REALISM-v6.zh-CN.md) · [面部预览](docs/face-preview.png)。素材为 Lee Perry-Smith 的 *Infinite, 3D Head Scan*，采用 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)；来源为 [Three.js r180](https://github.com/mrdoob/three.js/tree/r180/examples/models/gltf/LeePerrySmith)。

## 0.5.1 更新：简洁的实时双眼滑轨

- 在眼部画面下增加两条水平眼位轴，L / R 眼各有一个随当前眼位左右滑动的圆点，参考 GazeLab 的即时眼位显示方式。
- 实心圆点显示当前患者，空心圆显示正常参考；0 为眼角中点。瞳孔被眼睑遮挡时以虚线圆点提示，暂停和食指丢失时保持位置。
- 滑轨显示仿真几何投影的相对眼位；原来的时间曲线和二维轨迹仍在其下方。

## 0.4 更新：患者库与实时轨迹

- 首页整合原模拟器的三种受限模板，支持左右侧明显示例、批量均衡随机生成、固定编号调用，以及患者库 JSON 导入/导出。
- 生成后参数固定：换输入轨迹、控制器或眼睑外观都不重新抽样；首页与完整工作台共享本系统的浏览器患者库。
- 眼部画面下方实时显示水平/时间、垂直/时间及水平/垂直二维眼位。实线为当前眼位，虚线为同输入下的正常模型参考。
- 最近 20 秒滚动显示，暂停或食指丢失时冻结；120 秒导出缓存满后图表仍继续。清图不影响患者或记录。
- [操作、坐标和复现说明](docs/PATIENTS-AND-TRACES.zh-CN.md)。患者只生成候选运动，不预设 NIHSS 分数。

## 0.3 更新：眼角与皮肤

- 用连接上下睑的连续组织面替换眼角小球，区分鼻侧的泪阜/半月皱襞近似和颞侧的皮肤连接；闭眼时随眼裂闭合。
- 增加固定的多尺度皮肤纹理、毛孔、细纹和局部肤色，改善眼睑折痕、湿润睑缘及眼白接触阴影。
- 睫毛改为渐细的曲线网格，眉毛增加分层密度。修复外圈接缝的小黑点及闭眼后的白色高光线。
- 几何瞳孔可见比例纳入眼角遮挡；所有眼动控制器和病例参数保持兼容。
- [本轮实现与验证边界](docs/REALISM-v3.zh-CN.md)。这是程序化外观改进，仍未达到真人扫描级写实。

## 0.2 更新

- 眼睑随动加入时间响应：上看、下看速度不同；眼球立即沿原模型运动，眼睑随后跟进。
- 眨眼使用快闭慢开曲线和可重复的非等间隔节律，加入鼻侧组织滑动、下睑抬升、褶皱展开及睫毛弯曲。眉毛不会跟着每次眨眼整体下移。
- 重建眼周与鼻梁连接，消除径向网格造成的圆形接缝和眼角尖锐褶皱；加入湿润睑缘、细微肤色变化和简化角膜反光。
- 首页默认目标范围扩大到水平 **左右各 42° / 上 30° / 下 42°**。支持独立调整，以及一键切回原版范围。这里只修改目标方向，病例参数、GRU 和食指投影没有增益放大。
- [本次设计依据与验证](docs/REALISM-v2.zh-CN.md)。宽幅 GRU 行为仍属探索，范围预设不是统一的人体生理限位。

## 已实现

- 连续三维上下眼睑、垂直注视随动、自动/手动眨眼、单眼上睑覆盖、可调眼裂。
- 立体虹膜、可调瞳孔孔洞、透明凸面角膜、连续头部皮肤及三维毛发。
- 原有两种 GRU、几何参考、正常、三种模板的左右侧明显示例，以及可编号调用的固定患者。
- 自动水平/垂直/圆周/阶跃/远近目标、鼠标/触控和本地摄像头食指跟随。
- 新旧外观共享相同角度，支持逐帧同步对照；最多 120 秒 JSON/CSV 数据导出。
- 完整工作台保留原工程的病例库、数据回放、移动端工具栏、屏幕/相机标定与历史导出格式。

This is a research prototype combining a licensed reference face scan with procedural moving eyes and eyelids. It preserves the existing gaze controller. The scan does not validate the animated eyelid physiology, synthetic patients or image-based gaze tracking. It is not an optical ray tracer or a multi-identity face generator.

## Compatibility evidence

| Check | Result |
| --- | --- |
| Upstream-generated golden fixture | **3,600 samples, exact angle equality** across 2 GRUs + ideal geometry and 4 patterns |
| Node tests | **40 passed**, including upstream patient/demo tests, lid closure/bounds, invariance and audited file hashes |
| Homepage browser tests | Rendered iris, exact same-pose comparison, full closure, cases, pointer/camera boundary, tracking loss/recovery, JSON/CSV, reduced motion |
| Complete workspace and demo | Patient persistence/import/export, all replay controllers, seeking, injected live input and mobile tools passed |
| Layout | 1440 px desktop and 320/390/844 px mobile viewports checked |
| Physical-camera accuracy | **Not measured**; camera integration tests inject targets at the existing input boundary |

See [validation details](docs/VALIDATION.md). Eyelids never feed back into the controller. This gives software compatibility for the same inputs and state, not a guarantee that an external eye tracker can recover gaze through occluded pupils. Fully closed eyelids contain no visible pupil information.

## Run locally

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000/`. No npm build, API key, runtime CDN, or backend is required. Keep `vendor/`, `recordings/` and all model JSON files in place. Camera access needs localhost or HTTPS.

The homepage uses English controls. `workspace.html` provides the inherited English research workspace; `demo.html` provides the three fixed cases with eyelids. Changing homepage options begins a new recording. The manual blink button or **B** key starts a blink; pause stops simulation time. Disabling comparison hides only its view.

The homepage uses the original assumed-plane camera mapping. Use the complete workspace when measured camera/screen calibration or human-data replay is needed. Patient and calibration storage have independent Oculid keys, so this project does not overwrite the original site's saved settings. Transfer them explicitly via JSON export/import.

## Tests

```sh
npm test
npm ci
# Browser tests require Google Chrome; all processing stays local.
npm run test:browser
npm run test:workspace
npm run test:face
```

Node 22+ is recommended. Browser tests use Playwright; the homepage test can select an installed channel through `PW_CHANNEL`. Generated screenshots/downloads are ignored under `qa/`; the checked-in preview and compact report are under `docs/`.

## Layout

| Path | Purpose |
| --- | --- |
| `src/simulation.mjs` | Target and controller orchestration, synchronized export |
| `src/eyelid-model.mjs` | Pure deterministic eyelid/blink/visibility math |
| `src/target-range.mjs` | Angular target excursions; original camera mapping is unchanged |
| `src/head-topology.mjs`, `src/head-mesh.mjs`, `src/lid-volume.mjs` | Connected head/lid topology, deformation and hair |
| `src/globe-mesh.mjs`, `src/eye-anatomy.mjs`, `src/eye-rig.mjs` | Layered eyes, dimensions, lighting and orbit camera |
| `src/main.mjs`, `index.html`, `oculid.css` | New interface |
| `workspace.html`, `app.js` | Complete inherited workspace with new eye meshes |
| `engine.js`, `models-selected.json`, `patient-model.mjs` | Audited upstream motion code and weights |
| `docs/upstream-manifest.json` | Original commit, file hashes and storage-only adaptations |
| `tests/fixtures/upstream-golden.json` | Independent outputs generated from the original project |

## Research and attribution

The [research review](docs/RESEARCH.zh-CN.md) compares SynthesEyes, UnityEyes, UnityEyes 2, U2Eyes, RIT-Eyes, Temporal RIT-Eyes, OpenEyeSim, PyEtSimul, AniEyelid and Pupilla. It is a focused public-source review dated 2026-10-27, not a claim to have exhaustively tested every simulator online. Their research assets are not bundled here.

Built from Honghao Zhao's [Binocular Motion Lab](https://github.com/zhh0907/binocular-motion-lab), including its current local three-case demo. The original checkout was not edited. Existing Three.js, MediaPipe and GazeBaseVR attributions remain in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). New Oculid source files use the scoped [MIT license](LICENSE); inherited assets retain their existing terms.

No new human-eye training, physiological validation, or medical grading was performed. GazeBaseVR model metrics do not establish the accuracy of the added eyelids or a camera system. Future high-fidelity eye-region assets can replace the renderer while retaining the same motion contract.
