# 珍藏小物 · 照片重建收藏

毛绒挂件与晴空塔冰箱贴的离线交互收藏。下载此分支后，打开 [完整交互版](dist/keepsake.html) 即可使用；HTML 内含所需模型、贴图和程序。

![毛绒正面、侧面与背面](preview/sheet.jpg)

## 本次修订

手机控件集中到顶部，物件菜单默认收起，按钮触控区至少 44 像素。单指轻触／按住拖动；双指弯折后，剩下一指可继续拖动。空白处转视角、双指缩放；“物件居中”可找回当前物件。

抓取时相机停止动画和惯性，触摸取消、切到后台或屏幕变化时安全松手。轻点与释放的冲量降低，玩偶落桌后进入静止；冰箱贴的弯曲表面参与桌面接触修正，避免可见表面穿桌。

保持按原照片描出的不对称头部、较薄填充、细腿、正面布饰和缝入身体的标签。毛绒照片图集提高为 3072×3072，主体 162,708 个三角形；冰箱贴与纸卡细分更密，离线图片无损内嵌，高分屏显示精度提高。

[手机界面](preview/mobile.jpg) · [展开菜单](preview/mobile-menu.jpg)

## 独立模型

- [毛绒本体](models/plush-body.glb)
- [毛绒及珠链吊牌](models/plush-chain-tag.glb)
- [冰箱贴本体](models/magnet.glb)
- [冰箱贴及完整包装](models/magnet-packaged.glb)

均为含内嵌贴图的 GLB，单位为米。静态模型保存形状与外观；互动保存在 HTML 中。[使用说明](使用说明.txt) 包含手势、正常拆包和台灯操作。

## 构建与验证

安装 Node.js 22+ 和 Python 后运行 `npm ci`、`pip install Pillow`、`npm run build`。开发入口为工程目录的 `index.html`，需用 `python tools/devserver.py 8875` 通过本机 HTTP 打开。

`npm test` 运行模型、布标连接、单指抓取、双指受限变形、取下、落桌、GLB 导出与读回检查。验证记录位于 [verification/model-physics.json](verification/model-physics.json)。离线渲染预览可通过安装 `requirements.txt` 的依赖后运行 `python tools/render_plush_review.py` 重建。

本轮 38 项 Node 模型与物理检查、62 项浏览器交互检查、手机与桌面各 18 项离线检查通过；四份 GLB 重新导出、校验并在浏览器读回。[验证记录](验证记录.txt) 和 [完整报告](verification/) 保留测试范围与数值。手机检查为 390×844 布局及模拟触摸，尚未逐台实测手机硬件。

尺寸和材料响应为照片估算，不等同于精密扫描或实物材料测量。原始照片、身份证影像、私人下载链接和本机备份未随仓库发布。模型重建脚本需要的原图由收藏者在本机另行保存。
