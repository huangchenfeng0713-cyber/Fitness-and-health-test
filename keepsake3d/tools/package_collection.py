"""Package the verified collection, retaining a recoverable copy of the old delivery."""
from pathlib import Path
import json, shutil, zipfile, hashlib, sys
from validate_glb import validate
ROOT=Path(__file__).resolve().parents[1]
DEST=(ROOT.parent/'3D收藏').resolve()
OUTPUT=ROOT/'dev/qa-output'
assert DEST.is_relative_to(ROOT.parent.resolve())
appearance_only='--appearance-only' in sys.argv
reports=['offline-plush-report.json'] if appearance_only else ['report.json','export-report.json','offline-desktop.json','offline-mobile.json','readback-report.json']
for name in reports:
    data=json.loads((OUTPUT/name).read_text(encoding='utf-8'))
    assert not data.get('errors') and all(c['pass'] for c in data['checks']),name+' failed'
    if name.startswith('offline-'):assert len(data['checks'])>=8,name+' is stale'
    if name=='offline-plush-report.json':
        assert len(data['checks'])>=20
        for file,expected in data['sourceHashes'].items():assert hashlib.sha256((ROOT/file).read_bytes()).hexdigest()==expected,'stale report: '+file
backup=ROOT/'dev/previous-delivery'
if DEST.exists() and not backup.exists(): shutil.copytree(DEST,backup)
DEST.mkdir(exist_ok=True);models=DEST/'模型';models.mkdir(exist_ok=True)
mapping={'plush-body.glb':'毛绒挂件_本体.glb','plush-chain-tag.glb':'毛绒挂件_含珠链吊牌.glb','magnet.glb':'冰箱贴_本体.glb','magnet-packaged.glb':'冰箱贴_含完整包装.glb'}
for source,target in mapping.items():validate(OUTPUT/source);shutil.copy2(OUTPUT/source,models/target)
for old in ['冰箱贴_含包装与冰箱门.glb','毛绒挂件_含珠链吊牌与挂架.glb']:
    path=(models/old).resolve();assert path.is_relative_to(DEST)
    if path.exists():
        archived=ROOT/'dev/previous-models';archived.mkdir(exist_ok=True)
        if not (archived/old).exists():shutil.move(str(path),str(archived/old))
shutil.copy2(ROOT/'dist/keepsake.html',DEST/'珍藏小物.html')
shutil.copy2(ROOT/'收藏使用说明.txt',DEST/'使用说明.txt')
shutil.copy2(OUTPUT/('model-review-sheet.jpg' if appearance_only else 'offline-scene-desktop.jpg'),DEST/'预览.jpg')
shutil.copy2(OUTPUT/('model-review-front.jpg' if appearance_only else 'plush-detail.jpg'),DEST/'毛绒细节.jpg')
extra=[]
if appearance_only:
    for source,target in [('model-review-side.jpg','毛绒侧面.jpg'),('model-review-back.jpg','毛绒背面.jpg')]:
        shutil.copy2(OUTPUT/source,DEST/target);extra.append(DEST/target)
licenses=[]
for name,path in [('three.js (MIT)',ROOT/'node_modules/three/LICENSE'),('Rapier (Apache-2.0)',ROOT/'node_modules/@dimforge/rapier3d-compat/LICENSE')]:
    licenses.append(name+'\n\n'+path.read_text(encoding='utf-8'))
(DEST/'第三方许可.txt').write_text('\n\n'.join(licenses),encoding='utf-8')
report=json.loads((OUTPUT/('offline-plush-report.json' if appearance_only else 'report.json')).read_text(encoding='utf-8'))
text='珍藏小物 · 验证记录\n\n'
if appearance_only:
    text+=f'本轮照片轮廓与布料修订：{len(report["checks"])} 项模型与物理检查通过，运行环境为 Node。\n'
    text+='包含头部／细腿厚度、缝线绑定、布标根部连接、下半身拉拽后布标连接、正面布饰、双指 2 mm 限幅与复原、取下和落桌停止。\n'
    text+='细毛面朝向与表面法线一致，独立毛绒模型已导出并由 GLTFLoader 重新读回，贴图和数值有效。\n'
    text+='正面、侧面、背面的离线模型渲染已核对；预览图不代表浏览器的实时灯光。\n'
    text+='本轮浏览器检查工具连接失败，未重复验证浏览器实时渲染、手机触摸路由及离线启动。\n'
    text+='上一版已通过浏览器拆包、灯光、磁吸和桌面／手机离线检查；这些记录不作为本轮新渲染效果的验证。\n'
    text+='冰箱贴模型与交互保持原有版本；四份交付 GLB 均重新检查几何缓冲、索引、变换和内嵌贴图。\n'
else:
    text+=f'交互自动检查：{len(report["checks"])} 项通过。\n'
    text+='包含正常拆包与装回、模拟单指／双指、挂钩取下、落桌与停止、受限弯折与回弹、吸附／沿铁板移动／取下。\n'
    text+='桌面与 390×844 手机尺寸：禁止网络请求后仍能完整加载；测试了原生触摸事件路由及灯光控件。\n'
    text+='关闭所有灯后，场景画布的 RGB 像素最大值为 0。\n'
    text+='四份 GLB 已检查几何缓冲、索引、有限数值、变换和内嵌贴图，并用 GLTFLoader 重新加载预览。\n'
text+='触摸与物理测试为程序模拟；实际触感、精密尺寸与所有手机硬件未作实测。\n'
(DEST/'验证记录.txt').write_text(text,encoding='utf-8')
with zipfile.ZipFile(DEST/'工程源码.zip','w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
    allowed_tools={'build.py','devserver.py','validate_glb.py','render_plush_review.py','offline_plush_verify.mjs','test.mjs','rebuild_plush_from_photos.py','package_collection.py'}
    allowed_dev={'check.html','check.js','verify-hands.js','export.html','readback.html','offline-check.html','offline-check.js','appearance.html','qa-server.py'}
    for folder in ['src','assets','tools','dev']:
        for p in (ROOT/folder).rglob('*'):
            if not p.is_file() or '.before-' in p.name or '__pycache__' in p.parts:continue
            rel=p.relative_to(ROOT)
            if folder=='tools' and p.name not in allowed_tools:continue
            if folder=='dev' and (p.name not in allowed_dev or len(rel.parts)>2):continue
            z.write(p,rel.as_posix())
    for name in ['index.html','package.json','package-lock.json','requirements.txt','CONTRACT.md','工程说明.md','收藏使用说明.txt']:
        z.write(ROOT/name,name)
files=[DEST/'珍藏小物.html',DEST/'使用说明.txt',DEST/'预览.jpg',DEST/'毛绒细节.jpg',DEST/'验证记录.txt',DEST/'第三方许可.txt',DEST/'工程源码.zip',*extra,*[models/name for name in mapping.values()]]
manifest={str(p.relative_to(DEST)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files}
(DEST/'文件校验.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
files.append(DEST/'文件校验.json')
archive=DEST.parent/'珍藏小物_收藏包.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
    for p in files:z.write(p,(Path('3D收藏')/p.relative_to(DEST)).as_posix())
print('Collection:',DEST)
print('Archive:',archive,archive.stat().st_size,'bytes')
