# 0.9：Binocular 与 Oculid 合并

合并日期：2026-11-13。后续开发以 **Oculid Motion Lab** 为唯一主仓库。
Binocular 原站保留历史运行入口和迁移提示，方便复现实验。

## 来源与职责

- Binocular 合并基点：`e0220722e3340ad29e78db030db0fd9c20d4fede`。
- Oculid 合并前版本：`ea4011c3d4f049be6be44d5e49b2d829cd844967`，0.8.0。
- `src/core/`：唯一的几何、GRU、患者动力学实现，以及三种界面共用的 `motionStep`。
- `src/index.mjs`：可直接在 Node 或浏览器中导入的纯计算入口，不加载相机、DOM 或 Three.js。
- `src/inputs/index.mjs`：浏览器输入适配器入口。相机、worker、WASM 保留原地址及字节，避免迁移破坏资源加载。
- `src/patient-bank.mjs`：首页与完整工作台共用的患者存储逻辑；处理不可用存储、损坏备份和过期标签页写入。
- `src/eyelid-model.mjs` 与渲染模块：只消费运动输出。眨眼、脸型及显示模式不回写眼动控制器。
- `research/`：无需浏览器的可复现等价性检查和验证边界说明。

根目录的 `engine.js`、`patient-model.mjs` 是兼容导出，实际实现只有一份。
现阶段保留一个包与几个明确的导出入口，不拆出多个需要独立发版的 npm 包；也未发布到 npm registry。

## 同一状态的三种显示

首页的 **Display** 可选 Full eye region、Eyes only、Paired comparison。
切换只改变呈现，不清除患者、模型状态、仿真时间、轨迹或导出缓存。
并排对照使用完全相同的角度、相机位置与投影；手机上上下排列。
两视图的头部、遮挡和眼眶阴影自然不同，不能据此宣称像素完全等价。
完整工作台提供完整眼周与仅眼球切换，保留全部旧回放控制器、拖动回放、标定、导入和导出。

眼球几何使用 Oculid 的分层实现；仅眼球模式保留原运动效果，不试图复刻原站每一个渲染像素。
目标范围、眨眼参数和模型权重未因合并而扩大或重新拟合。

## 迁移原来的数据

在同一个浏览器配置中打开 [迁移页面](https://zhh0907.github.io/oculid-motion-lab/migration.html)。
两个 GitHub Pages 地址属于同一 origin，因此页面可读取旧命名空间。
也可以选择旧系统导出的患者库或屏幕/相机 JSON 文件。

1. 选择要迁移的数据，先检查预览。
2. 点击 Import reviewed data 后才写入 Oculid。
3. 重新加载已打开的模拟器页面。
4. 标定参数迁移后处于停用状态；在完整工作台重新绑定相机、核对屏幕尺寸后启用。

原始键值始终保留。相同患者库按固定身份合并；跨库身份、冲突编号、损坏数据或其他标签页的新写入会阻止覆盖。
已有 Oculid 标定不会被迁移页面覆盖，可通过完整工作台的标定导入显式替换。
`oculid-run-v1` 和完整工作台原有 `gaze-patient-run-v1` 导出格式均保留。

## 复用计算库

```js
import {MotionSession} from './src/index.mjs';

// null 使用几何参考；传入 bundle.models.gru_expanded_520 使用训练模型。
const session = new MotionSession({model: null, patient: null});
const frame = session.step([0.2, 0.1, 0.7]);
console.log(frame.angles); // [左 yaw, 左 pitch, 右 yaw, 右 pitch]，单位度
session.reacquire();      // 重置控制器输入历史；保留患者动力学和时间
session.reset();          // 开始新的仿真
```

每次 `step` 为 1/250 秒模型时间；不是显示器或相机帧率。
角度、坐标、模型有效范围与原实现一致。

## 验证范围

`npm test` 检查独立的 3,600 采样参考、共享纯计算入口、患者层、眼睑、数据迁移和存储冲突。
`npm run test:all-browser` 检查六套浏览器流程，包括原回放、病例持久化、食指输入边界、模式切换及迁移页面。
`node research/reproduce.mjs` 输出各控制器和模板的最大角度差。
结果见 [验证记录](VALIDATION.md)。

这些检查证明合并后的软件行为及既有数据兼容。没有新增真人摄像头、临床或生理数据验证，不能将软件等价性当作这些实验的结果。
