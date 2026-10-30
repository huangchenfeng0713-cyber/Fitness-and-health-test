"""Package the verified exhibition and current standalone GLBs."""
from pathlib import Path
import hashlib,json,shutil,zipfile
from validate_glb import validate
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT.parent/'3D收藏'; OUTPUT=ROOT/'dev/qa-output'
reports=[]
for name in ['exhibit-offline-mobile.json','exhibit-offline-desktop.json']:
    report=json.loads((OUTPUT/name).read_text(encoding='utf-8'))
    assert len(report['checks'])>=70 and all(c['pass'] for c in report['checks']) and not report['errors'],name
    for file,digest in report['sourceHashes'].items():
        assert hashlib.sha256((ROOT/file).read_bytes()).hexdigest()==digest,'stale report: '+file
    reports.append(report)
models=DEST/'模型'
models.mkdir(parents=True,exist_ok=True)
mapping={'plush-body.glb':'毛绒挂件_本体.glb','plush-chain-tag.glb':'毛绒挂件_含珠链吊牌.glb','magnet.glb':'冰箱贴_本体.glb','magnet-packaged.glb':'冰箱贴_含完整包装.glb'}
for source,target in mapping.items():
    validate(ROOT/'models'/source)
    shutil.copy2(ROOT/'models'/source,models/target)
for file in models.glob('*.glb'):validate(file)
assert len(list(models.glob('*.glb')))==4
shutil.copy2(ROOT/'dist/keepsake.html',DEST/'珍藏小物.html')
shutil.copy2(ROOT/'收藏使用说明.txt',DEST/'使用说明.txt')
pictures={'exhibition-desktop.jpg':'预览.jpg','exhibition-detail.jpg':'毛绒细节.jpg','exhibition-mobile.jpg':'手机预览.jpg','exhibition-gallery.jpg':'手机菜单.jpg','exhibition-magnet.jpg':'冰箱贴预览.jpg'}
for source,target in pictures.items():shutil.copy2(OUTPUT/source,DEST/target)
text='珍藏 · 悬浮展览验证记录\n\n'
text+=f'本轮离线手机 {len(reports[0]["checks"])} 项、离线桌面 {len(reports[1]["checks"])} 项检查通过。\n'
text+='包含单件显示、真实模型缩略图、点选拿近、单指旋转、双指缩放及接续、触摸取消、失焦释放、轻压复原、静止无抖动、五步正常拆包、受限弯曲与装回。\n'
text+='320×568、390×844、844×390 控件边界和至少 44 像素触控区检查通过。说明文字不拦截触摸，拿近后底部说明隐去。\n'
text+='离线测试拒绝 HTTP/HTTPS 请求，使用与交付文件相同的内嵌资产。报告包含 HTML 及主模块 SHA-256。\n'
text+='四份原有独立 GLB 的几何和内嵌贴图重新校验；新下载功能另作导出与读回检查。\n'
text+='本轮保留毛绒照片几何，修复磁贴背面 UV 与两个轮廓凹口；提供珠链重力和碰撞、吊牌翻面与拖动、按秒衰减的旋转惯性；不提供落桌或磁吸操作。\n'
text+='触摸测试为浏览器程序模拟，未逐台实测手机硬件。尺寸和材料反应为照片估算。\n'
(DEST/'验证记录.txt').write_text(text,encoding='utf-8')
allowed_tools={'build.py','verify_embedded_assets.py','devserver.py','validate_glb.py','render_plush_review.py','offline_plush_verify.mjs','test.mjs','exhibit_physics_verify.mjs','rebuild_plush_from_photos.py','package_collection.py','package_exhibition.py'}
allowed_dev={'exhibit-check.html','exhibit-check.js','verify-exhibit-physics.js','verify-magnet-textures.js','native-touch.py','exhibit-readback.html','qa-server.py','readback.html','appearance.html'}
with zipfile.ZipFile(DEST/'工程源码.zip','w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
    for folder in ['src','assets','tools','dev']:
        for p in (ROOT/folder).rglob('*'):
            if not p.is_file() or '.before-' in p.name or '__pycache__' in p.parts:continue
            rel=p.relative_to(ROOT)
            if folder=='tools' and p.name not in allowed_tools:continue
            if folder=='dev' and (p.name not in allowed_dev or len(rel.parts)>2):continue
            z.write(p,rel.as_posix())
    for name in ['index.html','package.json','package-lock.json','requirements.txt','CONTRACT.md','工程说明.md','收藏使用说明.txt']:z.write(ROOT/name,name)
files=[DEST/'珍藏小物.html',DEST/'使用说明.txt',DEST/'验证记录.txt',DEST/'第三方许可.txt',DEST/'工程源码.zip',*[DEST/t for t in pictures.values()],*models.glob('*.glb')]
manifest={str(p.relative_to(DEST)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files}
(DEST/'文件校验.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');files.append(DEST/'文件校验.json')
archive=DEST.parent/'珍藏小物_收藏包.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
    for p in files:z.write(p,(Path('3D收藏')/p.relative_to(DEST)).as_posix())
print('Verified collection:',DEST,'\nArchive:',archive,archive.stat().st_size)
